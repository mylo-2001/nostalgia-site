import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { ProductContentEditor } from "../components/ProductContentEditor";
import { ProductVariants } from "../components/ProductVariants";
import { PriceHistory } from "../components/PriceHistory";
import type { AdminProduct } from "../types/product";
import { money } from "../lib/format";

function saleActive(p: AdminProduct): boolean {
  if (p.salePrice == null || p.price == null) return false;
  if (p.salePrice <= 0 || p.salePrice >= p.price) return false;
  if (p.saleUntil && new Date(p.saleUntil).getTime() < Date.now()) return false;
  return true;
}

function ProductRow({ p, onSaved }: { p: AdminProduct; onSaved: () => void }) {
  const [price, setPrice] = useState(p.price != null ? String(p.price) : "");
  const [sale, setSale] = useState(p.salePrice != null ? String(p.salePrice) : "");
  const [saleDays, setSaleDays] = useState("");
  const [stock, setStock] = useState(p.stock != null ? String(p.stock) : "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);

  useEffect(() => {
    setPrice(p.price != null ? String(p.price) : "");
    setSale(p.salePrice != null ? String(p.salePrice) : "");
    setStock(p.stock != null ? String(p.stock) : "");
  }, [p.price, p.salePrice, p.stock]);

  async function save() {
    setBusy(true);
    const body: Record<string, unknown> = {
      price: price === "" ? null : price,
      salePrice: sale === "" ? null : sale,
      stock: stock === "" ? null : stock,
    };
    if (saleDays !== "") body.saleDays = saleDays;
    const res = await api.patch("/api/admin/products/" + p.id, body);
    setBusy(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); onSaved(); }
    else window.alert("Σφάλμα αποθήκευσης: " + (res.error || res.status));
  }

  async function toggleActive() {
    setBusy(true);
    const activating = p.active === false;
    const res = await api.patch("/api/admin/products/" + p.id, { active: activating, sendMarketingEmail: activating });
    setBusy(false);
    if (res.ok) onSaved();
  }
  async function del() {
    if (!window.confirm("Διαγραφή προϊόντος «" + p.title + "»;")) return;
    setBusy(true);
    const res = await api.del("/api/admin/products/" + p.id);
    setBusy(false);
    if (res.ok) onSaved();
  }

  const productImage = p.image && /^(?:https?:|data:)/i.test(p.image)
    ? p.image
    : p.image ? "/" + p.image.replace(/^\/+/, "") : "";

  return (
    <div className="product-entry">
      <div className="prow">
        {productImage ? <img className="prow__img" src={productImage} alt="" loading="lazy" /> : <span className="prow__img prow__img--empty">—</span>}
        <div className="prow__id">
          <strong>{p.title}</strong>
          <span className="muted">{p.id}{p.custom ? " · custom" : ""}{p.variants?.length ? " · " + p.variants.length + " χρώματα" : ""}</span>
          {saleActive(p) ? <span className="obadge obadge--red" style={{ marginTop: 4 }}>σε έκπτωση {money(p.salePrice)}</span> : null}
        </div>
        <label className="pfield">Τιμή €<input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="—" /></label>
        <label className="pfield">Έκπτ. €<input type="number" min="0" step="0.01" value={sale} onChange={(e) => setSale(e.target.value)} placeholder="—" /></label>
        <label className="pfield">Μέρες<input type="number" min="1" max="3650" value={saleDays} onChange={(e) => setSaleDays(e.target.value)} placeholder={p.saleUntil ? "λήγει " + new Date(p.saleUntil).toLocaleDateString("el-GR") : "—"} /></label>
        <label className="pfield">Stock<input type="number" min="0" max="9999" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="∞" /></label>
        <div className="prow__actions">
          <button className={"btn btn--small " + (saved ? "" : "btn--primary")} type="button" disabled={busy} onClick={save}>{saved ? "✓" : "OK"}</button>
          <button className="btn btn--small btn--ghost" type="button" aria-expanded={contentOpen} onClick={() => setContentOpen((open) => !open)}>
            {contentOpen ? "Κλείσιμο περιεχομένου" : "Περιεχόμενο"}
          </button>
          <button className="btn btn--small btn--ghost" type="button" aria-expanded={variantsOpen} onClick={() => setVariantsOpen((open) => !open)}>
            {variantsOpen ? "Κλείσιμο" : `Παραλλαγές (${p.variants?.length || 0})`}
          </button>
          {p.custom ? <>
            <button className="btn btn--small btn--ghost" type="button" disabled={busy} onClick={toggleActive}>{p.active === false ? "Ενεργ." : "Απόκρ."}</button>
            <button className="btn btn--small" type="button" style={{ color: "var(--danger)" }} disabled={busy} onClick={del}>Διαγρ.</button>
          </> : null}
        </div>
      </div>
      {contentOpen ? <ProductContentEditor product={p} onSaved={onSaved} /> : null}
      {variantsOpen ? <ProductVariants product={p} onChanged={onSaved} /> : null}
      <PriceHistory itemId={p.id} />
    </div>
  );
}

export function Products() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get("/api/admin/products");
    setLoading(false);
    if (res.ok) setProducts((res.products as AdminProduct[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const norm = q.trim().toLowerCase();
    const filtered = norm
      ? products.filter((p) => (p.title + " " + p.id).toLowerCase().includes(norm))
      : products;
    const byCat: Record<string, { label: string; items: AdminProduct[] }> = {};
    filtered.forEach((p) => {
      const key = p.catId || "other";
      if (!byCat[key]) byCat[key] = { label: p.category || key, items: [] };
      byCat[key].items.push(p);
    });
    return Object.keys(byCat).sort().map((k) => byCat[k]);
  }, [products, q]);

  return (
    <div>
      <h2 className="main__title">Προϊόντα & Stock</h2>
      <input className="orders-search" type="search" placeholder="Αναζήτηση προϊόντος (τίτλος ή κωδικός)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 16 }} />
      {loading && !products.length ? <p className="muted">Φόρτωση…</p> : null}
      {groups.map((g) => (
        <details key={g.label} className="pgroup" open>
          <summary>{g.label} <span className="muted">({g.items.length})</span></summary>
          <div className="plist">
            {g.items.map((p) => <ProductRow key={p.id} p={p} onSaved={load} />)}
          </div>
        </details>
      ))}
      {!loading && !products.length ? <p className="empty">Δεν βρέθηκαν προϊόντα.</p> : null}
    </div>
  );
}
