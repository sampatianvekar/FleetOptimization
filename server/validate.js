// Request validation. Kept dependency-free on purpose; the optimizer validates again.
const MAX_LOCATIONS = 200
const MAX_VEHICLES = 50

const isNum = v => typeof v === "number" && Number.isFinite(v)

function validateOptimizeBody(body) {
  const errors = []
  if (!body || typeof body !== "object") return { errors: ["Request body must be a JSON object"] }

  const { locations, vehicles } = body
  const capacity = body.capacity ?? 100

  if (!Array.isArray(locations) || locations.length < 2) {
    errors.push("Add at least one stop in addition to the depot")
  } else if (locations.length > MAX_LOCATIONS) {
    errors.push(`At most ${MAX_LOCATIONS} locations are supported`)
  } else {
    locations.forEach((l, i) => {
      if (!l || !isNum(l.x) || l.x < -180 || l.x > 180) errors.push(`Location ${i}: longitude must be between -180 and 180`)
      if (!l || !isNum(l.y) || l.y < -90 || l.y > 90) errors.push(`Location ${i}: latitude must be between -90 and 90`)
      if (l && l.demand !== undefined && (!isNum(l.demand) || l.demand < 0)) errors.push(`Location ${i}: demand must be a number >= 0`)
    })
  }
  if (!Number.isInteger(vehicles) || vehicles < 1 || vehicles > MAX_VEHICLES) {
    errors.push(`Vehicles must be a whole number between 1 and ${MAX_VEHICLES}`)
  }
  if (!isNum(capacity) || capacity <= 0) errors.push("Capacity must be a number greater than 0")

  if (errors.length) return { errors: errors.slice(0, 5) }

  return {
    errors: [],
    value: {
      vehicles,
      capacity,
      locations: locations.map((l, i) => ({
        name: String(l.name || (i === 0 ? "Depot" : `Stop ${i}`)).slice(0, 80),
        x: l.x,
        y: l.y,
        demand: i === 0 ? 0 : l.demand ?? 10, // ?? not ||: a demand of 0 is legitimate
        status: i === 0 ? "depot" : "pending",   // never trust client-supplied status
      })),
    },
  }
}

module.exports = { validateOptimizeBody }
