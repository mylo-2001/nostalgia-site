import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

type ReturnStatus = "requested" | "approved" | "in_transit" | "received" |
  "inspected" | "completed" | "rejected" | "cancelled";
type ItemCondition = "unopened" | "sellable" | "damaged" | "defective";

interface ReturnItem {
  id: string;
  quantity: number;
  reason: string;
  condition: string;
  restockDecision: string;
  inspectionNotes?: string;
  productName: string;
  variantName?: string;
  sku?: string;
}

interface RefundRecord {
  id: string;
  status: string;
  amount: string;
  currency: string;
  provider: string;
}

interface ReturnRecord {
  id: string;
  orderId: string;
  orderNumber?: string;
  customerEmail?: string;
  status: ReturnStatus;
  reason?: string;
  createdAt: string;
  orderTotal?: string;
  currency?: string;
  paymentStatus?: string;
  paymentId?: string;
  paymentAmount?: string;
  refundedAmount?: string;
  returnCarrier?: string;
  returnTrackingNumber?: string;
  handedToReturnCourierAt?: string;
  items: ReturnItem[];
  refunds: RefundRecord[];
}

interface ReturnOption {
  orderItemId: string;
  productName: string;
  variantName?: string;
  sku?: string;
  purchasedQuantity: number;
  claimedQuantity: number;
  returnableQuantity: number;
}

interface ReturnOptionsResponse {
  orderId: string;
  orderNumber: string;
  returnable: boolean;
  items: ReturnOption[];
}

interface InspectionDraft {
  condition: ItemCondition;
  restockDecision: "restock" | "do_not_restock";
  notes: string;
}

interface TrackingCheckpoint { at?: string; action: string; location: string }

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Νέο αίτημα",
  approved: "Εγκρίθηκε",
  in_transit: "Σε μεταφορά",
  received: "Παραλήφθηκε",
  inspected: "Μερικώς ελεγμένο",
  completed: "Ολοκληρώθηκε",
  rejected: "Απορρίφθηκε",
  cancelled: "Ακυρώθηκε",
};

