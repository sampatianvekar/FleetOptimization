// Returns { value } or { error }. Empty strings are rejected (Number("") === 0 would sneak through).
export function parseCoordinate(raw, kind) {
  const [min, max, label] = kind === "lon" ? [-180, 180, "Longitude"] : [-90, 90, "Latitude"]
  if (raw === "" || raw === null || raw === undefined || !Number.isFinite(Number(raw))) {
    return { error: `${label} must be a number` }
  }
  const value = Number(raw)
  if (value < min || value > max) return { error: `${label} must be between ${min} and ${max}` }
  return { value }
}

export function parseDemand(raw) {
  if (raw === "" || raw === null || raw === undefined) return { value: 10 } // default
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return { error: "Demand must be 0 or more" }
  return { value } // 0 is valid
}
