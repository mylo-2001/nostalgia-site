import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtDate } from "../lib/format";

type Kind = "service" | "marketing";

interface Announcement {
  id: string;
  kind: Kind;
  subject: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  failures: { email: string; error: string }[];
  createdAt: string;
  sentAt: string | null;
}

interface SendResult {
  sent: number;
  failed: number;
  total: number;
  skipped?: string;
}

interface Template {
  id: string;
  label: string;
  kind: Kind;
  subject: string;
  heading: string;
  subheading?: string;
  body: string;
  calloutTitle?: string;
  calloutItems?: string;
  showContacts?: boolean;
  note?: string;
}

/* Starting points, not finished copy — every one of these is meant to be
   edited before it goes out. The phishing notice is deliberately specific:
   a vague "beware of scams" teaches nobody what to look for. */
const TEMPLATES: Template[] = [
  {
    id: "phishing",
    label: "⚠️ Προειδοποίηση phishing",
    kind: "service",
    subject: "Σημαντικό: παραπλανητικά email στο όνομά μας",
    heading: "Προειδοποίηση Ασφάλειας",
    subheading:
      "Προσοχή σε παραπλανητικά email ή μηνύματα που χρησιμοποιούν το όνομα της Nostalgia Candle.",
    body:
      "Παρατηρήσαμε ότι κυκλοφορούν παραπλανητικά email ή μηνύματα που ενδέχεται να " +
      "χρησιμοποιούν το όνομα ή παρόμοια στοιχεία της Nostalgia Candle. Σας προτρέπουμε να " +
      "είστε ιδιαίτερα προσεκτικοί πριν πατήσετε σε συνδέσμους ή κοινοποιήσετε προσωπικά στοιχεία.",
    calloutTitle: "Τι να προσέχετε",
    calloutItems:
      "Μην ανοίγετε ύποπτους συνδέσμους ή συνημμένα αρχεία\n" +
      "Ελέγχετε πάντα τη διεύθυνση αποστολέα\n" +
      "Δεν ζητάμε ποτέ κωδικούς ή στοιχεία κάρτας μέσω email\n" +
      "Αν έχετε αμφιβολία, επικοινωνήστε πρώτα μαζί μας",
    showContacts: true,
    note: "Αν λάβετε ύποπτο μήνυμα, προωθήστε το σε ένα από τα επίσημα email μας για έλεγχο.",
  },
  {
    id: "delays",
    label: "Καθυστερήσεις αποστολών",
    kind: "service",
    subject: "Ενημέρωση για τις αποστολές",
    heading: "Μικρή καθυστέρηση στις αποστολές",
    body:
      "Λόγω αυξημένου όγκου παραγγελιών, οι αποστολές αυτή την περίοδο ενδέχεται να " +
      "καθυστερήσουν 1–2 εργάσιμες ημέρες.\n\n" +
      "Θα λάβεις κανονικά email με τον αριθμό αποστολής μόλις φύγει το δέμα σου και " +
      "μπορείς να παρακολουθείς την πορεία του από τον σύνδεσμο της παραγγελίας σου.\n\n" +
      "Ευχαριστούμε για την υπομονή σου.",
  },
  {
    id: "closure",
    label: "Διακοπές / ωράριο",
    kind: "service",
    subject: "Ενημέρωση λειτουργίας",
    heading: "Αλλαγή στο ωράριό μας",
    body:
      "Θα παραμείνουμε κλειστά από [ΗΜΕΡΟΜΗΝΙΑ] έως [ΗΜΕΡΟΜΗΝΙΑ].\n\n" +
      "Μπορείς να παραγγέλνεις κανονικά από το site — οι αποστολές θα ξεκινήσουν ξανά " +
      "με την επιστροφή μας.\n\n" +
      "Για οτιδήποτε χρειαστείς, γράψε μας στο support@nostalgiacandle.gr.",
  },
  {
    id: "blank-service",
    label: "Κενή ενημέρωση",
    kind: "service",
    subject: "",
    heading: "",
    body: "",
  },
  {
    id: "blank-marketing",
    label: "Κενή προωθητική",
    kind: "marketing",
    subject: "",
    heading: "",
    body: "",
  },
];

