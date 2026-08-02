import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

type ReviewStatus = "pending" | "approved" | "rejected" | "flagged" | "removed";

interface Reply { body: string; createdAt: string; updatedAt: string }

interface Review {
  id: string; productId: string; productTitle?: string; name: string;
  rating: number; title?: string; text: string; status: ReviewStatus;
  isVerifiedPurchase: boolean; moderationReason: string | null;
  moderatedBy: string | null; moderatedAt: string | null;
  helpfulCount: number; reply: Reply | null; createdAt: string;
}

interface Reason { code: string; label: string }

const STATUS_LABEL: Record<ReviewStatus, { label: string; color: string }> = {
  pending: { label: "Εκκρεμεί", color: "orange" },
  approved: { label: "Εγκρίθηκε", color: "green" },
  rejected: { label: "Απορρίφθηκε", color: "grey" },
  flagged: { label: "Επισημάνθηκε", color: "red" },
  removed: { label: "Αφαιρέθηκε", color: "slate" },
};

const TABS: { id: ReviewStatus; label: string }[] = [
  { id: "pending", label: "Αναμονή" },
  { id: "approved", label: "Εγκεκριμένες" },
  { id: "rejected", label: "Απορριφθείσες" },
  { id: "flagged", label: "Αναφορές" },
  { id: "removed", label: "Αφαιρεμένες" },
];

export function Reviews() {
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pickingReason, setPickingReason] = useState<{ id: string; status: ReviewStatus } | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api.get(`/api/admin/reviews?status=${tab}&page=${page}&limit=20`).then((res) => {
      if (res.ok) {
        setReviews((res.reviews as Review[]) || []);
        if (res.reasons) setReasons(res.reasons as Reason[]);
        const p = res.pagination as { pages?: number } | undefined;
        setPages(p?.pages || 1);
      }
    });
  }, [tab, page]);
  useEffect(() => { load(); }, [load]);

  function switchTab(t: ReviewStatus) {
    setTab(t);
    setPage(1);
    setPickingReason(null);
  }

  async function approve(r: Review) {
    const res = await api.patch("/api/admin/reviews/" + r.id, { status: "approved" });
    if (res.ok) load();
  }

  function startReasonPick(r: Review, status: ReviewStatus) {
    setPickingReason({ id: r.id, status });
    setReasonCode("");
  }

  async function confirmReasonAction() {
    if (!pickingReason || !reasonCode) return;
    const res = await api.patch("/api/admin/reviews/" + pickingReason.id, { status: pickingReason.status, reason: reasonCode });
    if (res.ok) {
      setPickingReason(null);
      setReasonCode("");
      load();
    }
  }

  async function saveReply(r: Review) {
    const body = (replyDrafts[r.id] ?? r.reply?.body ?? "").trim();
    if (!body) return;
    const res = await api.post("/api/admin/reviews/" + r.id + "/reply", { body });
    if (res.ok) load();
  }
  async function removeReply(r: Review) {
    if (!window.confirm("Διαγραφή απάντησης καταστήματος;")) return;
    const res = await api.del("/api/admin/reviews/" + r.id + "/reply");
    if (res.ok) load();
  }

  return (
    <div>
      <h2 className="main__title">Κριτικές</h2>

      <div className="orders-tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"otab" + (tab === t.id ? " is-active" : "")}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reviews.length ? (
        <div className="otable">
          {reviews.map((r) => {
            const s = STATUS_LABEL[r.status] ?? { label: r.status, color: "grey" };
            const picking = pickingReason && pickingReason.id === r.id;
            return (
              <div className="orow" key={r.id}>
                <div style={{ padding: "12px 14px" }}>
                  <div className="orow__main">
                    <span className="orow__cust">{r.name}</span>
                    <span style={{ color: "var(--gold)" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="muted">{r.productTitle || r.productId}</span>
                    {r.isVerifiedPurchase && <span className="obadge obadge--green">✓ Επιβεβαιωμένη</span>}
                    <span className={"obadge obadge--" + s.color}>{s.label}</span>
                    <span className="orow__date">{fmtDate(r.createdAt)}</span>
                  </div>
                  {r.title ? <p style={{ margin: "6px 0 2px", fontWeight: 600 }}>{r.title}</p> : null}
                  <p style={{ margin: "2px 0 10px", fontSize: 13.5 }}>{r.text}</p>

                  {r.moderationReason && (
                    <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                      Λόγος: {reasons.find((x) => x.code === r.moderationReason)?.label || r.moderationReason}
                      {r.moderatedBy ? ` · ${r.moderatedBy}` : ""}{r.moderatedAt ? ` · ${fmtDate(r.moderatedAt)}` : ""}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {r.status !== "approved" && <button className="btn btn--small btn--primary" onClick={() => approve(r)}>Έγκριση</button>}
                    {r.status !== "rejected" && <button className="btn btn--small btn--ghost" onClick={() => startReasonPick(r, "rejected")}>Απόρριψη</button>}
                    {r.status !== "flagged" && <button className="btn btn--small btn--ghost" onClick={() => startReasonPick(r, "flagged")}>Επισήμανση</button>}
                    {r.status === "approved" && <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => startReasonPick(r, "removed")}>Αφαίρεση</button>}
                  </div>

                  {picking && (
                    <div className="promo-confirm" style={{ marginTop: 10 }}>
                      <label className="field" style={{ maxWidth: 340 }}>
                        <span>Λόγος ({pickingReason.status === "rejected" ? "απόρριψη" : pickingReason.status === "flagged" ? "επισήμανση" : "αφαίρεση"})</span>
                        <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                          <option value="">— επίλεξε λόγο —</option>
                          {reasons.map((rs) => <option key={rs.code} value={rs.code}>{rs.label}</option>)}
                        </select>
                      </label>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button className="btn btn--small btn--primary" disabled={!reasonCode} onClick={confirmReasonAction}>Επιβεβαίωση</button>
                        <button className="btn btn--small btn--ghost" onClick={() => setPickingReason(null)}>Ακύρωση</button>
                      </div>
                    </div>
                  )}

                  {r.status === "approved" && (
                    <div style={{ marginTop: 10 }}>
                      {r.reply && !replyDrafts[r.id] ? (
                        <div className="odetail" style={{ gridTemplateColumns: "1fr", padding: "10px 12px" }}>
                          <p className="muted" style={{ margin: 0, fontSize: 12 }}>Απάντηση καταστήματος</p>
                          <p style={{ margin: "4px 0" }}>{r.reply.body}</p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn--small btn--ghost" onClick={() => setReplyDrafts((d) => ({ ...d, [r.id]: r.reply!.body }))}>Επεξεργασία</button>
                            <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => removeReply(r)}>Διαγραφή απάντησης</button>
                          </div>
                        </div>
                      ) : (
                        <div className="odetail" style={{ gridTemplateColumns: "1fr", padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <textarea
                            style={{ flex: "1 1 260px", minHeight: 60 }}
                            placeholder="Δημόσια απάντηση καταστήματος…"
                            value={replyDrafts[r.id] ?? r.reply?.body ?? ""}
                            onChange={(e) => setReplyDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                          />
                          <button className="btn btn--small btn--primary" onClick={() => saveReply(r)}>Αποστολή</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="empty">Καμία κριτική.</p>}

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn--small btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="muted">{page} / {pages}</span>
          <button className="btn btn--small btn--ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
