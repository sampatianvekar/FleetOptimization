export function formatETA(hours) {
  if (!hours && hours !== 0) return "0h 0m"

  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  return `${h}h ${m}m`
}