import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

interface OperationalMetric {
  key: string;
  label: string;
  description: string;
  urgent: boolean;
}

const METRICS: OperationalMetric[] = [
  { key: "checkout_errors_1h", label: "Σφάλματα checkout", description: "Τελευταία ώρα", urgent: true },
  { key: "payment_failures_1h", label: "Αποτυχημένες πληρωμές", description: "Τελευταία ώρα", urgent: true },
  { key: "webhook_failures_1h", label: "Αποτυχίες webhook", description: "Τελευταία ώρα", urgent: true },
  { key: "webhook_delayed", label: "Καθυστερημένα webhook", description: "Σε αναμονή πάνω από 5 λεπτά", urgent: true },
  { key: "expired_reservations", label: "Ληγμένες δεσμεύσεις", description: "Ενεργές αλλά εκπρόθεσμες", urgent: true },
  { key: "negative_stock_invariants", label: "Παραβιάσεις αποθέματος", description: "Αρνητικό ή ασυνεπές stock", urgent: true },
  { key: "notification_failures", label: "Αποτυχίες ειδοποιήσεων", description: "Failed ή dead letter", urgent: false },
  { key: "refund_failures_24h", label: "Αποτυχίες refund", description: "Τελευταίες 24 ώρες", urgent: true },
];

export function Operations() {
  const [values, setValues] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await api.get("/api/admin/operations/metrics");
    setLoading(false);
    if (!result.ok) {
      setError(`Οι μετρήσεις δεν φορτώθηκαν (${result.error || result.status}).`);
      return;
    }
    const raw = (result.metrics || {}) as Record<string, unknown>;
    setValues(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value) || 0])));
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="page-heading">
        <div><h2 className="main__title">Παρακολούθηση λειτουργίας</h2><p className="muted">Άμεση εικόνα για checkout, πληρωμές, stock και background εργασίες.</p></div>
        <button className="btn btn--small" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Ανανέωση…" : "Ανανέωση"}</button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!values && !error ? <p className="empty">Φόρτωση…</p> : null}
      {values ? (
        <div className="metric-grid">
          {METRICS.map((metric) => {
            const count = values[metric.key] || 0;
            const attention = count > 0 && metric.urgent;
            return (
              <section className={`metric ${attention ? "metric--attention" : ""}`} key={metric.key}>
                <span className={`metric__value ${count === 0 ? "metric__value--ok" : ""}`}>{count}</span>
                <strong>{metric.label}</strong>
                <span className="muted">{metric.description}</span>
              </section>
            );
          })}
        </div>
      ) : null}
      {updatedAt ? <p className="muted operations-updated">Τελευταία ενημέρωση: {updatedAt.toLocaleTimeString("el-GR")}</p> : null}
    </div>
  );
}
