import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

interface AdminUser {
  email: string;
  firstname: string;
  lastname: string;
  newsletterOptin?: boolean;
  active: boolean;
  orderCount: number;
  lastOrderAt: string | null;
  createdAt: string;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.length > 12 ? local.slice(0, 12) : local.slice(0, Math.max(1, local.length - 1));
  return visible + "…" + domain;
}

export function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const load = useCallback((p: number) => {
    api.get(`/api/admin/users?page=${p}&limit=50`).then((res) => {
      if (res.ok) {
        setUsers((res.users as AdminUser[]) || []);
        const pg = res.pagination as { pages?: number } | undefined;
        setPages(pg?.pages || 1);
      }
    });
  }, []);
  useEffect(() => { load(page); }, [load, page]);

  function toggleReveal(email: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  async function toggleActive(u: AdminUser) {
    const makeActive = !u.active;
    const verb = makeActive ? "Ενεργοποίηση" : "Απενεργοποίηση";
    if (!window.confirm(`${verb} του λογαριασμού «${u.firstname} ${u.lastname}»;`)) return;
    setBusyEmail(u.email);
    const res = await api.patch("/api/admin/users/" + encodeURIComponent(u.email), { active: makeActive });
    setBusyEmail(null);
    if (res.ok) load(page);
  }

  return (
    <div>
      <h2 className="main__title">Πελάτες</h2>
      {users.length ? (
        <table className="tbl">
          <thead>
            <tr>
              <th>Πελάτης</th><th>Email</th><th>Newsletter</th><th>Παραγγελίες</th>
              <th>Κατάσταση</th><th>Εγγραφή</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isRevealed = revealed.has(u.email);
              return (
                <tr key={u.email}>
                  <td>{u.firstname} {u.lastname}</td>
                  <td>
                    <span style={{ fontFamily: isRevealed ? "inherit" : "monospace" }}>
                      {isRevealed ? u.email : maskEmail(u.email)}
                    </span>
                  </td>
                  <td>{u.newsletterOptin ? <span className="obadge obadge--green">Ναι</span> : "—"}</td>
                  <td>
                    {u.orderCount}
                    {u.lastOrderAt && <span className="muted"> · τελευταία {fmtDate(u.lastOrderAt)}</span>}
                  </td>
                  <td><span className={"obadge obadge--" + (u.active ? "green" : "grey")}>{u.active ? "Ενεργός" : "Ανενεργός"}</span></td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn--small btn--ghost" onClick={() => toggleReveal(u.email)}>
                      {isRevealed ? "Απόκρυψη" : "Προβολή"}
                    </button>
                    {isRevealed && (
                      <button
                        className="btn btn--small"
                        style={{ color: u.active ? "var(--danger)" : "var(--ok)" }}
                        disabled={busyEmail === u.email}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <p className="empty">Δεν υπάρχουν πελάτες.</p>}
      {pages > 1 && (
        <div className="pager">
          <button className="btn btn--small btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="muted">{page} / {pages}</span>
          <button className="btn btn--small btn--ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
