import { useState } from "react";
import { api } from "../api/client";
import { money } from "../lib/format";

interface PricePeriod {
  id: number;
  price: number;
  regularPrice: number;
  sourceType: "manual" | "promotion" | null;
  sourceId: string | null;
  validFrom: string;
  validTo: string | null;
}

function sourceLabel(period: PricePeriod): string {
  if (period.sourceType === "promotion") return `Προσφορά${period.sourceId ? ` #${period.sourceId}` : ""}`;
  if (period.sourceType === "manual") return "Χειροκίνητη έκπτωση";
  return "Κανονική τιμή";
}

export function PriceHistory({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [periods, setPeriods] = useState<PricePeriod[]>([]);
  const [error, setError] = useState("");

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    setError("");
    const result = await api.get(`/api/admin/products/${encodeURIComponent(itemId)}/price-history?days=90`);
    setLoading(false);
    if (!result.ok) {
      setError("Δεν ήταν δυνατή η φόρτωση του ιστορικού τιμών.");
      return;
    }
    setPeriods((result.history as PricePeriod[]) || []);
  }

  return (
    <div className="price-history">
      <button className="btn btn--small btn--ghost" type="button" aria-expanded={open} onClick={toggle}>
        {open ? "Κλείσιμο ιστορικού" : "Ιστορικό τιμών"}
      </button>
      {open ? (
        <div className="price-history__body">
          {loading ? <p className="muted">Φόρτωση…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {!loading && !error && !periods.length ? <p className="muted">Δεν έχει καταγραφεί ακόμη δημόσια εφαρμοσμένη τιμή.</p> : null}
          {periods.length ? (
            <div className="table-wrap">
              <table className="data-table price-history__table">
                <thead><tr><th>Εφαρμοσμένη</th><th>Κανονική</th><th>Πηγή</th><th>Από</th><th>Έως</th></tr></thead>
                <tbody>{periods.map((period) => (
                  <tr key={period.id}>
                    <td>{money(period.price)}</td>
                    <td>{money(period.regularPrice)}</td>
                    <td>{sourceLabel(period)}</td>
                    <td>{new Date(period.validFrom).toLocaleString("el-GR")}</td>
                    <td>{period.validTo ? new Date(period.validTo).toLocaleString("el-GR") : "Τώρα"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
