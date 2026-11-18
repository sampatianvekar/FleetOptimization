export function formatETA(hours) {
  if (!Number.isFinite(hours) || hours < 0) return "0h 0m"
  const totalMinutes = Math.round(hours * 60)
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
}
