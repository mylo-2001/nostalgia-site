import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Order, OrderTabCounts, Pagination } from "../types/order";
import {
  ORDER_STATUS, STATUS_ORDER, STATUS_CONFIRM, SHIP_STATUS, SHIP_ORDER, SHIP_CONFIRM,
  PAY_STATUS, PAY_CARD_ORDER, PAY_COD_ORDER, COURIERS, ORDER_TABS,
  orderStatusLabel, payMethodLabel, courierLabel, effectiveCourier, attentionFlags,
} from "../lib/labels";
import { money, fmtDate } from "../lib/format";

/* Today in the BROWSER's local timezone. Not toISOString() — that is UTC, so
   between midnight and 02:00/03:00 Greek time it prefills *yesterday* and ACS
   rejects the voucher with "Μη αποδεκτή ημερομηνία παραλαβής". */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

/* ACS sends the real reason in `detail`; fall back to the bare code. */
function acsError(res: { error?: string; detail?: string; status?: number }): string {
  return res.detail || res.error || String(res.status ?? "");
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={"obadge obadge--" + color}>{children}</span>;
}
function statusBadge(s: string) {
  const m = ORDER_STATUS[s] ?? { label: s, color: "grey" };
  return <Badge color={m.color}>{m.label}</Badge>;
}
function shipBadge(s: string) {
  const m = SHIP_STATUS[s] ?? { label: s, color: "grey" };
  return <Badge color={m.color}>{m.label}</Badge>;
}
function payBadge(o: Order) {
  const s = PAY_STATUS[o.paymentStatus] ?? { short: o.paymentStatus, color: "grey" };
  return (<><Badge color="slate">{o.payment === "cod" ? "Αντικαταβολή" : "Κάρτα"}</Badge>{" "}<Badge color={s.color}>{s.short}</Badge></>);
}

function eventLine(ev: Order["events"][number], i: number) {
  const who = ev.actor || "admin";
  let txt = ev.type || "ενέργεια";
  if (ev.type === "status") txt = `άλλαξε κατάσταση: ${ORDER_STATUS[ev.from ?? ""]?.label ?? ev.from} → ${ORDER_STATUS[ev.to ?? ""]?.label ?? ev.to}`;
  else if (ev.type === "payment") txt = `άλλαξε πληρωμή: ${PAY_STATUS[ev.from ?? ""]?.label ?? ev.from} → ${PAY_STATUS[ev.to ?? ""]?.label ?? ev.to}`;
  else if (ev.type === "shipping") txt = `άλλαξε αποστολή: ${SHIP_STATUS[ev.from ?? ""]?.label ?? ev.from} → ${SHIP_STATUS[ev.to ?? ""]?.label ?? ev.to}`;
  else if (ev.type === "tracking") txt = "ενημέρωσε tracking: " + (ev.to || "—");
  else if (ev.type === "courier") txt = "όρισε courier: " + courierLabel(ev.to ?? "");
  else if (ev.type === "assignee") txt = ev.to ? "ανέθεσε στον/στην " + ev.to : "αφαίρεσε ανάθεση";
  else if (ev.type === "notes") txt = "ενημέρωσε σημειώσεις";
  return <li key={i}><span className="ohist__when">{fmtDate(ev.at)}</span> — <strong>{who}</strong> {txt}</li>;
}

