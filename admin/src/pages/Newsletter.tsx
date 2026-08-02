import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

interface Subscriber {
  email: string;
  firstname?: string;
  lastname?: string;
  source: string;
  status: "subscribed" | "unsubscribed";
  consentedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

const SOURCE_LABEL: Record<string, string> = {
  register: "Εγγραφή λογαριασμού",
  account: "Ρυθμίσεις λογαριασμού",
  site: "Φόρμα ιστοσελίδας",
  "welcome-offer": "Προσφορά καλωσορίσματος",
};

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] || source;
}

export function Newsletter() {
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(() => {
    api.get(`/api/admin/newsletter?page=${page}&limit=50`).then((res) => {
      if (res.ok) {
        setSubs((res.subscribers as Subscriber[]) || []);
        const p = res.pagination as { pages?: number } | undefined;
        setPages(p?.pages || 1);
      }
    });
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function unsubscribe(email: string) {
    if (!window.confirm("Απεγγραφή του " + email + " από το newsletter;")) return;
    const res = await api.patch("/api/admin/newsletter/" + encodeURIComponent(email), { status: "unsubscribed" });
    if (res.ok) load();
  }

  return (
    <div>
      <h2 className="main__title">Newsletter</h2>
      {subs.length ? (
        <table className="tbl">
          <thead>
            <tr><th>Email</th><th>Όνομα</th><th>Κατάσταση</th><th>Πηγή</th><th>Συγκατάθεση</th><th></th></tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.email}>
                <td>{s.email}</td>
                <td>{[s.firstname, s.lastname].filter(Boolean).join(" ") || "—"}</td>
                <td>
                  <span className={"obadge obadge--" + (s.status === "subscribed" ? "green" : "grey")}>
                    {s.status === "subscribed" ? "Ενεργός" : "Απεγγεγραμμένος"}
                  </span>
                </td>
                <td className="muted">{sourceLabel(s.source)}</td>
                <td className="muted">
                  {s.status === "subscribed"
                    ? (s.consentedAt ? fmtDate(s.consentedAt) : "—")
                    : (s.unsubscribedAt ? "Απεγγραφή " + fmtDate(s.unsubscribedAt) : "—")}
                </td>
                <td>
                  {s.status === "subscribed" && (
                    <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => unsubscribe(s.email)}>
                      Απεγγραφή
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="empty">Καμία εγγραφή.</p>}
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