const KIND_HELP: Record<Kind, string> = {
  service:
    "Ενημέρωση ασφαλείας/λειτουργίας. Φτάνει σε όσους έχουν ενεργό λογαριασμό ΚΑΙ σε " +
    "όσους είναι εγγεγραμμένοι στο newsletter — ώστε να μη μείνει απ'έξω πελάτης που " +
    "αγόρασε χωρίς λογαριασμό. Στέλνεται από support@, χωρίς σύνδεσμο απεγγραφής και " +
    "χωρίς διαφημιστικό περιεχόμενο — μην βάλεις προσφορές εδώ μέσα.",
  marketing:
    "Προωθητικό μήνυμα. Φτάνει ΜΟΝΟ σε όσους έχουν δώσει συναίνεση στο newsletter και δεν " +
    "έχουν απεγγραφεί. Στέλνεται από newsletter@, πάντα με σύνδεσμο απεγγραφής.",
};

export function Announcements() {
  const [kind, setKind] = useState<Kind>("service");
  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [subheading, setSubheading] = useState("");
  const [body, setBody] = useState("");
  const [calloutTitle, setCalloutTitle] = useState("");
  const [calloutItems, setCalloutItems] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const [note, setNote] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaText, setCtaText] = useState("");

  const [audience, setAudience] = useState<{ count: number; sample: string[] } | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<Announcement[]>([]);

  const loadAudience = useCallback(() => {
    api.get("/api/admin/announcements/audience?kind=" + kind).then((r) => {
      if (r.ok) {
        setAudience({
          count: (r.count as number) || 0,
          sample: (r.sample as string[]) || [],
        });
      }
    });
  }, [kind]);

  const loadHistory = useCallback(() => {
    api.get("/api/admin/announcements").then((r) => {
      if (r.ok) setHistory((r.announcements as Announcement[]) || []);
    });
  }, []);

  useEffect(() => { loadAudience(); }, [loadAudience]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setKind(t.kind);
    setSubject(t.subject);
    setHeading(t.heading);
    setSubheading(t.subheading || "");
    setBody(t.body);
    setCalloutTitle(t.calloutTitle || "");
    setCalloutItems(t.calloutItems || "");
    setShowContacts(!!t.showContacts);
    setNote(t.note || "");
    setPreviewHtml("");
    setMsg("");
  }

  const payload = () => ({
    kind, subject, heading, subheading, body,
    calloutTitle, calloutItems, showContacts, note, ctaUrl, ctaText,
  });

  async function preview() {
    setBusy(true); setMsg("");
    const r = await api.post("/api/admin/announcements/preview", payload());
    setBusy(false);
    if (r.ok) setPreviewHtml((r.html as string) || "");
    else setMsg("Σφάλμα προεπισκόπησης: " + (r.error || ""));
  }

  async function sendTest() {
    if (!testTo.trim()) { setMsg("Γράψε πρώτα τη διεύθυνση δοκιμής."); return; }
    setBusy(true); setMsg("");
    const r = await api.post("/api/admin/announcements/test", { ...payload(), to: testTo });
    setBusy(false);
    if (!r.ok) { setMsg("Σφάλμα δοκιμής: " + (r.error || "")); return; }
    const tr = r.result as SendResult | undefined;
    setMsg(tr?.skipped === "not_configured"
      ? "Το email δεν είναι ρυθμισμένο στον server — δεν στάλθηκε τίποτα."
      : "Στάλθηκε δοκιμαστικό στο " + testTo + ". Έλεγξέ το πριν την πραγματική αποστολή.");
  }

  async function send() {
    if (!audience) return;
    const label = kind === "service" ? "ενημέρωση ασφαλείας/λειτουργίας" : "προωθητικό μήνυμα";
    if (!window.confirm(
      "Αποστολή σε " + audience.count + " παραλήπτες.\n\n" +
      "Τύπος: " + label + "\nΘέμα: " + subject + "\n\n" +
      "ΔΕΝ γίνεται ανάκληση μετά την αποστολή. Συνέχεια;"
    )) return;

    setBusy(true); setMsg("");
    const r = await api.post("/api/admin/announcements", { ...payload(), confirmCount: audience.count });
    setBusy(false);

    if (!r.ok) {
      if (r.error === "audience_changed") {
        setMsg("Το κοινό άλλαξε όσο έγραφες (τώρα " + r.actual + " άτομα). " +
               "Ανανεώθηκε ο μετρητής — έλεγξε και ξαναπάτα αποστολή.");
        loadAudience();
      } else if (r.error === "no_recipients") {
        setMsg("Δεν υπάρχει κανένας παραλήπτης γι' αυτόν τον τύπο.");
      } else {
        setMsg("Σφάλμα αποστολής: " + (r.error || ""));
      }
      return;
    }
    const sr = r.result as SendResult | undefined;
    setMsg(sr?.skipped === "not_configured"
      ? "Το email δεν είναι ρυθμισμένο στον server — δεν στάλθηκε τίποτα."
      : "Στάλθηκε σε " + sr?.sent + "/" + sr?.total +
        (sr?.failed ? " (απέτυχαν " + sr.failed + ")" : "") + ".");
    loadHistory();
  }

  return (
    <div className="page">
      <h2>Ανακοινώσεις</h2>

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="field"><span>Ξεκίνα από πρότυπο</span>
          <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="" disabled>— Διάλεξε πρότυπο —</option>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <p className="field-hint">
            Τα πρότυπα είναι αφετηρία, όχι έτοιμο κείμενο — διάβασέ τα και προσάρμοσέ τα
            πριν στείλεις. Όπου υπάρχει [ΑΓΚΥΛΗ] πρέπει να μπει πραγματικό στοιχείο.
          </p>
        </label>

        <label className="field"><span>Τύπος μηνύματος</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setPreviewHtml(""); }}>
            <option value="service">Ενημέρωση ασφαλείας / λειτουργίας</option>
            <option value="marketing">Προωθητικό (μάρκετινγκ)</option>
          </select>
          <p className="field-hint">{KIND_HELP[kind]}</p>
        </label>

        <div style={{
          margin: "10px 0 14px", padding: "10px 12px", borderRadius: 6,
          background: kind === "service" ? "rgba(0,120,200,0.10)" : "rgba(200,140,0,0.12)",
          fontSize: "0.9rem",
        }}>
          {audience
            ? <>Θα σταλεί σε <strong>{audience.count}</strong> {audience.count === 1 ? "παραλήπτη" : "παραλήπτες"}
                {audience.sample.length > 0 && (
                  <span className="muted"> — π.χ. {audience.sample.join(", ")}
                    {audience.count > audience.sample.length ? " …" : ""}</span>
                )}
              </>
            : "Υπολογισμός παραληπτών…"}
        </div>

        <label className="field"><span>Θέμα email</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="Αυτό βλέπει ο παραλήπτης στα εισερχόμενα" />
        </label>

        <label className="field"><span>Τίτλος μέσα στο email</span>
          <input value={heading} onChange={(e) => setHeading(e.target.value)}
            placeholder="π.χ. Προειδοποίηση Ασφάλειας" />
        </label>

        <label className="field"><span>Υπότιτλος (χρυσή γραμμή κάτω από τον τίτλο)</span>
          <input value={subheading} onChange={(e) => setSubheading(e.target.value)}
            placeholder="Μία πρόταση που συνοψίζει το μήνυμα" />
        </label>

        <label className="field"><span>Κείμενο</span>
          <textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="Γράψε απλό κείμενο. Άφησε κενή γραμμή ανάμεσα στις παραγράφους." />
          <p className="field-hint">
            Απλό κείμενο — μία κενή γραμμή ξεκινά νέα παράγραφο. Δεν χρειάζεται (ούτε
            επιτρέπεται) HTML· η μορφοποίηση μπαίνει αυτόματα.
          </p>
        </label>

        <label className="field"><span>Τίτλος πλαισίου με λίστα (προαιρετικό)</span>
          <input value={calloutTitle} onChange={(e) => setCalloutTitle(e.target.value)}
            placeholder="π.χ. Τι να προσέχετε" />
        </label>

        <label className="field"><span>Σημεία λίστας — ένα ανά γραμμή</span>
          <textarea rows={5} value={calloutItems} onChange={(e) => setCalloutItems(e.target.value)}
            placeholder={"Μην ανοίγετε ύποπτους συνδέσμους\nΕλέγχετε πάντα τον αποστολέα"} />
          <p className="field-hint">
            Εμφανίζονται σε ξεχωριστό πλαίσιο με χρυσό περίγραμμα. Άφησέ το κενό αν δεν
            χρειάζεται λίστα — τότε δεν εμφανίζεται καθόλου το πλαίσιο.
          </p>
        </label>

        <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={showContacts} onChange={(e) => setShowContacts(e.target.checked)}
            style={{ width: "auto" }} />
          <span>Να μπει το πλαίσιο «Επίσημα στοιχεία επικοινωνίας»</span>
        </label>
        <p className="field-hint" style={{ margin: "0 0 12px" }}>
          Δείχνει τα επίσημα email και το τηλέφωνό μας, ώστε ο παραλήπτης να μπορεί να
          διασταυρώσει ύποπτα μηνύματα. Ιδιαίτερα χρήσιμο στις προειδοποιήσεις phishing.
          Ρυθμίζεται από τα <code>SUPPORT_EMAIL</code>, <code>OFFICIAL_EMAILS</code>,{" "}
          <code>SHOP_PHONE</code>, <code>SHOP_CITY</code> στο .env.
        </p>

        <label className="field"><span>Σημείωση κάτω από το κουμπί (προαιρετικό)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Μικρό πλάγιο κείμενο" />
        </label>

        <div className="npgrid">
          <label className="field"><span>Σύνδεσμος κουμπιού (προαιρετικό)</span>
            <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://nostalgiacandle.gr/contact" />
          </label>
          <label className="field"><span>Κείμενο κουμπιού</span>
            <input value={ctaText} onChange={(e) => setCtaText(e.target.value)}
              placeholder="Επικοινωνήστε μαζί μας" />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <button className="btn btn--small" disabled={busy} onClick={preview}>Προεπισκόπηση</button>
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)}
            placeholder="δική σου διεύθυνση" style={{ width: 220 }} />
          <button className="btn btn--small" disabled={busy} onClick={sendTest}>Δοκιμαστική αποστολή</button>
          <button className="btn btn--small btn--primary" disabled={busy || !audience?.count} onClick={send}>
            Αποστολή σε {audience?.count ?? "…"}
          </button>
        </div>
        <p className="field-hint" style={{ marginTop: 6 }}>
          Στείλε πρώτα δοκιμαστικό στον εαυτό σου και διάβασέ το στα εισερχόμενά σου.
          Η πραγματική αποστολή <strong>δεν ανακαλείται</strong>.
        </p>
        {msg && <p className="muted" style={{ marginTop: 8 }}>{msg}</p>}
      </div>

      {previewHtml && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Προεπισκόπηση</h3>
          <iframe title="preview" srcDoc={previewHtml}
            style={{ width: "100%", height: 620, border: "1px solid var(--border)", borderRadius: 6, background: "#fff" }} />
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Ιστορικό αποστολών</h3>
        {history.length === 0
          ? <p className="muted">Δεν έχει σταλεί καμία ανακοίνωση ακόμα.</p>
          : (
            <table className="tbl">
              <thead><tr>
                <th>Ημερομηνία</th><th>Τύπος</th><th>Θέμα</th><th>Παραλήπτες</th><th>Κατάσταση</th>
              </tr></thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDate(a.sentAt || a.createdAt)}</td>
                    <td>{a.kind === "service" ? "Ενημέρωση" : "Μάρκετινγκ"}</td>
                    <td>{a.subject}</td>
                    <td>{a.sentCount}/{a.recipientCount}</td>
                    <td>
                      {a.status === "sent" ? "Στάλθηκε" : a.status === "failed" ? "Απέτυχε" : a.status}
                      {a.failedCount > 0 && (
                        <span className="muted" title={a.failures.map((f) => f.email + ": " + f.error).join("\n")}>
                          {" "}· {a.failedCount} απέτυχαν
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