function OrderDetail({ o, onChanged }: { o: Order; onChanged: () => void }) {
  const c = o.customer ?? {};
  const [courier, setCourier] = useState(String(effectiveCourier(o)).toLowerCase());
  const [tracking, setTracking] = useState(o.tracking || "");
  const [assignee, setAssignee] = useState(o.assignee || "");
  const [notes, setNotes] = useState(o.notes || "");
  const [saving, setSaving] = useState(false);

  async function patch(body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return false;
    setSaving(true);
    const res = await api.patch("/api/admin/orders/" + o.id, body);
    setSaving(false);
    if (res.ok) onChanged();
    else if (res.error === "not_cancellable") window.alert("Δεν ακυρώνεται online.");
    return res.ok;
  }

  const [acsAvailable, setAcsAvailable] = useState(false);
  useEffect(() => {
    api.get("/api/admin/acs/status").then((res) => { if (res.ok) setAcsAvailable(!!res.configured); });
  }, []);
  const hasAcsVoucher = o.courier === "acs" && !!o.tracking;
  const [acsPickupDate, setAcsPickupDate] = useState(localToday());
  const [acsWeight, setAcsWeight] = useState("0.5");
  const [acsWeightGuessed, setAcsWeightGuessed] = useState(false);
  /* Prefill from the catalogue weights — ACS re-weighs every parcel and bills
     the real figure, so guessing 0.5kg only delays the surprise. */
  useEffect(() => {
    if (!acsAvailable || hasAcsVoucher) return;
    let cancelled = false;
    api.get("/api/admin/orders/" + o.id + "/acs/weight").then((res) => {
      if (cancelled || !res.ok) return;
      setAcsWeight(String(res.weightKg));
      setAcsWeightGuessed(!res.estimated);
    });
    return () => { cancelled = true; };
  }, [acsAvailable, hasAcsVoucher, o.id]);
  const [acsNotes, setAcsNotes] = useState("");
  const [acsSaturday, setAcsSaturday] = useState(false);
  const [acsBusy, setAcsBusy] = useState(false);
  const [acsMsg, setAcsMsg] = useState("");

  async function acsCreateVoucher() {
    setAcsBusy(true); setAcsMsg("");
    const res = await api.post("/api/admin/orders/" + o.id + "/acs/create-voucher", {
      pickupDate: acsPickupDate, weight: acsWeight, notes: acsNotes, saturday: acsSaturday,
    });
    setAcsBusy(false);
    if (res.ok) { setAcsMsg("Δημιουργήθηκε αποστολή ACS: " + res.voucherNo); onChanged(); }
    else setAcsMsg("Σφάλμα: " + acsError(res));
  }
  const [acsPrintType, setAcsPrintType] = useState(2);
  const [acsStartPos, setAcsStartPos] = useState(1);
  async function acsPrintVoucher() {
    setAcsBusy(true); setAcsMsg("");
    const res = await api.get("/api/admin/orders/" + o.id +
      "/acs/print-voucher?printType=" + acsPrintType + "&startPosition=" + acsStartPos);
    setAcsBusy(false);
    if (res.ok && res.pdf) {
      const win = window.open("", "_blank");
      if (win) win.location.href = "data:application/pdf;base64," + res.pdf;
    } else setAcsMsg("Σφάλμα εκτύπωσης: " + acsError(res));
  }
  async function acsRefreshTracking() {
    setAcsBusy(true); setAcsMsg("");
    const res = await api.post("/api/admin/orders/" + o.id + "/acs/refresh-tracking", {});
    setAcsBusy(false);
    if (res.ok) { setAcsMsg("Κατάσταση ACS: " + (res.shippingStatus || "—")); onChanged(); }
    else setAcsMsg("Σφάλμα: " + acsError(res));
  }
  async function acsDeleteVoucher() {
    if (!window.confirm("Διαγραφή αποστολής ACS " + o.tracking + ";")) return;
    setAcsBusy(true); setAcsMsg("");
    const res = await api.del("/api/admin/orders/" + o.id + "/acs/voucher");
    setAcsBusy(false);
    if (res.ok) { setAcsMsg("Η αποστολή ACS διαγράφηκε."); onChanged(); }
    else setAcsMsg("Σφάλμα: " + acsError(res));
  }

  const giftBits: string[] = [];
  if (o.gift?.isGift) {
    if (o.gift.wrap) giftBits.push("Περιτύλιγμα");
    if (o.gift.messageText) giftBits.push("Μήνυμα: «" + o.gift.messageText + "»");
    if (o.gift.shipOther) giftBits.push("Παραλήπτης: " + (o.gift.recipient || ""));
  }
  const events = (o.events ?? []).slice().reverse();
  const payOpts = o.payment === "cod" ? PAY_COD_ORDER : PAY_CARD_ORDER;

  return (
    <div className="odetail">
      <section className="osec"><h4>Πελάτης</h4>
        <p>{c.firstname} {c.lastname}<br />Email: {c.email || "—"}<br />Κινητό: {c.mobile || "—"}{c.phone ? <><br />Σταθερό: {c.phone}</> : null}</p>
        {c.docType === "invoice"
          ? <p><strong>Τιμολόγιο</strong><br />{c.company} · ΑΦΜ {c.afm} · ΔΟΥ {c.doy}</p>
          : <p>Παραστατικό: Απόδειξη</p>}
      </section>

      <section className="osec"><h4>Αποστολή</h4>
        <p>{c.street} {c.streetNumber}, {c.postal} {c.city}{c.prefecture ? ", " + c.prefecture : ""}<br />{c.country || c.countryCode || ""}</p>
        <div className="ofield"><label>Κατάσταση αποστολής</label>
          <select value={o.shippingStatus} onChange={(e) => patch({ shippingStatus: e.target.value }, SHIP_CONFIRM[e.target.value as never] ? "Χαρακτηρισμός ως ΠΑΡΑΔΟΘΗΚΕ. Συνέχεια;" : undefined)}>
            {SHIP_ORDER.map((s) => <option key={s} value={s}>{SHIP_STATUS[s].label}</option>)}
          </select>
        </div>
        <div className="ofield"><label>Courier</label>
          <select value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="">—</option>
            {Object.keys(COURIERS).map((k) => <option key={k} value={k}>{COURIERS[k]}</option>)}
          </select>
        </div>
        <div className="ofield"><label>Tracking</label>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Αριθμός αποστολής" />
          {acsAvailable && !hasAcsVoucher && (
            <p className="field-hint">
              Για ACS <strong>μην το συμπληρώσεις εδώ</strong> — χρησιμοποίησε το
              «Δημιουργία αποστολής ACS» πιο κάτω και θα μπει μόνο του. Αυτό το πεδίο
              είναι μόνο για αριθμό που πήρες αλλού (π.χ. από το myACS ή άλλο courier).
            </p>
          )}
        </div>
        <button className="btn btn--small btn--primary" disabled={saving} onClick={() => patch({ courier, tracking })}>Αποθήκευση courier & tracking</button>

        {acsAvailable && (
          <div className="acs-box" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            {hasAcsVoucher ? (
              <>
                <p className="muted" style={{ margin: "0 0 2px" }}>Αποστολή ACS: <strong>{o.tracking}</strong></p>
                <p className="field-hint" style={{ margin: "0 0 8px" }}>
                  Διάλεξε τύπο εκτυπωτή και πάτα «Εκτύπωση ετικέτας» — ανοίγει το PDF σε νέα
                  καρτέλα. <strong>Τύπωσε την ετικέτα πριν κλείσεις τη λίστα παραλαβής</strong>·
                  μετά η ACS δεν επιτρέπει εκτύπωση voucher αυτής της ημέρας.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={acsPrintType} onChange={(e) => setAcsPrintType(Number(e.target.value))}
                    title="Τύπος εκτυπωτή" style={{ width: "auto" }}>
                    <option value={2}>Laser A4</option><option value={1}>Θερμικός</option>
                  </select>
                  {acsPrintType === 2 && (
                    <select value={acsStartPos} onChange={(e) => setAcsStartPos(Number(e.target.value))}
                      title="Η σελίδα A4 χωράει 3 ετικέτες — από ποια θέση να ξεκινήσει" style={{ width: "auto" }}>
                      <option value={1}>Θέση 1</option><option value={2}>Θέση 2</option><option value={3}>Θέση 3</option>
                    </select>
                  )}
                  <button className="btn btn--small" disabled={acsBusy} onClick={acsPrintVoucher}>Εκτύπωση ετικέτας</button>
                  <button className="btn btn--small" disabled={acsBusy} onClick={acsRefreshTracking}>Ανανέωση tracking ACS</button>
                  <button className="btn btn--small" style={{ color: "var(--danger)" }} disabled={acsBusy} onClick={acsDeleteVoucher}>Διαγραφή αποστολής ACS</button>
                </div>
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: "0 0 2px" }}>Δημιουργία πραγματικής αποστολής ACS</p>
                <p className="field-hint" style={{ margin: "0 0 10px" }}>
                  Έλεγξε το βάρος και πάτα «Δημιουργία αποστολής ACS». Ο αριθμός αποστολής
                  μπαίνει μόνος του στο πεδίο Tracking — δεν χρειάζεται να τον γράψεις εσύ.
                </p>
                <div className="npgrid">
                  <label className="field"><span>Ημ/νία παραλαβής</span>
                    <input type="date" value={acsPickupDate} onChange={(e) => setAcsPickupDate(e.target.value)} />
                    <p className="field-hint">
                      Άφησέ την στη σημερινή. Άλλαξέ την μόνο αν το δέμα θα δοθεί στον
                      διανομέα άλλη μέρα. Δεν καλεί courier — δηλώνει σε ποιας ημέρας τη
                      λίστα παραλαβής ανήκει.
                    </p>
                  </label>
                  <label className="field">
                    <span>Βάρος (kg){acsWeightGuessed && " ⚠️"}</span>
                    <input type="number" min="0.5" step="0.1" value={acsWeight} onChange={(e) => setAcsWeight(e.target.value)} />
                    <p className="field-hint">
                      {acsWeightGuessed
                        ? "⚠️ Δεν υπάρχουν καταχωρημένα βάρη στα προϊόντα — το 0,5 είναι απλώς το ελάχιστο της ACS. ΖΥΓΙΣΕ το δέμα και γράψε το πραγματικό: η ACS το ξαναζυγίζει και χρεώνει το μεγαλύτερο από τα δύο."
                        : "Υπολογίστηκε από τα βάρη των προϊόντων. Άλλαξέ το αν το δέμα ζυγίζει διαφορετικά με το κουτί."}
                    </p>
                  </label>
                  <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={acsSaturday} onChange={(e) => setAcsSaturday(e.target.checked)} style={{ width: "auto" }} /><span>Παράδοση Σάββατο</span>
                  </label>
                </div>
                <p className="field-hint" style={{ margin: "0 0 8px" }}>
                  «Παράδοση Σάββατο»: άφησέ το ξετσέκαρο. Χρειάζεται να είναι ενεργοποιημένη
                  η υπηρεσία στον λογαριασμό μας και χρεώνεται επιπλέον.
                </p>
                <label className="field"><span>Σημειώσεις παράδοσης (προαιρετικό)</span>
                  <input value={acsNotes} onChange={(e) => setAcsNotes(e.target.value)} placeholder="π.χ. χτύπημα κουδουνιού" />
                  <p className="field-hint">
                    Τυπώνεται πάνω στην ετικέτα, το διαβάζει ο διανομέας. Π.χ. «2ος όροφος»,
                    «απόγευμα», «χτύπα κουδούνι». Άφησέ το κενό αν δεν χρειάζεται.
                  </p>
                </label>
                <button className="btn btn--small btn--primary" style={{ marginTop: 8 }} disabled={acsBusy} onClick={acsCreateVoucher}>Δημιουργία αποστολής ACS</button>
              </>
            )}
            {acsMsg && <p className="muted" style={{ marginTop: 8 }}>{acsMsg}</p>}
          </div>
        )}
      </section>

      <section className="osec osec--wide"><h4>Προϊόντα</h4>
        <ul className="oitems">
          {(o.items ?? []).map((it, i) => (
            <li key={i}>
              {it.image ? <img src={"/" + it.image} alt="" loading="lazy" /> : <span className="oitems__sku">—</span>}
              <span>{it.title}{it.sku ? <span className="oitems__sku"> {it.sku}</span> : null}<br />× {it.qty}{it.price != null ? " · " + money(it.price) : ""}</span>
            </li>
          ))}
        </ul>
        {giftBits.length ? <p>🎁 Δώρο — {giftBits.join(" · ")}</p> : null}
      </section>

      <section className="osec"><h4>Πληρωμή</h4>
        <p><strong>Τρόπος:</strong> {payMethodLabel(o)}</p>
        <div className="ofield"><label>Κατάσταση πληρωμής</label>
          <select value={o.paymentStatus} onChange={(e) => patch({ paymentStatus: e.target.value })}>
            {payOpts.map((s) => <option key={s} value={s}>{PAY_STATUS[s]?.label ?? s}</option>)}
          </select>
        </div>
        {o.coupon ? <p>Κουπόνι: <strong>{o.coupon}</strong>{o.discount ? " (−" + money(o.discount) + ")" : ""}</p> : null}
        {o.total ? <p>Σύνολο: <strong>{money(o.total)}</strong></p> : null}
      </section>

      <section className="osec"><h4>Κατάσταση & Ανάθεση</h4>
        <div className="ofield"><label>Κατάσταση εκτέλεσης</label>
          <select value={STATUS_ORDER.includes(o.status) ? o.status : ""} onChange={(e) => patch({ status: e.target.value }, STATUS_CONFIRM[e.target.value as never] ? "Επιβεβαίωση αλλαγής κατάστασης;" : undefined)}>
            {!STATUS_ORDER.includes(o.status) && <option value="">{orderStatusLabel(o.status)}</option>}
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
          </select>
        </div>
        <div className="ofield"><label>Ανατέθηκε σε</label>
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Όνομα υπαλλήλου" />
        </div>
        <button className="btn btn--small btn--ghost" disabled={saving} onClick={() => patch({ assignee })}>Αποθήκευση ανάθεσης</button>
      </section>

      <section className="osec osec--wide"><h4>Εσωτερικές σημειώσεις</h4>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Σημειώσεις ομάδας (δεν βλέπει ο πελάτης)" />
        {c.notes ? <p className="muted">Σημείωση πελάτη: {c.notes}</p> : null}
        <button className="btn btn--small btn--ghost" disabled={saving} onClick={() => patch({ notes })}>Αποθήκευση σημειώσεων</button>
      </section>

      <section className="osec osec--wide"><h4>Ιστορικό</h4>
        {events.length ? <ul className="ohist">{events.map(eventLine)}</ul> : <p className="muted">Καμία καταγραφή ακόμη.</p>}
      </section>
    </div>
  );
}

