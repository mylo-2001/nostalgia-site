import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Order, OrderTabCounts, Pagination } from "../types/order";
import {
  ORDER_STATUS, STATUS_ORDER, STATUS_CONFIRM, SHIP_STATUS, SHIP_ORDER, SHIP_CONFIRM,
  PAY_STATUS, PAY_CARD_ORDER, PAY_COD_ORDER, COURIERS, ORDER_TABS,
  orderStatusLabel, payMethodLabel, courierLabel, effectiveCourier, attentionFlags,
} from "../lib/labels";
import { money, fmtDate } from "../lib/format";

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
        </div>
        <button className="btn btn--small btn--primary" disabled={saving} onClick={() => patch({ courier, tracking })}>Αποθήκευση courier & tracking</button>
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

function OrderRow({ o, open, onToggle, onChanged }: { o: Order; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const c = o.customer ?? {};
  const itemsCount = (o.items ?? []).reduce((s, it) => s + it.qty, 0);
  const flags = attentionFlags(o);
  const courier = effectiveCourier(o);
  return (
    <div className={"orow" + (open ? " is-open" : "") + (flags.length ? " has-attention" : "")}>
      <div className="orow__head" onClick={onToggle}>
        <div className="orow__main">
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
              onChanged={load} />
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
