const crypto = require("crypto")

/**
 * Tiny in-memory stand-in for the Route model (the handful of calls app.js makes).
 * Lets anyone run the project without installing MongoDB:  USE_MEMORY_DB=true npm start
 * Data is lost when the server stops.
 */
function createMemoryRoute() {
  let docs = []
  const clone = o => structuredClone(o)

  const query = () => {
    let list = [...docs].reverse() // newest first
    const q = {
      sort: () => q,
      limit: n => ((list = list.slice(0, n)), q),
      lean: async () => clone(list),
    }
    return q
  }

  return {
    find: () => query(),
    async create(doc) {
      const now = new Date()
      const saved = { ...clone(doc), _id: crypto.randomBytes(12).toString("hex"), createdAt: now, updatedAt: now }
      docs.push(saved)
      return saved
    },
    async deleteMany() {
      docs = []
      return {}
    },
    async updateOne(filter, update) {
      const doc = docs.find(d => d._id === filter._id)
      if (!doc) return { matchedCount: 0 }
      // Mirror the real query: every "locations.N": {$exists:true} guard must hold.
      for (const key of Object.keys(filter)) {
        const m = /^locations\.(\d+)$/.exec(key)
        if (m && !(doc.locations && doc.locations[Number(m[1])])) return { matchedCount: 0 }
      }
      for (const [path, value] of Object.entries(update.$set ?? {})) {
        const m = /^locations\.(\d+)\.(\w+)$/.exec(path)
        if (m) doc.locations[Number(m[1])][m[2]] = value
      }
      doc.updatedAt = new Date()
      return { matchedCount: 1 }
    },
  }
}

module.exports = { createMemoryRoute }