/* Batch label printing. ACS accepts up to 10 vouchers per print call and 20
   per delete call; the server merges the returned PDFs into one document so a
   day's shipping is a single print job. */
const MAX_PRINT_BATCH = 10;
const MAX_DELETE_BATCH = 20;

function AcsBatchPanel({ orders, selected, onClear, onChanged }: {
  orders: Order[]; selected: Record<string, boolean>; onClear: () => void; onChanged: () => void;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    api.get("/api/admin/acs/status").then((res) => { if (res.ok) setAvailable(!!res.configured); });
  }, []);
  const [printType, setPrintType] = useState(2);
  const [startPosition, setStartPosition] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  /* Only orders that actually carry an ACS voucher can be printed/cancelled. */
  const ids = orders
    .filter((o) => selected[o.id] && o.courier === "acs" && !!o.tracking)
    .map((o) => o.id);

  async function printBatch() {
    setBusy(true); setMsg("");
    const res = await api.post("/api/admin/acs/print-vouchers", {
      orderIds: ids.slice(0, MAX_PRINT_BATCH), printType, startPosition,
    });
    setBusy(false);
    if (res.ok && res.pdf) {
      const win = window.open("", "_blank");
      if (win) win.location.href = "data:application/pdf;base64," + res.pdf;
      setMsg("Τυπώθηκαν " + res.count + " ετικέτες σε ένα αρχείο.");
    } else setMsg("Σφάλμα εκτύπωσης: " + acsError(res));
  }

  async function deleteBatch() {
    if (!window.confirm("Ακύρωση " + ids.length + " αποστολών ACS;\n\nΔεν γίνεται αν έχει ήδη κλείσει η λίστα παραλαβής.")) return;
    setBusy(true); setMsg("");
    const res = await api.post("/api/admin/acs/delete-vouchers", { orderIds: ids.slice(0, MAX_DELETE_BATCH) });
    setBusy(false);
    if (res.ok) { setMsg("Ακυρώθηκαν " + res.count + " αποστολές."); onClear(); onChanged(); }
    else setMsg("Σφάλμα ακύρωσης: " + acsError(res));
  }

  if (!available || !ids.length) return null;
  return (
    <div className="acs-box" style={{ marginBottom: 16, padding: "12px 16px", border: "1px solid var(--border)", borderRadius: 8 }}>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        <strong>{ids.length} επιλεγμένες αποστολές ACS</strong>
        {ids.length > MAX_PRINT_BATCH && <> · η εκτύπωση παίρνει τις πρώτες {MAX_PRINT_BATCH}</>}
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Εκτυπωτής
          <select value={printType} onChange={(e) => setPrintType(Number(e.target.value))}>
            <option value={2}>Laser (A4)</option>
            <option value={1}>Θερμικός (ρολό)</option>
          </select>
        </label>
        {printType === 2 && (
          <label style={{ display: "flex", gap: 6, alignItems: "center" }} title="Η σελίδα A4 χωράει 3 ετικέτες — διάλεξε από ποια θέση ξεκινά, για να μη χαλάς μισοχρησιμοποιημένα φύλλα.">
            Θέση στο φύλλο
            <select value={startPosition} onChange={(e) => setStartPosition(Number(e.target.value))}>
              <option value={1}>1η</option><option value={2}>2η</option><option value={3}>3η</option>
            </select>
          </label>
        )}
        <button className="btn btn--small btn--primary" disabled={busy} onClick={printBatch}>
          Εκτύπωση {Math.min(ids.length, MAX_PRINT_BATCH)} ετικετών
        </button>
        <button className="btn btn--small" style={{ color: "var(--danger)" }} disabled={busy} onClick={deleteBatch}>
          Ακύρωση αποστολών
        </button>
        <button className="btn btn--small btn--ghost" disabled={busy} onClick={onClear}>Καθαρισμός επιλογής</button>
      </div>
      {msg && <p className="muted" style={{ marginTop: 8, whiteSpace: "pre-line" }}>{msg}</p>}
    </div>
  );
}

