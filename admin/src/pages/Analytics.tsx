import { useEffect, useState } from "react";
import { api } from "../api/client";

interface AnalyticsInfo { configured: boolean; id: string | null; fromEnv: boolean }

export function Analytics() {
  const [info, setInfo] = useState<AnalyticsInfo | null>(null);

  useEffect(() => {
    api.get("/api/admin/settings").then((res) => {
      if (res.ok) setInfo((res.analytics as AnalyticsInfo) || { configured: false, id: null, fromEnv: false });
    });
  }, []);

  if (!info) return <p className="empty">Φόρτωση…</p>;

  return (
    <div>
      <h2 className="main__title">Analytics</h2>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3 className="card__title">Google Analytics 4</h3>
        {info.configured ? (
          <>
            <p style={{ marginTop: 0 }}>
              <span className="obadge obadge--green">Ενεργό</span>{" "}
              <span className="muted">Measurement ID: <code>{info.id}</code>{info.fromEnv ? " · από .env" : ""}</span>
            </p>
            <p className="muted">
              Τα δεδομένα (προβολές προϊόντων, χρόνος στο site, από πού έφυγαν, τι πατάνε,
              συσκευές, πηγές επισκεψιμότητας) συλλέγονται <strong>μόνο μετά την αποδοχή των
              cookies ανάλυσης</strong> και εμφανίζονται στο dashboard της Google.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <a className="btn btn--primary" href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">Άνοιγμα Google Analytics ↗</a>
              <a className="btn" href="https://analytics.google.com/analytics/web/#/p/reports/reportinghub" target="_blank" rel="noopener noreferrer">Reports ↗</a>
            </div>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0 }}><span className="obadge obadge--grey">Ανενεργό</span></p>
            <p className="muted">Για να ενεργοποιήσετε το Google Analytics:</p>
            <ol className="muted" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
              <li>Δημιουργήστε ιδιότητα GA4 στο <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">analytics.google.com</a> και αντιγράψτε το Measurement ID (μορφή <code>G-XXXXXXXXXX</code>).</li>
              <li>Βάλτε το στο <code>.env</code>: <code>GA_MEASUREMENT_ID=G-XXXXXXXXXX</code></li>
              <li>Επανεκκινήστε τον server (<code>npm start</code>).</li>
            </ol>
          </>
        )}
      </section>

      <section className="card">
        <h3 className="card__title">Τι μετριέται & απόρρητο</h3>
        <ul className="muted" style={{ lineHeight: 1.7, paddingLeft: 18, marginBottom: 0 }}>
          <li>Η συλλογή γίνεται <strong>μόνο</strong> για επισκέπτες που πάτησαν «Αποδοχή» στα cookies ανάλυσης.</li>
          <li>Το IP ανωνυμοποιείται (<code>anonymize_ip</code>). Καμία προσωπική πληροφορία δεν στέλνεται.</li>
          <li>Marketing εργαλεία (Meta Pixel, Klaviyo) φορτώνουν χωριστά, μόνο με συναίνεση marketing.</li>
        </ul>
      </section>
    </div>
  );
}
