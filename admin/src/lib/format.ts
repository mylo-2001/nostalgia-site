export function money(v: number | null | undefined): string {
  if (v == null) return "—";
  return "€" + Number(v).toFixed(2);
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("el-GR") +
    " " +
    d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })
  );
}
