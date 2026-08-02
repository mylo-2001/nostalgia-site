import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

interface Coupon {
  code: string; name: string; type: "percent" | "fixed"; value: number;
  active: boolean; expiresAt: string | null; uses: number; maxUses: number | null; freeShipping: boolean; createdAt: string;
  oncePerCustomer?: boolean; firstOrderOnly?: boolean; autoIssued?: boolean;
}

export function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [maxUses, setMaxUses] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [oncePerCustomer, setOncePerCustomer] = useState(false);
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/api/admin/coupons").then((res) => { if (res.ok) setCoupons((res.coupons as Coupon[]) || []); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const res = await api.post("/api/admin/coupons", {
      code, name, type, value, freeShipping, oncePerCustomer, firstOrderOnly,
      maxUses: maxUses || undefined, durationDays: durationDays || undefined,
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Το κουπόνι δημιουργήθηκε.");
      setCode(""); setName(""); setValue(""); setMaxUses(""); setDurationDays(""); setFreeShipping(false);
      setOncePerCustomer(false); setFirstOrderOnly(false);
      load();
    } else setMsg("Σφάλμα: " + (res.error || res.status));
  }
  async function toggle(c: Coupon) {
    const res = await api.patch("/api/admin/coupons/" + encodeURIComponent(c.code), { active: !c.active });
    if (res.ok) load();
  }
  async function remove(c: Coupon) {
    if (!window.confirm("Διαγραφή κουπονιού " + c.code + ";")) return;
    const res = await api.del("/api/admin/coupons/" + encodeURIComponent(c.code));
    if (res.ok) load();
  }

  return (
    <div>
      <h2 className="main__title">Κουπόνια</h2>
      <form className="coupon-form" onSubmit={create}>
        <label className="field"><span>Κωδικός</span><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER10" required /></label>
        <label className="field"><span>Όνομα (προαιρετικό)</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Τύπος</span>
          <select value={type} onChange={(e) => setType(e.target.value as "percent" | "fixed")}>
            <option value="percent">Ποσοστό %</option><option value="fixed">Σταθερό €</option>
          </select>
        </label>
        <label className="field"><span>Αξία</span><input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} disabled={freeShipping && !value} /></label>
        <label className="field"><span>Μέγ. χρήσεις</span><input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="∞" /></label>
        <label className="field"><span>Διάρκεια (μέρες)</span><input type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} placeholder="χωρίς λήξη" /></label>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }} title="Το κουπόνι δίνει και δωρεάν μεταφορικά (μπορεί να συνδυαστεί με έκπτωση ή να δοθεί μόνο του με αξία 0)">
          <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} style={{ width: "auto" }} /><span>Δωρεάν μεταφορικά</span>
        </label>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }} title="Κάθε πελάτης (με βάση το email της παραγγελίας) μπορεί να το εξαργυρώσει μία μόνο φορά">
          <input type="checkbox" checked={oncePerCustomer} onChange={(e) => setOncePerCustomer(e.target.checked)} style={{ width: "auto" }} /><span>Μία χρήση ανά πελάτη</span>
        </label>
        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }} title="Ισχύει μόνο αν ο πελάτης δεν έχει καμία προηγούμενη παραγγελία">
          <input type="checkbox" checked={firstOrderOnly} onChange={(e) => setFirstOrderOnly(e.target.checked)} style={{ width: "auto" }} /><span>Μόνο 1η παραγγελία</span>
        </label>
        <button className="btn btn--primary" type="submit" disabled={busy}>Δημιουργία</button>
        {msg && <p className="muted" style={{ width: "100%" }}>{msg}</p>}
      </form>

      {coupons.length ? (
        <table className="tbl" style={{ marginTop: 18 }}>
          <thead><tr><th>Κωδικός</th><th>Έκπτωση</th><th>Χρήσεις</th><th>Λήξη</th><th>Κατάσταση</th><th></th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.code}>
                <td style={{ fontWeight: 600 }}>
                  {c.code}{c.name ? <span className="muted"> · {c.name}</span> : null}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                    {c.freeShipping && <span className="obadge obadge--blue">Δωρεάν μεταφορικά</span>}
                    {c.oncePerCustomer && <span className="obadge obadge--purple">1 ανά πελάτη</span>}
                    {c.firstOrderOnly && <span className="obadge obadge--orange">1η παραγγελία</span>}
                    {c.autoIssued && <span className="obadge obadge--slate">Αυτόματο (email)</span>}
                  </div>
                </td>
                <td>{c.freeShipping ? "Δωρεάν μεταφορικά" : c.type === "percent" ? c.value + "%" : "€" + c.value.toFixed(2)}</td>
                <td>{c.uses}{c.maxUses != null ? " / " + c.maxUses : ""}</td>
                <td className="muted">{c.expiresAt ? fmtDate(c.expiresAt) : "—"}</td>
                <td><span className={"obadge obadge--" + (c.active ? "green" : "grey")}>{c.active ? "Ενεργό" : "Ανενεργό"}</span></td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn--small btn--ghost" onClick={() => toggle(c)}>{c.active ? "Απενεργ." : "Ενεργ."}</button>
                  <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => remove(c)}>Διαγρ.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="empty" style={{ marginTop: 18 }}>Κανένα κουπόνι.</p>}
    </div>
  );
}
