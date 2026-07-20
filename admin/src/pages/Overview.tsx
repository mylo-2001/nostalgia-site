import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Order } from "../types/order";
import { ORDER_STATUS } from "../lib/labels";
import { money, fmtDate } from "../lib/format";

interface Counts {
  orders?: number; new_orders?: number; newOrders?: number; users?: number;
  newsletter?: number; messages?: number; unread_messages?: number; pending_reviews?: number;
}

export function Overview({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [counts, setCounts] = useState<Counts>({});
  const [recent, setRecent] = useState<Order[]>([]);

  useEffect(() => {
    api.get("/api/admin/overview").then((res) => {
      if (res.ok) {
        setCounts((res.counts as Counts) || {});
        setRecent((res.recentOrders as Order[]) || []);
      }
    });
  }, []);

  const tiles: [string, number | undefined, string?][] = [
    ["Νέες παραγγελίες", counts.new_orders ?? counts.newOrders, "orders"],
    ["Σύνολο παραγγελιών", counts.orders, "orders"],
    ["Πελάτες", counts.users, "users"],
    ["Newsletter", counts.newsletter, "newsletter"],
    ["Μηνύματα (αδιάβαστα)", counts.unread_messages, "messages"],
    ["Κριτικές προς έγκριση", counts.pending_reviews, "reviews"],
  ];

  return (
    <div>
      <h2 className="main__title">Επισκόπηση</h2>
      <div className="stats">
        {tiles.map(([label, n, to]) => (
          <button className="stat" key={label} onClick={() => to && onNavigate?.(to)} disabled={!onNavigate}>
            <div className="stat__value">{n ?? 0}</div>
            <div className="stat__label">{label}</div>
          </button>
        ))}
      </div>
      <h3 style={{ margin: "22px 0 12px" }}>Πρόσφατες παραγγελίες</h3>
      {recent.length ? (
        <table className="tbl">
          <thead><tr><th>Αριθμός</th><th>Πελάτης</th><th>Σύνολο</th><th>Κατάσταση</th><th>Ημ/νία</th></tr></thead>
          <tbody>
            {recent.map((o) => {
              const s = ORDER_STATUS[o.status] ?? { label: o.status, color: "grey" };
              return (
                <tr key={o.id} onClick={() => onNavigate?.("orders")} style={onNavigate ? { cursor: "pointer" } : undefined}>
                  <td style={{ color: "var(--gold)", fontWeight: 600 }}>{o.number}</td>
                  <td>{o.customer?.firstname} {o.customer?.lastname}</td>
                  <td>{money(o.total)}</td>
                  <td><span className={"obadge obadge--" + s.color}>{s.label}</span></td>
                  <td className="muted">{fmtDate(o.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <p className="empty">Καμία παραγγελία ακόμη.</p>}
    </div>
  );
}
