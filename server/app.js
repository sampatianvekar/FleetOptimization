const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const { rateLimit } = require("express-rate-limit")
const mongoose = require("mongoose")

const { validateOptimizeBody } = require("./validate")

const DELIVERY_STATUSES = ["pending", "in-transit", "delivered"]

/**
 * Builds the Express app. Dependencies are injected so tests can run without
 * MongoDB or the Python service.
 *   Route:     mongoose model (find/create/deleteMany/updateOne)
 *   optimizer: { solve(body) -> Promise<result> }
 *   auth:      { login(password) -> token|null, verify(token) -> throws if invalid }
 */
function createApp({ Route, optimizer, auth, clientOrigins = ["http://localhost:3000"], rateLimitMax = 30, loginLimitMax = 10 }) {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: clientOrigins }))
  app.use(express.json({ limit: "200kb" }))

  const optimizeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: rateLimitMax,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many optimization requests, slow down a little" },
  })

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginLimitMax,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many login attempts, try again later" },
  })

  // Guards destructive endpoints. 401 = missing/invalid token, 503 = auth not configured.
  const requireAuth = (req, res, next) => {
    const m = /^Bearer (.+)$/.exec(req.get("authorization") || "")
    if (!m) return res.status(401).json({ error: "Authentication required" })
    try {
      auth.verify(m[1])
      next()
    } catch (e) {
      if (e.code === "AUTH_NOT_CONFIGURED") return res.status(503).json({ error: e.message })
      res.status(401).json({ error: "Invalid or expired token, please log in again" })
    }
  }

  app.get("/health", (req, res) => res.json({ status: "ok" }))

  app.post("/auth/login", loginLimiter, (req, res) => {
    try {
      const token = auth.login(req.body?.password)
      if (!token) return res.status(401).json({ error: "Incorrect password" })
      res.json({ token })
    } catch (e) {
      if (e.code === "AUTH_NOT_CONFIGURED") return res.status(503).json({ error: e.message })
      throw e
    }
  })

  // ---- history ----------------------------------------------------------- //
  app.get("/routes", async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100)
    const routes = await Route.find().sort({ createdAt: -1 }).limit(limit).lean()
    res.json(routes)
  })

  app.delete("/routes", requireAuth, async (req, res) => {
    await Route.deleteMany({})
    res.json({ message: "History cleared" })
  })

  // ---- metrics ----------------------------------------------------------- //
  app.get("/metrics", async (req, res) => {
    const routes = await Route.find({}, "totalDistance eta baselineDistance locations.status").lean()

    let deliveries = 0, delivered = 0, eta = 0, km = 0, saved = 0
    for (const r of routes) {
      eta += r.eta ?? 0
      km += r.totalDistance ?? 0
      if (r.baselineDistance > 0 && r.totalDistance != null) saved += r.baselineDistance - r.totalDistance
      for (const loc of r.locations ?? []) {
        if (loc.status === "depot") continue // the depot is not a delivery
        deliveries++
        if (loc.status === "delivered") delivered++
      }
    }
    const n = routes.length
    res.json({
      totalRoutes: n,
      totalDeliveries: deliveries,
      successRate: deliveries ? (delivered / deliveries) * 100 : 0,
      avgETA: n ? eta / n : 0,
      avgDistance: n ? km / n : 0,
      totalDistanceSaved: saved,
    })
  })

  // ---- optimize ---------------------------------------------------------- //
  app.post("/optimize", optimizeLimiter, async (req, res) => {
    const { errors, value } = validateOptimizeBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0], errors })

    let result
    try {
      result = await optimizer.solve(value)
    } catch (e) {
      if (e.response) {
        // The optimizer answered with an error (usually a 400): pass its message through.
        const status = e.response.status >= 400 && e.response.status < 500 ? e.response.status : 502
        return res.status(status).json({ error: e.response.data?.error || "Optimizer rejected the request" })
      }
      console.error("Optimizer unreachable:", e.message)
      return res.status(503).json({ error: "Optimizer service is not reachable. Is `python optimizer/app.py` running?" })
    }

    const unserved = new Set(result.unserved ?? [])
    const saved = await Route.create({
      routes: result.routes,
      totalDistance: result.distance_km,
      eta: result.eta_hours,
      baselineDistance: result.baseline?.distance_km,
      baselineEta: result.baseline?.eta_hours,
      vehicles: value.vehicles,
      capacity: value.capacity,
      unserved: result.unserved ?? [],
      routeStats: result.route_stats ?? [],
      locations: value.locations.map((l, i) => (unserved.has(i) ? { ...l, status: "unserved" } : l)),
    })

    res.json({ ...result, routeId: String(saved._id) })
  })

  // ---- delivery progress ------------------------------------------------- //
  app.patch("/routes/:id/stops/:index", async (req, res) => {
    const index = Number(req.params.index)
    const { status } = req.body ?? {}
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid route id" })
    if (!Number.isInteger(index) || index < 1) return res.status(400).json({ error: "Stop index must be an integer >= 1" })
    if (!DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${DELIVERY_STATUSES.join(", ")}` })
    }
    // The $exists guard stops MongoDB from padding the array with nulls for an out-of-range index.
    const r = await Route.updateOne(
      { _id: req.params.id, [`locations.${index}`]: { $exists: true } },
      { $set: { [`locations.${index}.status`]: status } }
    )
    if (!r.matchedCount) return res.status(404).json({ error: "Route or stop not found" })
    res.json({ ok: true })
  })

  // ---- errors ------------------------------------------------------------ //
  app.use((req, res) => res.status(404).json({ error: "Not found" }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON body" })
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" })
    console.error(err)
    res.status(500).json({ error: "Internal server error" })
  })

  return app
}

module.exports = { createApp }
