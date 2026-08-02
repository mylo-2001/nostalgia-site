import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { money, fmtDate } from "../lib/format";
import { CATEGORIES } from "../lib/catalog";
import type {
  Promotion, PromotionPreview, PromotionAuditEvent, DiscountType, TargetType,
} from "../types/promotion";
import type { AdminProduct } from "../types/product";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: "Πρόχειρη", color: "grey" },
  scheduled: { label: "Προγραμματισμένη", color: "blue" },
  active: { label: "Ενεργή", color: "green" },
  paused: { label: "Σε παύση", color: "orange" },
  cancelled: { label: "Ακυρωμένη", color: "red" },
  expired: { label: "Ληγμένη", color: "slate" },
};

const TABS: { id: string; label: string }[] = [
  { id: "all", label: "Όλες" },
  { id: "active", label: "Ενεργές" },
  { id: "scheduled", label: "Προγραμματισμένες" },
  { id: "draft", label: "Πρόχειρες" },
  { id: "paused", label: "Σε παύση" },
  { id: "expired", label: "Ληγμένες" },
];

function discountLabel(p: Pick<Promotion, "discountType" | "discountValue">): string {
  if (p.discountType === "percentage") return "−" + p.discountValue + "%";
  if (p.discountType === "fixed_amount") return "−" + money(p.discountValue);
  return "→ " + money(p.discountValue);
}

function durationLabel(p: Pick<Promotion, "startsAt" | "endsAt">): string {
  if (!p.startsAt && !p.endsAt) return "Χωρίς λήξη";
  const from = p.startsAt ? fmtDate(p.startsAt) : "τώρα";
  const to = p.endsAt ? fmtDate(p.endsAt) : "χωρίς λήξη";
  return from + " – " + to;
}

function emptyForm() {
  return {
    id: null as number | null,
    name: "",
    code: "",
    discountType: "percentage" as DiscountType,
    discountValue: "",
    maxDiscountPerProduct: "",
    status: "draft",
    sendMarketingEmail: true,
    startsAt: "",
    endsAt: "",
    priority: "100",
    targetMode: "product" as TargetType,
    productIds: [] as string[],
    categoryIds: [] as string[],
    excludeNewProducts: false,
    excludedProductIds: [] as string[],
  };
}
type FormState = ReturnType<typeof emptyForm>;

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function promotionToForm(p: Promotion): FormState {
  const allTargets = p.targets.some((t) => t.type === "all_products");
  const catTargets = p.targets.filter((t) => t.type === "category").map((t) => t.id as string);
  const prodTargets = p.targets.filter((t) => t.type === "product").map((t) => t.id as string);
  const targetMode: TargetType = allTargets ? "all_products" : catTargets.length ? "category" : "product";
  return {
    id: p.id, name: p.name, code: p.code,
    discountType: p.discountType, discountValue: String(p.discountValue),
    maxDiscountPerProduct: p.maxDiscountPerProduct != null ? String(p.maxDiscountPerProduct) : "",
    status: p.status,
    sendMarketingEmail: false,
    startsAt: p.startsAt ? toLocalInputValue(p.startsAt) : "",
    endsAt: p.endsAt ? toLocalInputValue(p.endsAt) : "",
    priority: String(p.priority),
    targetMode,
    productIds: prodTargets,
    categoryIds: catTargets,
    excludeNewProducts: p.exclusions.some((e) => e.type === "new_products"),
    excludedProductIds: p.exclusions.filter((e) => e.type === "product").map((e) => e.id as string),
  };
}

