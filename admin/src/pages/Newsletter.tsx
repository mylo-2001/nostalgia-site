import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

interface Subscriber { email: string; firstname?: string; lastname?: string; source?: string; createdAt: string; }

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

  async function remove(email: string) {
    if (!window.confirm("Διαγραφή εγγραφής " + email + ";")) return;
    const res = await api.del("/api/admin/newsletter/" + encodeURIComponent(email));
    if (res.ok) load();
  }

  return (
    <div>
      <h2 className="main__title">Newsletter</h2>
      {subs.length ? (
        <table className="tbl">
          <thead><tr><th>Email</th><th>Όνομα</th><th>Πηγή</th><th>Ημ/νία</th><th></th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.email}>
                <td>{s.email}</td>
                <td>{[s.firstname, s.lastname].filter(Boolean).join(" ") || "—"}</td>
                <td className="muted">{s.source || "site"}</td>
                <td className="muted">{fmtDate(s.createdAt)}</td>
                <td><button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => remove(s.email)}>Διαγρ.</button></td>
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