const ERROR_LABELS: Record<string, string> = {
  RETURN_REASON_REQUIRED: "Χρειάζεται αιτιολογία τουλάχιστον 3 χαρακτήρων.",
  INVALID_RETURN_TRANSITION: "Η ενέργεια δεν επιτρέπεται στην τρέχουσα κατάσταση.",
  RETURN_NOT_RECEIVED: "Η επιστροφή πρέπει πρώτα να σημειωθεί ως παραληφθείσα.",
  UNSELLABLE_RESTOCK: "Ελαττωματικό ή κατεστραμμένο προϊόν δεν μπορεί να επιστρέψει στο stock.",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("el-GR", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}

function formatMoney(value?: string, currency = "EUR") {
  return new Intl.NumberFormat("el-GR", { style: "currency", currency }).format(Number(value || 0));
}

export function Returns() {
  const [rows, setRows] = useState<ReturnRecord[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [inspection, setInspection] = useState<Record<string, InspectionDraft>>({});
  const [createOrder, setCreateOrder] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createOptions, setCreateOptions] = useState<ReturnOptionsResponse | null>(null);
  const [createQuantities, setCreateQuantities] = useState<Record<string, number>>({});
  const [shipments, setShipments] = useState<Record<string, string>>({});
  const [tracking, setTracking] = useState<Record<string, TrackingCheckpoint[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await api.get(`/api/v2/admin/returns${query}`);
    if (response.ok) setRows((response.returns as ReturnRecord[]) || []);
    else setMessage("Δεν ήταν δυνατή η φόρτωση των επιστροφών.");
    setLoading(false);
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  async function findOrderForReturn() {
    const value = createOrder.trim();
    if (!value) return;
    setBusy("create-lookup"); setMessage(""); setCreateOptions(null);
    const response = await api.get(`/api/v2/admin/orders/${encodeURIComponent(value)}/return-options`);
    setBusy("");
    if (!response.ok) {
      setMessage(response.error === "ORDER_NOT_FOUND" ? "Η παραγγελία δεν βρέθηκε." : "Δεν ήταν δυνατός ο έλεγχος της παραγγελίας.");
      return;
    }
    const options = response as unknown as ReturnOptionsResponse;
    setCreateOptions(options);
    setCreateQuantities(Object.fromEntries(options.items.map((item) => [item.orderItemId, 0])));
    if (!options.returnable) setMessage("Η παραγγελία δεν έχει παραδοθεί ακόμη και δεν δέχεται επιστροφή.");
    else if (!options.items.length) setMessage("Δεν υπάρχουν διαθέσιμα προϊόντα για νέο αίτημα επιστροφής.");
  }

  async function createRequest() {
    if (!createOptions) return;
    const items = createOptions.items.flatMap((item) => {
      const quantity = Number(createQuantities[item.orderItemId] || 0);
      return quantity > 0 ? [{ orderItemId: item.orderItemId, quantity,
        reason: createReason.trim() || "admin_request" }] : [];
    });
    if (!items.length) { setMessage("Επίλεξε τουλάχιστον ένα προϊόν."); return; }
    if (createReason.trim().length < 3) { setMessage("Χρειάζεται αιτιολογία τουλάχιστον 3 χαρακτήρων."); return; }
    setBusy("create-submit"); setMessage("");
    const response = await api.postWithHeaders(
      `/api/v2/admin/orders/${encodeURIComponent(createOptions.orderId)}/returns`,
      { items, reason: createReason.trim() }, { "Idempotency-Key": crypto.randomUUID() });
    setBusy("");
    if (!response.ok) { setMessage(ERROR_LABELS[String(response.error)] || "Το αίτημα δεν δημιουργήθηκε."); return; }
    setMessage("Το αίτημα επιστροφής δημιουργήθηκε.");
    setCreateOrder(""); setCreateReason(""); setCreateOptions(null); setCreateQuantities({});
    await load();
  }

  async function handoff(row: ReturnRecord) {
    const trackingNumber = (shipments[row.id] || "").trim();
    if (!/^[A-Za-z0-9-]{5,80}$/.test(trackingNumber)) {
      setMessage("Καταχώρησε έγκυρο αριθμό voucher/tracking ACS."); return;
    }
    setBusy(row.id); setMessage("");
    const response = await api.post(`/api/v2/admin/returns/${row.id}/handoff`,
      { carrier: "acs", trackingNumber });
    setBusy("");
    if (!response.ok) { setMessage(ERROR_LABELS[String(response.error)] || "Η παράδοση στον courier δεν καταχωρήθηκε."); return; }
    setMessage("Καταχωρήθηκε η παράδοση του δέματος στον courier επιστροφής.");
    await load();
  }

  async function refreshTracking(row: ReturnRecord) {
    setBusy(row.id); setMessage("");
    const response = await api.get(`/api/v2/admin/returns/${row.id}/tracking`);
    setBusy("");
    if (!response.ok) {
      setMessage(response.error === "ACS_NOT_CONFIGURED"
        ? "Η σύνδεση ACS δεν έχει ρυθμιστεί στο περιβάλλον."
        : "Δεν ήταν δυνατή η ανάκτηση του tracking από την ACS.");
      return;
    }
    setTracking((current) => ({ ...current,
      [row.id]: (response.checkpoints as TrackingCheckpoint[]) || [] }));
  }

  async function transition(row: ReturnRecord, action: "approve" | "receive" | "reject" | "cancel") {
    const needsReason = action === "reject" || action === "cancel";
    const reason = (reasons[row.id] || "").trim();
    if (needsReason && reason.length < 3) {
      setMessage(ERROR_LABELS.RETURN_REASON_REQUIRED);
      return;
    }
    setBusy(row.id); setMessage("");
    const response = await api.post(`/api/v2/admin/returns/${row.id}/${action}`,
      needsReason ? { reason } : {});
    setBusy("");
    if (!response.ok) {
      setMessage(ERROR_LABELS[String(response.error)] || "Η ενέργεια απέτυχε.");
      return;
    }
    setMessage("Η επιστροφή ενημερώθηκε.");
    await load();
  }

  function draftFor(item: ReturnItem): InspectionDraft {
    return inspection[item.id] || {
      condition: item.condition === "unknown" ? "sellable" : item.condition as ItemCondition,
      restockDecision: item.restockDecision === "restock" ? "restock" : "do_not_restock",
      notes: item.inspectionNotes || "",
    };
  }

  function updateDraft(item: ReturnItem, patch: Partial<InspectionDraft>) {
    const next = { ...draftFor(item), ...patch };
    if (["damaged", "defective"].includes(next.condition)) next.restockDecision = "do_not_restock";
    setInspection((current) => ({ ...current, [item.id]: next }));
  }

  async function inspect(row: ReturnRecord) {
    const decisions = row.items.map((item) => ({ returnItemId: item.id, ...draftFor(item) }));
    setBusy(row.id); setMessage("");
    const response = await api.post(`/api/v2/admin/returns/${row.id}/inspect`, { decisions });
    setBusy("");
    if (!response.ok) {
      setMessage(ERROR_LABELS[String(response.error)] || "Ο έλεγχος δεν αποθηκεύτηκε.");
      return;
    }
    setMessage("Ο έλεγχος προϊόντων αποθηκεύτηκε.");
    await load();
  }

  return (
    <div className="returns-page">
      <header className="page-heading">
        <div>
          <h2 className="main__title">Ακυρώσεις &amp; Επιστροφές</h2>
          <p className="muted">Ακυρώσεις πριν την αποστολή γίνονται από την αντίστοιχη παραγγελία. Οι επιστροφές μετά την παράδοση διαχειρίζονται εδώ.</p>
        </div>
        <button className="btn" type="button" onClick={() => void load()} disabled={loading}>Ανανέωση</button>
      </header>

      <section className="return-create" aria-labelledby="return-create-title">
        <div className="return-create__intro">
          <h3 id="return-create-title">Νέο αίτημα επιστροφής</h3>
          <p className="muted">Αναζήτησε με ID ή αριθμό παραγγελίας και επίλεξε τα προϊόντα που επιστρέφονται.</p>
        </div>
        <label className="field">Παραγγελία
          <input value={createOrder} onChange={(event) => setCreateOrder(event.target.value)} placeholder="ID ή αριθμός" />
        </label>
        <button className="btn" type="button" disabled={busy === "create-lookup" || !createOrder.trim()} onClick={() => void findOrderForReturn()}>Έλεγχος</button>
        {createOptions && createOptions.returnable && createOptions.items.length > 0 && (
          <div className="return-create__items">
            {createOptions.items.map((item) => (
              <label className="return-create__item" key={item.orderItemId}>
                <span><strong>{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</strong><small>Διαθέσιμα: {item.returnableQuantity}</small></span>
                <input type="number" min="0" max={item.returnableQuantity} value={createQuantities[item.orderItemId] || 0}
                  onChange={(event) => setCreateQuantities((current) => ({ ...current,
                    [item.orderItemId]: Math.min(item.returnableQuantity, Math.max(0, Number(event.target.value) || 0)) }))} />
              </label>
            ))}
            <label className="field return-create__reason">Αιτιολογία
              <textarea rows={2} maxLength={500} value={createReason} onChange={(event) => setCreateReason(event.target.value)} />
            </label>
            <button className="btn btn--primary" type="button" disabled={busy === "create-submit"} onClick={() => void createRequest()}>Δημιουργία αιτήματος</button>
          </div>
        )}
      </section>

      <div className="returns-toolbar">
        <label className="field">Κατάσταση
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Όλες</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="returns-count">{loading ? "Φόρτωση…" : `${rows.length} επιστροφές`}</p>
      </div>

      {message && <p className="returns-message" role="status">{message}</p>}
      {!loading && rows.length === 0 && <p className="muted">Δεν υπάρχουν επιστροφές με αυτό το φίλτρο.</p>}

      <div className="return-list">
        {rows.map((row) => (
          <article className="return-row" key={row.id}>
            <header className="return-row__header">
              <div>
                <strong>Παραγγελία {row.orderNumber || row.orderId}</strong>
                <span>{formatDate(row.createdAt)} · {row.customerEmail || "Χωρίς email"}</span>
              </div>
              <span className={`return-status return-status--${row.status}`}>{STATUS_LABELS[row.status]}</span>
            </header>

            <dl className="return-meta">
              <div><dt>Αιτία</dt><dd>{row.reason || "Δεν δηλώθηκε"}</dd></div>
              <div><dt>Αξία παραγγελίας</dt><dd>{formatMoney(row.orderTotal, row.currency)}</dd></div>
              <div><dt>Πληρωμή</dt><dd>{row.paymentStatus || "-"}</dd></div>
            </dl>
            {row.returnTrackingNumber && (
              <div className="return-shipment-summary"><p><strong>Επιστροφή μέσω ACS:</strong> {row.returnTrackingNumber}
                {row.handedToReturnCourierAt ? ` · Παράδοση ${formatDate(row.handedToReturnCourierAt)}` : ""}</p>
                {row.status === "in_transit" && <button className="btn btn--ghost" type="button" disabled={busy === row.id} onClick={() => void refreshTracking(row)}>Ανανέωση tracking ACS</button>}
                {tracking[row.id]?.length > 0 && <ol>{tracking[row.id].map((point, index) => <li key={`${point.at || "point"}-${index}`}><strong>{point.action}</strong>{point.location ? ` · ${point.location}` : ""}{point.at ? ` · ${formatDate(point.at)}` : ""}</li>)}</ol>}
              </div>
            )}

            <div className="return-items">
              {row.items.map((item) => {
                const draft = draftFor(item);
                return (
                  <div className="return-item" key={item.id}>
                    <div className="return-item__identity">
                      <strong>{item.productName}{item.variantName ? ` · ${item.variantName}` : ""}</strong>
                      <span>Ποσότητα: {item.quantity}{item.sku ? ` · SKU ${item.sku}` : ""}</span>
                      <span>{item.reason}</span>
                    </div>
                    {row.status === "received" && (
                      <div className="return-inspection">
                        <label className="field">Κατάσταση
                          <select value={draft.condition} onChange={(event) => updateDraft(item, { condition: event.target.value as ItemCondition })}>
                            <option value="unopened">Κλειστό</option>
                            <option value="sellable">Κατάλληλο προς πώληση</option>
                            <option value="damaged">Κατεστραμμένο</option>
                            <option value="defective">Ελαττωματικό</option>
                          </select>
                        </label>
                        <label className="field">Stock
                          <select value={draft.restockDecision} disabled={["damaged", "defective"].includes(draft.condition)} onChange={(event) => updateDraft(item, { restockDecision: event.target.value as InspectionDraft["restockDecision"] })}>
                            <option value="do_not_restock">Όχι επιστροφή στο stock</option>
                            <option value="restock">Επιστροφή στο stock</option>
                          </select>
                        </label>
                        <label className="field return-inspection__notes">Σημειώσεις ελέγχου
                          <textarea rows={2} maxLength={1000} value={draft.notes} onChange={(event) => updateDraft(item, { notes: event.target.value })} />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="return-actions">
              {row.status === "requested" && <button className="btn btn--primary" disabled={busy === row.id} onClick={() => void transition(row, "approve")}>Έγκριση επιστροφής</button>}
              {row.status === "approved" && (
                <>
                  <label className="field return-actions__tracking">Voucher / tracking ACS
                    <input maxLength={80} value={shipments[row.id] || ""} onChange={(event) => setShipments((current) => ({ ...current, [row.id]: event.target.value }))} />
                  </label>
                  <button className="btn btn--primary" disabled={busy === row.id} onClick={() => void handoff(row)}>Παραδόθηκε στον courier επιστροφής</button>
                </>
              )}
              {["approved", "in_transit"].includes(row.status) && <button className="btn btn--primary" disabled={busy === row.id} onClick={() => void transition(row, "receive")}>Παραλήφθηκε το δέμα</button>}
              {row.status === "received" && <button className="btn btn--primary" disabled={busy === row.id} onClick={() => void inspect(row)}>Ολοκλήρωση ελέγχου</button>}
              {["requested", "approved", "in_transit"].includes(row.status) && (
                <>
                  <label className="field return-actions__reason">Αιτιολογία απόρριψης/ακύρωσης
                    <input maxLength={500} value={reasons[row.id] || ""} onChange={(event) => setReasons((current) => ({ ...current, [row.id]: event.target.value }))} />
                  </label>
                  {row.status === "requested" && <button className="btn" disabled={busy === row.id} onClick={() => void transition(row, "reject")}>Απόρριψη</button>}
                  <button className="btn btn--ghost" disabled={busy === row.id} onClick={() => void transition(row, "cancel")}>Ακύρωση αιτήματος</button>
                </>
              )}
            </div>

            {row.status === "completed" && (
              <div className="return-refund">
                <div><strong>Επιστροφή χρημάτων</strong><p>Ο έλεγχος ολοκληρώθηκε. Η αυτόματη επιστροφή θα ενεργοποιηθεί με την επίσημη διασύνδεση Worldline.</p></div>
                <button className="btn btn--primary" type="button" disabled>Refund μέσω Worldline</button>
              </div>
            )}
            {row.refunds.length > 0 && <p className="return-refund-history">Καταγεγραμμένα refunds: {row.refunds.map((refund) => `${formatMoney(refund.amount, refund.currency)} (${refund.status})`).join(", ")}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