function AcsPickupListPanel() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    api.get("/api/admin/acs/status").then((res) => { if (res.ok) setAvailable(!!res.configured); });
  }, []);
  const [pickupDate, setPickupDate] = useState(localToday());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pickupListNo, setPickupListNo] = useState("");
  const [issued, setIssued] = useState<{ PickupList_No: string; List_Vouchers_Count: number }[]>([]);

  /* Re-fetch whatever ACS already has for this date, so a page reload never
     hides the reprint button for a list that was issued earlier. */
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    api.get("/api/admin/acs/pickup-lists?pickupDate=" + pickupDate).then((res) => {
      if (cancelled) return;
      setIssued(res.ok && Array.isArray(res.lists) ? res.lists : []);
    });
    return () => { cancelled = true; };
  }, [available, pickupDate, pickupListNo]);

  async function issue() {
    /* Irreversible for the day: ACS refuses to print any voucher of this date
       afterwards, so make the operator confirm they printed everything. */
    if (!window.confirm(
      "Οριστικοποίηση λίστας για " + pickupDate + ";\n\n" +
      "Έχεις τυπώσει ΟΛΕΣ τις ετικέτες της ημέρας;\n" +
      "Μετά την οριστικοποίηση η ACS δεν επιτρέπει άλλη εκτύπωση voucher."
    )) return;
    setBusy(true); setMsg(""); setPickupListNo("");
    const res = await api.post("/api/admin/acs/pickup-list", { pickupDate });
    setBusy(false);
    if (res.ok && res.PickupList_No) {
      setPickupListNo(String(res.PickupList_No));
      setMsg("Λίστα παραλαβής εκδόθηκε: " + res.PickupList_No);
    } else if (res.ok) {
      /* ACS names the offending vouchers — show them, otherwise she has to
         hunt through every order to find which labels were never printed. */
      const unprinted = Array.isArray(res.unprintedVouchers) ? res.unprintedVouchers : [];
      setMsg(
        ((res.Error_Message as string) || "Δεν εκδόθηκε λίστα — υπάρχουν ατύπωτες αποστολές.") +
        (unprinted.length ? "\nΤύπωσε πρώτα: " + unprinted.join(", ") : "")
      );
    } else {
      setMsg("Σφάλμα: " + acsError(res));
    }
  }
  async function print(massNumber: string) {
    setBusy(true); setMsg("");
    const res = await api.get("/api/admin/acs/pickup-list/" + massNumber + "/print?pickupDate=" + pickupDate);
    setBusy(false);
    if (res.ok && res.pdf) {
      const win = window.open("", "_blank");
      if (win) win.location.href = "data:application/pdf;base64," + res.pdf;
    } else setMsg("Σφάλμα εκτύπωσης: " + acsError(res));
  }

  if (!available) return null;
  return (
    <div className="acs-box" style={{ marginBottom: 16, padding: "12px 16px", border: "1px solid var(--border)", borderRadius: 8 }}>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        <strong>ACS — Οριστικοποίηση Λίστας Παραλαβής</strong><br />
        Υποχρεωτικό στο τέλος της ημέρας: χωρίς αυτό, τα barcodes των τυπωμένων voucher δεν αναγνωρίζονται από την ACS.
      </p>
      <p style={{ margin: "0 0 10px", padding: "8px 10px", borderRadius: 6, background: "rgba(200,140,0,0.12)", fontSize: "0.86rem" }}>
        ⚠️ <strong>Τύπωσε ΠΡΩΤΑ όλες τις ετικέτες.</strong> Μετά την οριστικοποίηση η ACS
        δεν επιτρέπει πλέον εκτύπωση voucher αυτής της ημέρας.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
        <button className="btn btn--small btn--primary" disabled={busy} onClick={issue}>Οριστικοποίηση Λίστας</button>
      </div>
      {issued.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.84rem" }}>
            Λίστες αυτής της ημέρας — μπορείς να τις ξανατυπώσεις όποτε θέλεις:
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {issued.map((l) => (
              <button key={l.PickupList_No} className="btn btn--small" disabled={busy}
                onClick={() => print(String(l.PickupList_No))}>
                Εκτύπωση {l.PickupList_No} ({l.List_Vouchers_Count} αποστολές)
              </button>
            ))}
          </div>
        </div>
      )}
      {/* whiteSpace: the unprinted-voucher list is appended on its own line */}
      {msg && <p className="muted" style={{ marginTop: 8, whiteSpace: "pre-line" }}>{msg}</p>}
    </div>
  );
}

