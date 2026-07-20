import { useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

interface AdminUser { email: string; firstname: string; lastname: string; newsletterOptin?: boolean; createdAt: string; }

export function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    api.get(`/api/admin/users?page=${page}&limit=50`).then((res) => {
      if (res.ok) {
        setUsers((res.users as AdminUser[]) || []);
        const p = res.pagination as { pages?: number } | undefined;
        setPages(p?.pages || 1);
      }
    });
  }, [page]);

  return (
    <div>
      <h2 className="main__title">Πελάτες</h2>
      {users.length ? (
        <table className="tbl">
          <thead><tr><th>Όνομα</th><th>Email</th><th>Newsletter</th><th>Εγγραφή</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td>{u.firstname} {u.lastname}</td>
                <td>{u.email}</td>
                <td>{u.newsletterOptin ? "Ναι" : "—"}</td>
                <td className="muted">{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="empty">Δεν υπάρχουν πελάτες.</p>}
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
