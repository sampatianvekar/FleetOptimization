export const ROUTE_COLORS = ["#2563eb", "#db2777", "#d97706", "#7c3aed", "#0d9488", "#dc2626", "#4d7c0f", "#0891b2"]
export const routeColor = i => ROUTE_COLORS[i % ROUTE_COLORS.length]

export const STATUS_COLORS = {
  depot: "#1d4ed8",
  pending: "#ef4444",
  "in-transit": "#f59e0b",
  delivered: "#16a34a",
  unserved: "#6b7280",
}