function OrderRow({ o, open, onToggle, onChanged, checked, onCheck }: {
  o: Order; open: boolean; onToggle: () => void; onChanged: () => void;
  checked: boolean; onCheck: (v: boolean) => void;
}) {
  const c = o.customer ?? {};
  const itemsCount = (o.items ?? []).reduce((s, it) => s + it.qty, 0);
  const flags = attentionFlags(o);
  const courier = effectiveCourier(o);
  const hasVoucher = o.courier === "acs" && !!o.tracking;
  return (
    <div className={"orow" + (open ? " is-open" : "") + (flags.length ? " has-attention" : "")}>
      <div className="orow__head" onClick={onToggle}>
        <div className="orow__main">
          {/* stopPropagation: ticking the box must not expand the row */}
          <input type="checkbox" checked={checked} disabled={!hasVoucher}
            title={hasVoucher ? "Επιλογή για μαζική εκτύπωση" : "Δεν έχει voucher ACS"}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onCheck(e.target.checked)}
            style={{ width: "auto", margin: 0, opacity: hasVoucher ? 1 : 0.25 }} />
          <span className="orow__num">{o.number}</span>
          <span className="orow__date">{fmtDate(o.createdAt)}</span>
          <span className="orow__cust">{c.firstname} {c.lastname}</span>
          {c.mobile ? <span className="orow__phone">{c.mobile}</span> : null}
          <span>{itemsCount} τεμ.</span>
          <span className="orow__total">{o.total ? money(o.total) : "—"}</span>
        </div>
        <div className="orow__badges">
          <span>{payBadge(o)}</span>
          <span>{statusBadge(o.status)}</span>
          <span>{shipBadge(o.shippingStatus)}</span>
          {courier ? <span className="orow__courier">{courierLabel(courier)}{o.tracking ? " · " + o.tracking : ""}</span> : null}
          <span className="orow__assignee">Υπεύθυνος: {o.assignee || <span className="muted">Χωρίς ανάθεση</span>}</span>
          <span className="orow__toggle">{open ? "Κλείσιμο ▲" : "Άνοιγμα ▾"}</span>
        </div>
      </div>
      {flags.length ? <div className="oflags">{flags.map((f, i) => <span key={i} className="oflag">{f}</span>)}</div> : null}
      {open ? <OrderDetail o={o} onChanged={onChanged} /> : null}
    </div>
  );
}

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<OrderTabCounts>({});
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState("");
  const [shipping, setShipping] = useState("");
  const [courier, setCourier] = useState("");
  const [sort, setSort] = useState("");
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef<number | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set("page", String(page)); p.set("limit", String(limit));
    const extra: Record<string, string> = { tab, q: search, payment, shipping, courier, sort };
    Object.keys(extra).forEach((k) => { if (extra[k]) p.set(k, extra[k]); });
    const res = await api.get("/api/admin/orders?" + p.toString());
    setLoading(false);
    if (res.ok) {
      setOrders((res.orders as Order[]) || []);
      setCounts((res.counts as OrderTabCounts) || {});
      setPagination((res.pagination as Pagination) || null);
    }
  }, [tab, search, payment, shipping, courier, sort, limit, page]);

  useEffect(() => { load(); }, [load]);

  function onSearchInput(v: string) {
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => { setSearch(v.trim()); setPage(1); }, 300);
  }

  return (
    <div>
      <h2 className="main__title">Παραγγελίες</h2>
      <AcsBatchPanel orders={orders} selected={selected}
        onClear={() => setSelected({})} onChanged={load} />
      <AcsPickupListPanel />
      <div className="orders-toolbar">
        <input className="orders-search" type="search" placeholder="Αναζήτηση: αριθμός, πελάτης, email, τηλέφωνο, tracking…"
          defaultValue={search} onChange={(e) => onSearchInput(e.target.value)} />
        <div className="orders-tabs">
          {ORDER_TABS.map((t) => {
            const n = counts[t.id as keyof OrderTabCounts];
            return (
              <button key={t.id} className={"otab" + (tab === t.id ? " is-active" : "")} onClick={() => { setTab(t.id); setPage(1); }}>
                {t.label}{n != null ? <span className="otab__count">{n}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="orders-filters">
          <label>Πληρωμή
            <select value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }}>
              <option value="">Όλες</option><option value="card">Κάρτα (όλες)</option><option value="cod">Αντικαταβολή (όλες)</option>
              <option value="paid">Κάρτα – Πληρωμένη</option><option value="pending">Κάρτα – Εκκρεμεί</option><option value="failed">Κάρτα – Αποτυχία</option>
              <option value="refunded">Κάρτα – Επιστροφή</option><option value="cod_pending">ΑΝΤ – δεν εισπράχθηκε</option>
              <option value="cod_collected">ΑΝΤ – εισπράχθηκε</option><option value="cod_awaiting_remittance">ΑΝΤ – αναμονή απόδοσης</option>
            </select>
          </label>
          <label>Αποστολή
            <select value={shipping} onChange={(e) => { setShipping(e.target.value); setPage(1); }}>
              <option value="">Όλες</option>
              {SHIP_ORDER.map((s) => <option key={s} value={s}>{SHIP_STATUS[s].label}</option>)}
            </select>
          </label>
          <label>Courier
            <select value={courier} onChange={(e) => { setCourier(e.target.value); setPage(1); }}>
              <option value="">Όλοι</option>
              {Object.keys(COURIERS).map((k) => <option key={k} value={k}>{COURIERS[k]}</option>)}
            </select>
          </label>
          <label>Ταξινόμηση
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="">Προτεραιότητα</option><option value="recent">Πιο πρόσφατες</option><option value="oldest">Πιο παλιές</option>
              <option value="amount-desc">Ποσό ↓</option><option value="amount-asc">Ποσό ↑</option>
            </select>
          </label>
          <label>Ανά σελίδα
            <select value={limit} onChange={(e) => { setLimit(parseInt(e.target.value, 10) || 50); setPage(1); }}>
              <option value="25">25</option><option value="50">50</option><option value="100">100</option>
            </select>
          </label>
        </div>
      </div>

      {loading && !orders.length ? <p className="muted">Φόρτωση…</p> : null}
      {!orders.length && !loading ? <p className="empty">Δεν υπάρχουν παραγγελίες σε αυτήν την προβολή.</p> : (
        <div className="otable">
          {orders.map((o) => (
            <OrderRow key={o.id} o={o} open={!!expanded[o.id]}
              onToggle={() => setExpanded((e) => ({ ...e, [o.id]: !e[o.id] }))}
              onChanged={load}
              checked={!!selected[o.id]}
              onCheck={(v) => setSelected((s) => ({ ...s, [o.id]: v }))} />
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 ? (
        <div className="pager">
          <button className="btn btn--small btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span className="muted">{page} / {pagination.pages} · {pagination.total} σύνολο</span>
          <button className="btn btn--small btn--ghost" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
