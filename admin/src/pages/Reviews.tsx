import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

interface Review {
  id: string; productId: string; productTitle?: string; name: string;
  rating: number; title?: string; text: string; status: "pending" | "approved" | "rejected"; createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "Εκκρεμεί", color: "orange" },
  approved: { label: "Εγκρίθηκε", color: "green" },
  rejected: { label: "Απορρίφθηκε", color: "grey" },
};

export function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const load = useCallback(() => {
    api.get("/api/admin/reviews").then((res) => { if (res.ok) setReviews((res.reviews as Review[]) || []); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(r: Review, status: Review["status"]) {
    const res = await api.patch("/api/admin/reviews/" + r.id, { status });
    if (res.ok) load();
  }
  async function remove(r: Review) {
    if (!window.confirm("Διαγραφή κριτικής;")) return;
    const res = await api.del("/api/admin/reviews/" + r.id);
    if (res.ok) load();
  }

  return (
    <div>
      <h2 className="main__title">Κριτικές</h2>
      {reviews.length ? (
        <div className="otable">
          {reviews.map((r) => {
            const s = STATUS_LABEL[r.status] ?? { label: r.status, color: "grey" };
            return (
              <div className="orow" key={r.id}>
                <div style={{ padding: "12px 14px" }}>
                  <div className="orow__main">
                    <span className="orow__cust">{r.name}</span>
                    <span style={{ color: "var(--gold)" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="muted">{r.productTitle || r.productId}</span>
                    <span className={"obadge obadge--" + s.color}>{s.label}</span>
                    <span className="orow__date">{fmtDate(r.createdAt)}</span>
                  </div>
                  {r.title ? <p style={{ margin: "6px 0 2px", fontWeight: 600 }}>{r.title}</p> : null}
                  <p style={{ margin: "2px 0 10px", fontSize: 13.5 }}>{r.text}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {r.status !== "approved" && <button className="btn btn--small btn--primary" onClick={() => setStatus(r, "approved")}>Έγκριση</button>}
                    {r.status !== "rejected" && <button className="btn btn--small btn--ghost" onClick={() => setStatus(r, "rejected")}>Απόρριψη</button>}
                    <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => remove(r)}>Διαγραφή</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="empty">Καμία κριτική.</p>}
    </div>
  );
}
