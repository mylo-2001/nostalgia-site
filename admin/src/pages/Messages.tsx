import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

interface Message {
  id: string; firstName?: string; lastName?: string; email: string; phone?: string;
  country?: string; subject?: string; message: string; read: boolean; at: string;
  attachmentName?: string; attachmentMime?: string; attachmentSize?: number;
}

export function Messages() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<Record<string, boolean>>({});
  const [replyStatus, setReplyStatus] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api.get(`/api/admin/messages?page=${page}&limit=50`).then((res) => {
      if (res.ok) {
        setMsgs((res.messages as Message[]) || []);
        const p = res.pagination as { pages?: number } | undefined;
        setPages(p?.pages || 1);
      }
    });
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function setRead(m: Message, read: boolean) {
    const res = await api.patch("/api/admin/messages/" + m.id, { read });
    if (res.ok) load();
  }
  async function remove(m: Message) {
    if (!window.confirm("Διαγραφή μηνύματος;")) return;
    const res = await api.del("/api/admin/messages/" + m.id);
    if (res.ok) load();
  }
  async function reply(m: Message) {
    const body = (replyDrafts[m.id] || "").trim();
    if (!body) { setReplyStatus((s) => ({ ...s, [m.id]: "Γράψε πρώτα την απάντηση." })); return; }
    setReplyBusy((b) => ({ ...b, [m.id]: true }));
    setReplyStatus((s) => ({ ...s, [m.id]: "" }));
    const res = await api.post("/api/admin/messages/" + m.id + "/reply", { body });
    setReplyBusy((b) => ({ ...b, [m.id]: false }));
    if (res.ok) {
      setReplyDrafts((d) => ({ ...d, [m.id]: "" }));
      setReplyStatus((s) => ({ ...s, [m.id]: "Η απάντηση στάλθηκε επιτυχώς." }));
    } else setReplyStatus((s) => ({ ...s, [m.id]: "Αποτυχία αποστολής: " + (res.error || res.status) }));
  }

  return (
    <div>
      <h2 className="main__title">Μηνύματα</h2>
      {msgs.length ? (
        <div className="otable">
          {msgs.map((m) => (
            <div className="orow" key={m.id} style={m.read ? undefined : { borderColor: "var(--gold)" }}>
              <div className="orow__head" onClick={() => { setOpen((o) => ({ ...o, [m.id]: !o[m.id] })); if (!m.read) setRead(m, true); }}>
                <div className="orow__main">
                  {!m.read ? <span className="obadge obadge--orange">Νέο</span> : null}
                  <span className="orow__cust">{[m.firstName, m.lastName].filter(Boolean).join(" ") || m.email}</span>
                  <span className="muted">{m.subject || "—"}</span>
                  <span className="orow__date">{fmtDate(m.at)}</span>
                  <span className="orow__toggle">{open[m.id] ? "▲" : "Άνοιγμα ▾"}</span>
                </div>
              </div>
              {open[m.id] && (
                <div className="odetail" style={{ gridTemplateColumns: "1fr" }}>
                  <section className="osec osec--wide">
                    <p>{m.email}{m.phone ? " · " + m.phone : ""}{m.country ? " · " + m.country : ""}</p>
                    <p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p>
                    {m.attachmentName ? (
                      <p style={{ marginTop: 10 }}>
                        <a className="btn btn--small btn--ghost" href={`/api/admin/messages/${m.id}/attachment`}>
                          Λήψη συνημμένου: {m.attachmentName}{m.attachmentSize ? ` (${Math.ceil(m.attachmentSize / 1024)} KB)` : ""}
                        </a>
                      </p>
                    ) : null}
                    <label className="field" style={{ marginTop: 14 }}>
                      <span>Απάντηση στον πελάτη</span>
                      <textarea rows={5} value={replyDrafts[m.id] || ""} onChange={(e) => setReplyDrafts((d) => ({ ...d, [m.id]: e.target.value }))} placeholder="Γράψε την απάντησή σου…" />
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button className="btn btn--small btn--primary" disabled={!!replyBusy[m.id]} onClick={() => reply(m)}>{replyBusy[m.id] ? "Αποστολή…" : "Αποστολή απάντησης"}</button>
                      <a className="btn btn--small btn--ghost" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || "")}`}>Άνοιγμα Gmail</a>
                      <button className="btn btn--small btn--ghost" onClick={() => setRead(m, !m.read)}>{m.read ? "Σήμανση αδιάβαστου" : "Σήμανση ως διαβασμένο"}</button>
                      <button className="btn btn--small" style={{ color: "var(--danger)" }} onClick={() => remove(m)}>Διαγραφή</button>
                    </div>
                    {replyStatus[m.id] ? <p className="muted" role="status">{replyStatus[m.id]}</p> : null}
                  </section>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : <p className="empty">Κανένα μήνυμα.</p>}
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
