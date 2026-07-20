import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

interface AuditEvent {
  id: string | number;
  type: string;
  actor?: string | null;
  ip?: string | null;
  meta?: unknown;
  created_at: string;
}

interface Pagination {
  page: number;
  pages: number;
  total: number;
}

export function Audit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [typeInput, setTypeInput] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), limit: "50" });
    if (type) query.set("type", type);
    const result = await api.get(`/api/admin/audit?${query.toString()}`);
    setLoading(false);
    if (!result.ok) {
      setError(`Το αρχείο ενεργειών δεν φορτώθηκε (${result.error || result.status}).`);
      return;
    }
    setEvents((result.events as AuditEvent[]) || []);
    setPagination((result.pagination as Pagination) || { page, pages: 1, total: 0 });
  }, [page, type]);

  useEffect(() => { void load(); }, [load]);

  function filter(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setType(typeInput.trim());
  }

  return (
    <div>
      <div className="page-heading">
        <div><h2 className="main__title">Αρχείο ενεργειών</h2><p className="muted">Καταγραφή συνδέσεων και κρίσιμων ενεργειών διαχείρισης.</p></div>
        <button className="btn btn--small" type="button" onClick={() => void load()} disabled={loading}>Ανανέωση</button>
      </div>

      <form className="audit-toolbar" onSubmit={filter}>
        <label className="field"><span>Ακριβής τύπος ενέργειας</span><input value={typeInput} onChange={(event) => setTypeInput(event.target.value)} placeholder="π.χ. admin.login.success" /></label>
        <button className="btn btn--primary" type="submit">Φιλτράρισμα</button>
        {type ? <button className="btn btn--ghost" type="button" onClick={() => { setTypeInput(""); setType(""); setPage(1); }}>Καθαρισμός</button> : null}
      </form>

      {error ? <p className="error" role="alert">{error}</p> : null}
      {loading && !events.length ? <p className="empty">Φόρτωση…</p> : null}
      <div className="audit-list">
        {events.map((event) => (
          <article className="audit-row" key={event.id}>
            <div className="audit-row__main">
              <strong>{event.type}</strong>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("el-GR")}</time>
            </div>
            <div className="audit-row__context">
              <span>Χρήστης: {event.actor || "σύστημα"}</span>
              {event.ip ? <span>IP: {event.ip}</span> : null}
              <span>ID: {event.id}</span>
            </div>
            {event.meta ? <details><summary>Λεπτομέρειες</summary><pre>{typeof event.meta === "string" ? event.meta : JSON.stringify(event.meta, null, 2)}</pre></details> : null}
          </article>
        ))}
      </div>
      {!loading && !events.length && !error ? <p className="empty">Δεν υπάρχουν καταγεγραμμένες ενέργειες.</p> : null}

      <div className="pager">
        <button className="btn btn--small" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Προηγούμενη</button>
        <span className="muted">Σελίδα {pagination.page} / {pagination.pages} · {pagination.total} εγγραφές</span>
        <button className="btn btn--small" type="button" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>Επόμενη</button>
      </div>
    </div>
  );
}