function formToPayload(f: FormState): Record<string, unknown> {
  let targets: { type: string; id: string | null }[];
  if (f.targetMode === "all_products") targets = [{ type: "all_products", id: null }];
  else if (f.targetMode === "category") targets = f.categoryIds.map((id) => ({ type: "category", id }));
  else targets = f.productIds.map((id) => ({ type: "product", id }));

  const exclusions: { type: string; id: string | null }[] = [];
  if (f.excludeNewProducts) exclusions.push({ type: "new_products", id: null });
  f.excludedProductIds.forEach((id) => exclusions.push({ type: "product", id }));

  return {
    name: f.name,
    code: f.code || undefined,
    discountType: f.discountType,
    discountValue: f.discountValue,
    maxDiscountPerProduct: f.maxDiscountPerProduct || undefined,
    status: f.status,
    sendMarketingEmail: f.sendMarketingEmail,
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    priority: f.priority ? Number(f.priority) : 100,
    targets,
    exclusions,
  };
}

export function Promotions() {
  const [list, setList] = useState<Promotion[]>([]);
  const [tab, setTab] = useState("all");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [requiresConfirm, setRequiresConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [auditFor, setAuditFor] = useState<number | null>(null);
  const [auditEvents, setAuditEvents] = useState<PromotionAuditEvent[]>([]);
  const [productFilter, setProductFilter] = useState("");

  const load = useCallback(() => {
    api.get("/api/admin/promotions").then((res) => { if (res.ok) setList((res.promotions as Promotion[]) || []); });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/api/admin/products").then((res) => { if (res.ok) setProducts((res.products as AdminProduct[]) || []); });
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return list;
    return list.filter((p) => (p.effectiveStatus || p.status) === tab);
  }, [list, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length };
    for (const p of list) {
      const s = p.effectiveStatus || p.status;
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [list]);

  const sellableProducts = useMemo(() => products.filter((p) => p.price != null), [products]);
  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return sellableProducts;
    return sellableProducts.filter((p) => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [sellableProducts, productFilter]);

  /* Products the promotion would actually touch. When it targets categories,
     offering the whole catalogue as "exclusions" invites ticking a product the
     promotion never covered — a no-op that reads like it did something. */
  const excludableProducts = useMemo(() => {
    if (editing?.targetMode !== "category") return filteredProducts;
    const cats = new Set(editing.categoryIds);
    return filteredProducts.filter((p) => cats.has(p.catId));
  }, [filteredProducts, editing?.targetMode, editing?.categoryIds]);

  function resetGate() { setPreview(null); setRequiresConfirm(false); setConfirmText(""); }

  function openCreate() { setEditing(emptyForm()); resetGate(); setMsg(""); setAuditFor(null); }
  function openEdit(p: Promotion) { setEditing(promotionToForm(p)); resetGate(); setMsg(""); }
  function closeForm() { setEditing(null); resetGate(); }

  function patchForm(fields: Partial<FormState>) {
    setEditing((f) => (f ? { ...f, ...fields } : f));
    resetGate();
  }

  async function runPreview() {
    if (!editing) return;
    setBusy(true); setMsg("");
    const body: Record<string, unknown> = { ...formToPayload(editing) };
    if (editing.id != null) body.excludeId = editing.id;
    const res = await api.post("/api/admin/promotions/preview", body);
    setBusy(false);
    if (res.ok) {
      setPreview(res.preview as PromotionPreview);
      setRequiresConfirm(!!res.requiresConfirmation);
    } else {
      setMsg("Σφάλμα προεπισκόπησης: " + (res.error || res.status));
    }
  }

  async function save(confirm: boolean) {
    if (!editing) return;
    setBusy(true); setMsg("");
    const payload: Record<string, unknown> = { ...formToPayload(editing) };
    if (confirm) payload.confirm = true;
    const res = editing.id != null
      ? await api.patch("/api/admin/promotions/" + editing.id, payload)
      : await api.post("/api/admin/promotions", payload);
    setBusy(false);
    if (res.ok) { closeForm(); load(); return; }
    if (res.error === "confirmation_required") {
      setPreview(res.preview as PromotionPreview);
      setRequiresConfirm(true);
      setMsg("Μεγάλη αλλαγή — επιβεβαίωσε παρακάτω πριν προχωρήσεις.");
      return;
    }
    setMsg("Σφάλμα: " + (res.error || res.status));
  }

  async function quickStatus(p: Promotion, status: string) {
    const res = await api.patch("/api/admin/promotions/" + p.id, { status });
    if (res.ok) { load(); return; }
    if (res.error === "confirmation_required") {
      openEdit(p);
      setEditing((f) => (f ? { ...f, status } : f));
      setPreview(res.preview as PromotionPreview);
      setRequiresConfirm(true);
      setMsg("Απαιτείται επιβεβαίωση για να ενεργοποιηθεί.");
    }
  }

  async function removeDraft(p: Promotion) {
    if (!window.confirm("Διαγραφή πρόχειρης έκπτωσης «" + p.name + "»;")) return;
    const res = await api.del("/api/admin/promotions/" + p.id);
    if (res.ok) load();
  }

  async function toggleAudit(p: Promotion) {
    if (auditFor === p.id) { setAuditFor(null); return; }
    setAuditFor(p.id);
    const res = await api.get("/api/admin/promotions/" + p.id + "/audit");
    if (res.ok) setAuditEvents((res.events as PromotionAuditEvent[]) || []);
  }

  const canSubmit = !requiresConfirm || confirmText.trim().toUpperCase() === "ΕΝΕΡΓΟΠΟΙΗΣΗ";

  return (
    <div>
      <h2 className="main__title">Εκπτώσεις &amp; Προσφορές</h2>

      <div className="orders-tabs" style={{ marginBottom: 14, alignItems: "center" }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={"otab" + (tab === t.id ? " is-active" : "")} onClick={() => setTab(t.id)}>
            {t.label}<span className="otab__count">{counts[t.id] || 0}</span>
          </button>
        ))}
        <button type="button" className="btn btn--primary" style={{ marginLeft: "auto" }} onClick={openCreate}>
          + Νέα έκπτωση
        </button>
      </div>

      {list.length === 0 && !editing ? (
        <p className="empty">Καμία έκπτωση ακόμη.</p>
      ) : (
        <table className="tbl" style={{ marginBottom: 18 }}>
          <thead>
            <tr><th>Έκπτωση</th><th>Κατάσταση</th><th>Αξία</th><th>Εφαρμογή</th><th>Προϊόντα</th><th>Διάρκεια</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const s = STATUS_LABEL[p.effectiveStatus || p.status] || { label: p.status, color: "grey" };
              return (
                <>
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}{p.code ? <span className="muted"> · {p.code}</span> : null}</td>
                    <td><span className={"obadge obadge--" + s.color}>{s.label}</span></td>
                    <td>{discountLabel(p)}</td>
                    <td className="muted">{p.targetSummary}</td>
                    <td>{p.matchedCount ?? "—"}</td>
                    <td className="muted">{durationLabel(p)}</td>
                    <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn--small btn--ghost" onClick={() => openEdit(p)}>Επεξεργασία</button>
                      {(p.status === "draft" || p.status === "paused") && (
                        <button className="btn btn--small" onClick={() => quickStatus(p, "active")}>Ενεργοποίηση</button>
                      )}
                      {(p.status === "active" || p.status === "scheduled") && (
                        <button className="btn btn--small btn--ghost" onClick={() => quickStatus(p, "paused")}>Παύση</button>
                      )}
                      {p.status !== "cancelled" && (
                        <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => quickStatus(p, "cancelled")}>Ακύρωση</button>
                      )}
                      {p.status === "draft" && (
                        <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => removeDraft(p)}>Διαγραφή</button>
                      )}
                      <button className="btn btn--small btn--ghost" onClick={() => toggleAudit(p)}>{auditFor === p.id ? "▲" : "Ιστορικό ▾"}</button>
                    </td>
                  </tr>
                  {auditFor === p.id && (
                    <tr key={p.id + "-audit"}>
                      <td colSpan={7} style={{ background: "var(--bg-soft)" }}>
                        {auditEvents.length ? (
                          <ul style={{ margin: 0, padding: "8px 4px", listStyle: "none", fontSize: 12.5 }}>
                            {auditEvents.map((e) => (
                              <li key={e.id} style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                                <span className="muted">{fmtDate(e.created_at)}</span> · <strong>{e.actor || "—"}</strong> · {e.type}
                                {e.meta && Object.keys(e.meta).length ? <span className="muted"> — {JSON.stringify(e.meta)}</span> : null}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="empty" style={{ padding: 8 }}>Κανένα ιστορικό ακόμη.</p>}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}

      {editing && (
        <section className="card promo-editor">
          <h3 className="card__title">{editing.id != null ? "Επεξεργασία έκπτωσης" : "Νέα έκπτωση"}</h3>

          <div className="promo-step">
            <h4>1. Βασικά στοιχεία</h4>
            <div className="npgrid">
              <label className="field"><span>Όνομα έκπτωσης</span>
                <input value={editing.name} onChange={(e) => patchForm({ name: e.target.value })} placeholder="π.χ. Καλοκαιρινές εκπτώσεις 20%" />
                <p className="field-hint">Μόνο για δική σου αναφορά — ο πελάτης δεν το βλέπει πουθενά.</p>
              </label>
              <label className="field"><span>Εσωτερικός κωδικός (προαιρετικό)</span>
                <input value={editing.code} onChange={(e) => patchForm({ code: e.target.value.toUpperCase() })} placeholder="π.χ. SUMMER-2026" />
                <p className="field-hint">Δική σου ετικέτα αναφοράς. Δεν είναι κωδικός κουπονιού — ο πελάτης δεν τον πληκτρολογεί, η έκπτωση εφαρμόζεται αυτόματα.</p>
              </label>
              <label className="field"><span>Κατάσταση</span>
                <select value={editing.status} onChange={(e) => patchForm({ status: e.target.value })}>
                  <option value="draft">Πρόχειρη</option>
                  <option value="scheduled">Προγραμματισμένη</option>
                  <option value="active">Ενεργή</option>
                  {editing.id != null && <option value="paused">Παύση</option>}
                </select>
                <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><input type="checkbox" checked={editing.sendMarketingEmail} onChange={(e) => patchForm({ sendMarketingEmail: e.target.checked })} style={{ width: "auto" }} /><span>Αποστολή ενημερωτικού email όταν ενεργοποιηθεί</span></label>
                <p className="field-hint">
                  <strong>Πρόχειρη:</strong> δεν εφαρμόζεται πουθενά ακόμα, μόνο αποθηκεύεται. <strong>Προγραμματισμένη:</strong> θα ενεργοποιηθεί μόνη της στην ημερομηνία έναρξης (βήμα 4). <strong>Ενεργή:</strong> εφαρμόζεται στο κατάστημα αμέσως μόλις πατήσεις «Δημιουργία».
                </p>
              </label>
            </div>
          </div>

          <div className="promo-step">
            <h4>2. Τιμή έκπτωσης</h4>
            <div className="npgrid">
              <label className="field"><span>Τύπος</span>
                <select value={editing.discountType} onChange={(e) => patchForm({ discountType: e.target.value as DiscountType })}>
                  <option value="percentage">Ποσοστό %</option>
                  <option value="fixed_amount">Σταθερό ποσό €</option>
                  <option value="fixed_sale_price">Συγκεκριμένη τελική τιμή €</option>
                </select>
                <p className="field-hint">
                  {editing.discountType === "percentage" && "Αφαιρεί ένα ποσοστό από κάθε προϊόν — κάθε προϊόν έχει διαφορετική τελική τιμή ανάλογα με την κανονική του τιμή."}
                  {editing.discountType === "fixed_amount" && "Αφαιρεί το ίδιο σταθερό ποσό (€) από κάθε προϊόν, ό,τι τιμή κι αν έχει."}
                  {editing.discountType === "fixed_sale_price" && "Ορίζει ΜΙΑ συγκεκριμένη τελική τιμή για όλα τα προϊόντα που θα διαλέξεις — κατάλληλο κυρίως όταν επιλέγεις 1 προϊόν ή προϊόντα με ίδια κανονική τιμή."}
                </p>
              </label>
              <label className="field"><span>{editing.discountType === "percentage" ? "Ποσοστό (%)" : "Αξία (€)"}</span>
                <input
                  type="number" min="0" step="0.01" value={editing.discountValue}
                  onChange={(e) => patchForm({ discountValue: e.target.value })}
                  placeholder={editing.discountType === "percentage" ? "π.χ. 20" : editing.discountType === "fixed_amount" ? "π.χ. 10" : "π.χ. 9.90"}
                />
                <p className="field-hint">
                  {editing.discountType === "percentage" && "π.χ. 20 σημαίνει −20% (ένα προϊόν 30€ γίνεται 24€)."}
                  {editing.discountType === "fixed_amount" && "π.χ. 10 σημαίνει −10€ (ένα προϊόν 30€ γίνεται 20€)."}
                  {editing.discountType === "fixed_sale_price" && "π.χ. 9.90 σημαίνει ότι κάθε επιλεγμένο προϊόν θα κοστίζει ακριβώς 9,90€ (εφαρμόζεται μόνο σε προϊόντα με κανονική τιμή πάνω από αυτό το ποσό)."}
                </p>
              </label>
              {editing.discountType === "percentage" && (
                <label className="field"><span>Μέγιστη έκπτωση ανά προϊόν (προαιρετικό)</span>
                  <input type="number" min="0" step="0.01" value={editing.maxDiscountPerProduct} onChange={(e) => patchForm({ maxDiscountPerProduct: e.target.value })} placeholder="χωρίς όριο" />
                  <p className="field-hint">Βάζει «ταβάνι» στην έκπτωση σε ευρώ. π.χ. με 20% + όριο 15€: ένα προϊόν 200€ θα έπαιρνε κανονικά −40€, αλλά με το όριο παίρνει μόνο −15€ (τελική τιμή 185€).</p>
                </label>
              )}
            </div>
          </div>

          <div className="promo-step">
            <h4>3. Προϊόντα</h4>
            <div className="promo-radio-row">
              {([
                ["product", "Ένα ή περισσότερα προϊόντα", "Επίλεξε συγκεκριμένα προϊόντα από τη λίστα παρακάτω."],
                ["category", "Κατηγορίες", "Ισχύει για ΟΛΑ τα προϊόντα μέσα στις κατηγορίες που θα επιλέξεις· μπορείς να εξαιρέσεις προϊόντα ή τα νέα προϊόντα παρακάτω."],
                ["all_products", "Όλα τα προϊόντα", "Ισχύει σε όλο το κατάστημα· μπορείς να εξαιρέσεις προϊόντα ή τα νέα προϊόντα παρακάτω."],
              ] as [TargetType, string, string][]).map(([mode, label, hint]) => (
                <label key={mode} className="promo-radio promo-radio-col">
                  <span><input type="radio" checked={editing.targetMode === mode} onChange={() => patchForm({ targetMode: mode })} /> {label}</span>
                  <span className="field-hint">{hint}</span>
                </label>
              ))}
            </div>

            {editing.targetMode === "product" && (
              <div className="promo-picker">
                <input className="orders-search" placeholder="Αναζήτηση προϊόντος…" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
                <div className="promo-picker__list">
                  {filteredProducts.map((p) => (
                    <label key={p.id} className="promo-picker__item">
                      <input
                        type="checkbox"
                        checked={editing.productIds.includes(p.id)}
                        onChange={(e) => patchForm({
                          productIds: e.target.checked ? [...editing.productIds, p.id] : editing.productIds.filter((id) => id !== p.id),
                        })}
                      />
                      <span>{p.title}</span><span className="muted">{money(p.price)}</span>
                    </label>
                  ))}
                  {!filteredProducts.length && <p className="empty">Δεν βρέθηκαν προϊόντα.</p>}
                </div>
                <p className="muted" style={{ marginTop: 6 }}>{editing.productIds.length} επιλεγμένα</p>
              </div>
            )}

            {editing.targetMode === "category" && (
              <div>
                <div className="promo-picker__list">
                  {Object.entries(CATEGORIES).map(([id, name]) => (
                    <label key={id} className="promo-picker__item">
                      <input
                        type="checkbox"
                        checked={editing.categoryIds.includes(id)}
                        onChange={(e) => patchForm({
                          categoryIds: e.target.checked ? [...editing.categoryIds, id] : editing.categoryIds.filter((c) => c !== id),
                        })}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
                <p className="field-hint">π.χ. αν επιλέξεις «Art Class Murano Candle», η έκπτωση θα ισχύσει σε ΟΛΑ τα κεριά αυτής της κατηγορίας, χωρίς να χρειάζεται να διαλέξεις ένα-ένα.</p>
              </div>
            )}

            {/* Exclusions apply to any promotion that covers products by rule
                rather than by hand. With "specific products" you simply don't
                tick the ones you want left out, so they'd be noise there. */}
            {(editing.targetMode === "all_products" || editing.targetMode === "category") && (
              <div className="promo-exclusions">
                <p className="muted" style={{ marginTop: 0 }}>Εξαιρέσεις:</p>
                <label className="promo-radio">
                  <input type="checkbox" checked={editing.excludeNewProducts} onChange={(e) => patchForm({ excludeNewProducts: e.target.checked })} /> Εξαίρεση νέων προϊόντων (τελευταίες 30 ημέρες)
                </label>
                <p className="field-hint">
                  Χρήσιμο όταν μόλις ανέβασες κάτι καινούριο και δεν θέλεις να μπει αμέσως σε προσφορά.
                  Ο έλεγχος γίνεται τη στιγμή της αγοράς: κάθε προϊόν μένει εκτός για τις πρώτες 30 μέρες του
                  και μπαίνει μόνο του στην έκπτωση μετά, χωρίς να χρειαστεί να αλλάξεις τίποτα.
                </p>

                <p className="muted" style={{ marginTop: 14, marginBottom: 4 }}>Εξαίρεση συγκεκριμένων προϊόντων (προαιρετικό):</p>
                <input
                  className="orders-search" style={{ marginTop: 4 }}
                  placeholder="Αναζήτηση προϊόντος για εξαίρεση…"
                  value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
                />
                <div className="promo-picker__list">
                  {excludableProducts.map((p) => (
                    <label key={p.id} className="promo-picker__item">
                      <input
                        type="checkbox"
                        checked={editing.excludedProductIds.includes(p.id)}
                        onChange={(e) => patchForm({
                          excludedProductIds: e.target.checked
                            ? [...editing.excludedProductIds, p.id]
                            : editing.excludedProductIds.filter((id) => id !== p.id),
                        })}
                      />
                      <span>{p.title}</span>
                    </label>
                  ))}
                  {!excludableProducts.length && (
                    <p className="empty">
                      {editing.targetMode === "category" && !editing.categoryIds.length
                        ? "Διάλεξε πρώτα κατηγορίες παραπάνω."
                        : "Δεν βρέθηκαν προϊόντα."}
                    </p>
                  )}
                </div>
                <p className="field-hint">
                  {editing.targetMode === "category"
                    ? "Δείχνει μόνο τα προϊόντα των κατηγοριών που επέλεξες — αυτά είναι που αφορά η έκπτωση."
                    : "π.χ. θες −20% σε όλα εκτός από το «Mirror Candle Ασημί» επειδή έχει ήδη περιορισμένο απόθεμα — τσέκαρε το εδώ."}
                </p>
              </div>
            )}
          </div>

          <div className="promo-step">
            <h4>4. Διάρκεια</h4>
            <div className="npgrid">
              <label className="field"><span>Έναρξη (προαιρετικό)</span>
                <input type="datetime-local" value={editing.startsAt} onChange={(e) => patchForm({ startsAt: e.target.value })} />
                <p className="field-hint">Άφησέ το κενό για άμεση έναρξη. Βάλε ημερομηνία/ώρα στο μέλλον αν θες να ενεργοποιηθεί μόνη της αργότερα (κατάσταση «Προγραμματισμένη»).</p>
              </label>
              <label className="field"><span>Λήξη (προαιρετικό)</span>
                <input type="datetime-local" value={editing.endsAt} onChange={(e) => patchForm({ endsAt: e.target.value })} />
                <p className="field-hint">Άφησέ το κενό για έκπτωση χωρίς λήξη (μέχρι να την σταματήσεις εσύ χειροκίνητα).</p>
              </label>
              <label className="field"><span>Προτεραιότητα</span>
                <input type="number" value={editing.priority} onChange={(e) => patchForm({ priority: e.target.value })} />
                <p className="field-hint">Χρησιμοποιείται ΜΟΝΟ αν δύο εκπτώσεις καταλήγουν στην ίδια ακριβώς τιμή για το ίδιο προϊόν — κερδίζει η μεγαλύτερη προτεραιότητα. Άφησέ το στο 100 αν δεν έχεις άλλες εκπτώσεις που να συγκρούονται.</p>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" type="button" onClick={runPreview} disabled={busy}>Προεπισκόπηση</button>
            <button className="btn btn--primary" type="button" onClick={() => save(canSubmit && requiresConfirm)} disabled={busy || !canSubmit}>
              {editing.id != null ? "Αποθήκευση" : "Δημιουργία"}
            </button>
            <button className="btn btn--ghost" type="button" onClick={closeForm}>Ακύρωση</button>
          </div>
          {msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}

          {preview && (
            <div className="promo-preview">
              <p>
                Η έκπτωση θα εφαρμοστεί σε <strong>{preview.matchedCount}</strong> προϊόντα.
                {preview.priceRange && (
                  <> Εύρος νέων τιμών: <strong>{money(preview.priceRange.min)} – {money(preview.priceRange.max)}</strong>.</>
                )}
              </p>
              {(preview.excludedNewCount > 0 || preview.excludedProductCount > 0) && (
                <p className="muted">
                  Εξαιρέθηκαν: {preview.excludedNewCount > 0 && <>{preview.excludedNewCount} νέα προϊόντα </>}
                  {preview.excludedProductCount > 0 && <>· {preview.excludedProductCount} χειροκίνητες εξαιρέσεις</>}
                </p>
              )}
              {preview.conflictCount > 0 && (
                <p style={{ color: "var(--danger)" }}>
                  ⚠ {preview.conflictCount} προϊόντα έχουν ήδη καλύτερη ή ίση έκπτωση από άλλη ενεργή προσφορά — δεν θα αλλάξουν τιμή.
                </p>
              )}
              {preview.rows.length > 0 && (
                <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 8 }}>
                  <table className="tbl">
                    <thead><tr><th>Προϊόν</th><th>Κανονική τιμή</th><th>Νέα τιμή</th><th></th></tr></thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.title}</td>
                          <td className="muted">{money(r.regularPrice)}</td>
                          <td style={{ color: "var(--gold)", fontWeight: 600 }}>{money(r.newPrice)}</td>
                          <td>{r.conflict && <span className="obadge obadge--orange">Σύγκρουση</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {requiresConfirm && (
                <div className="promo-confirm">
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>
                    Πρόκειται να ενεργοποιήσετε έκπτωση {discountLabel({ discountType: editing.discountType, discountValue: Number(editing.discountValue) })} σε {preview.matchedCount} προϊόντα.
                    Η ενέργεια θα αλλάξει τις εμφανιζόμενες τιμές στο e-shop.
                  </p>
                  <label className="field" style={{ maxWidth: 320 }}>
                    <span>Πληκτρολόγησε ΕΝΕΡΓΟΠΟΙΗΣΗ για επιβεβαίωση</span>
                    <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ΕΝΕΡΓΟΠΟΙΗΣΗ" />
                  </label>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
