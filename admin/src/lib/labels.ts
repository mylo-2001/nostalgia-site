// Status → label + badge colour maps (ported from the vanilla admin.js so the
// React admin looks and reads identically).
import type { OrderStatus, PaymentStatus, ShippingStatus, Order } from "../types/order";

export type BadgeColor = "blue" | "orange" | "purple" | "green" | "red" | "grey" | "slate";

export const ORDER_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  new: { label: "Νέα", color: "blue" },
  processing: { label: "Σε προετοιμασία", color: "orange" },
  ready: { label: "Έτοιμη για αποστολή", color: "purple" },
  completed: { label: "Ολοκληρώθηκε", color: "green" },
  review: { label: "Χρειάζεται έλεγχος", color: "red" },
  cancelled: { label: "Ακυρώθηκε", color: "grey" },
  shipped: { label: "Απεστάλη", color: "green" },
  delivered: { label: "Παραδόθηκε", color: "green" },
  issue: { label: "Χρειάζεται έλεγχος", color: "red" },
};
export const STATUS_ORDER: OrderStatus[] = ["new", "processing", "ready", "completed", "review", "cancelled"];
export const STATUS_CONFIRM: Partial<Record<OrderStatus, boolean>> = { completed: true, cancelled: true };

export const SHIP_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  not_ready: { label: "Δεν έχει ετοιμαστεί", color: "grey" },
  ready_courier: { label: "Έτοιμη για courier", color: "purple" },
  handed: { label: "Παραδόθηκε στο courier", color: "blue" },
  transit: { label: "Σε μεταφορά", color: "blue" },
  delivered: { label: "Παραδόθηκε", color: "green" },
  failed: { label: "Αποτυχημένη παράδοση", color: "red" },
  returning: { label: "Επιστρέφεται", color: "orange" },
  returned: { label: "Επιστράφηκε", color: "grey" },
};
export const SHIP_ORDER: ShippingStatus[] = ["not_ready", "ready_courier", "handed", "transit", "delivered", "failed", "returning", "returned"];
export const SHIP_CONFIRM: Partial<Record<ShippingStatus, boolean>> = { delivered: true };

export const PAY_STATUS: Record<string, { label: string; color: BadgeColor; short: string }> = {
  pending: { label: "Η πληρωμή εκκρεμεί", color: "orange", short: "Εκκρεμεί" },
  paid: { label: "Πληρωμένη", color: "green", short: "Πληρωμένη" },
  failed: { label: "Αποτυχημένη πληρωμή", color: "red", short: "Αποτυχία" },
  refunded: { label: "Επιστροφή χρημάτων", color: "grey", short: "Επιστροφή" },
  partial_refund: { label: "Μερική επιστροφή", color: "grey", short: "Μερική επιστροφή" },
  offline: { label: "Χωρίς online πληρωμή", color: "grey", short: "Offline" },
  cod_pending: { label: "Αντικαταβολή – δεν έχει εισπραχθεί", color: "orange", short: "Δεν εισπράχθηκε" },
  cod_collected: { label: "Αντικαταβολή – εισπράχθηκε", color: "green", short: "Εισπράχθηκε" },
  cod_not_delivered: { label: "Αντικαταβολή – δεν παραδόθηκε", color: "red", short: "Δεν παραδόθηκε" },
  cod_awaiting_remittance: { label: "Αναμονή απόδοσης από courier", color: "blue", short: "Αναμονή απόδοσης" },
  cod: { label: "Αντικαταβολή – δεν έχει εισπραχθεί", color: "orange", short: "Δεν εισπράχθηκε" },
};
export const PAY_CARD_ORDER: PaymentStatus[] = ["pending", "paid", "failed"];
export const PAY_COD_ORDER: PaymentStatus[] = ["cod_pending", "cod_collected", "cod_awaiting_remittance", "cod_not_delivered"];

export const COURIERS: Record<string, string> = {
  acs: "ACS", elta: "ELTA Courier", speedex: "Speedex",
  geniki: "Γενική Ταχυδρομική", box: "BOX NOW", other: "Άλλο",
};

export const ORDER_TABS: { id: string; label: string }[] = [
  { id: "active", label: "Ενεργές" },
  { id: "new", label: "Νέες" },
  { id: "card_paid", label: "Πληρωμένες κάρτα" },
  { id: "cod", label: "Αντικαταβολές" },
  { id: "processing", label: "Προετοιμασία" },
  { id: "ready", label: "Έτοιμες" },
  { id: "transit", label: "Σε μεταφορά" },
  { id: "delivered", label: "Παραδόθηκαν" },
  { id: "review", label: "Χρειάζονται έλεγχο" },
  { id: "cancelled", label: "Ακυρωμένες" },
  { id: "all", label: "Όλες" },
];

export function orderStatusLabel(s: string) { return ORDER_STATUS[s]?.label ?? s; }
export function payMethodLabel(o: Order) { return o.payment === "cod" ? "Αντικαταβολή" : "Κάρτα"; }
export function courierLabel(k: string) { return COURIERS[String(k || "").toLowerCase()] ?? (k || "—"); }
export function effectiveCourier(o: Order) { return o.courier || o.customer?.courier || ""; }

export function attentionFlags(o: Order): string[] {
  const flags: string[] = [];
  const ageDays = (Date.now() - new Date(o.createdAt).getTime()) / 86400000;
  if (o.status === "review" || o.status === "issue") flags.push("Χρειάζεται έλεγχος");
  if (o.paymentStatus === "failed") flags.push("Αποτυχία πληρωμής");
  if (o.paymentStatus === "cod_not_delivered") flags.push("ΑΝΤ δεν παραδόθηκε");
  if (o.shippingStatus === "failed") flags.push("Αποτυχία παράδοσης");
  if (o.shippingStatus === "returning" || o.shippingStatus === "returned") flags.push("Επιστροφή δέματος");
  if (o.payment !== "cod" && o.paymentStatus === "pending" && ageDays > 2) flags.push("Αναμονή πληρωμής");
  if (o.shippingStatus === "transit" && !o.tracking) flags.push("Χωρίς tracking");
  if ((o.status === "new" || o.status === "processing") && ageDays > 3) flags.push("Καθυστερεί");
  return flags;
}
