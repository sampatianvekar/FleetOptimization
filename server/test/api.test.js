const { test, beforeEach } = require("node:test")
const assert = require("node:assert/strict")
const request = require("supertest")
const { createApp } = require("../app")
const { validateOptimizeBody } = require("../validate")

const GOOD = {
  vehicles: 2,
  capacity: 100,
  locations: [
    { name: "Depot", x: 77.6, y: 12.9, demand: 0 },
    { name: "A", x: 77.62, y: 12.95, demand: 0 },
    { name: "B", x: 77.7, y: 12.99, demand: 25, status: "delivered" },
  ],
}

const OPT_RESULT = {
  routes: [[0, 1, 2, 0]],
  distance_km: 30.5,
  eta_hours: 0.76,
  baseline: { distance_km: 45, eta_hours: 1.1 },
  unserved: [],
  route_stats: [{ vehicle: 1, stops: 2, load: 25, capacity: 100, distance_km: 30.5, eta_minutes: 46 }],
}

const auth = {
  login: pw => (pw === "secret" ? "tok" : null),
  verify: t => { if (t !== "tok") throw new Error("bad token") },
}

let calls, docs, optimizer, Route, app

beforeEach(() => {
  calls = { created: [], updated: [], deleted: 0 }
  docs = []
  optimizer = { solve: async body => ((calls.solved = body), OPT_RESULT) }
  Route = {
    find: () => ({ sort: () => ({ limit: () => ({ lean: async () => docs }) }), lean: async () => docs }),
    create: async doc => (calls.created.push(doc), { _id: "665f1c2e8f1b2a0012345678" }),
    deleteMany: async () => (calls.deleted++, {}),
    updateOne: async (filter, update) => (calls.updated.push({ filter, update }), { matchedCount: 1 }),
  }
  app = createApp({ Route, optimizer, auth, rateLimitMax: 1000 })
})

test("validation normalises locations: demand 0 is kept, depot forced, client status ignored", () => {
  const { errors, value } = validateOptimizeBody(GOOD)
  assert.deepEqual(errors, [])
  assert.equal(value.locations[1].demand, 0) // old code turned this into 10
  assert.equal(value.locations[0].status, "depot")
  assert.equal(value.locations[2].status, "pending")
})

for (const [label, mutate, msg] of [
  ["no stops", b => (b.locations = [b.locations[0]]), /at least one stop/i],
  ["bad vehicles", b => (b.vehicles = 0), /vehicles/i],
  ["fractional vehicles", b => (b.vehicles = 1.5), /vehicles/i],
  ["bad latitude", b => (b.locations[1].y = 120), /latitude/i],
  ["bad longitude", b => (b.locations[1].x = "77"), /longitude/i],
  ["negative demand", b => (b.locations[1].demand = -1), /demand/i],
  ["zero capacity", b => (b.capacity = 0), /capacity/i],
]) {
  test(`POST /optimize rejects: ${label}`, async () => {
    const body = JSON.parse(JSON.stringify(GOOD))
    mutate(body)
    const res = await request(app).post("/optimize").send(body)
    assert.equal(res.status, 400)
    assert.match(res.body.error, msg)
    assert.equal(calls.created.length, 0)
  })
}

test("POST /optimize stores the plan, returns routeId and forwards clean data", async () => {
  const res = await request(app).post("/optimize").send(GOOD)
  assert.equal(res.status, 200)
  assert.equal(res.body.routeId, "665f1c2e8f1b2a0012345678")
  assert.equal(res.body.distance_km, 30.5)
  const saved = calls.created[0]
  assert.equal(saved.totalDistance, 30.5)
  assert.equal(saved.baselineDistance, 45)
  assert.equal(saved.locations[2].status, "pending")
  assert.equal(calls.solved.capacity, 100)
})

test("unserved stops are persisted with status 'unserved'", async () => {
  optimizer.solve = async () => ({ ...OPT_RESULT, routes: [[0, 1, 0]], unserved: [2] })
  await request(app).post("/optimize").send(GOOD)
  assert.equal(calls.created[0].locations[2].status, "unserved")
})

test("optimizer down -> 503 with a helpful message", async () => {
  optimizer.solve = async () => { throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) }
  const res = await request(app).post("/optimize").send(GOOD)
  assert.equal(res.status, 503)
  assert.match(res.body.error, /optimizer/i)
})

test("optimizer 400 is passed through", async () => {
  optimizer.solve = async () => { throw { response: { status: 400, data: { error: "location 1: demand must be a number >= 0" } } } }
  const res = await request(app).post("/optimize").send(GOOD)
  assert.equal(res.status, 400)
  assert.match(res.body.error, /demand/)
})

test("malformed JSON -> 400 not 500", async () => {
  const res = await request(app).post("/optimize").set("Content-Type", "application/json").send("{oops")
  assert.equal(res.status, 400)
})

test("GET /metrics ignores the depot and reports a real success rate", async () => {
  docs = [
    { totalDistance: 30, eta: 1, baselineDistance: 50, locations: [{ status: "depot" }, { status: "delivered" }, { status: "pending" }] },
    { totalDistance: 20, eta: 0.5, baselineDistance: 25, locations: [{ status: "depot" }, { status: "delivered" }] },
  ]
  const { body } = await request(app).get("/metrics")
  assert.equal(body.totalRoutes, 2)
  assert.equal(body.totalDeliveries, 3) // old code counted depots -> 5
  assert.ok(Math.abs(body.successRate - 66.666) < 0.01)
  assert.equal(body.avgDistance, 25)
  assert.equal(body.totalDistanceSaved, 25)
})

test("GET /metrics with no data returns zeros", async () => {
  const { body } = await request(app).get("/metrics")
  assert.deepEqual(body, { totalRoutes: 0, totalDeliveries: 0, successRate: 0, avgETA: 0, avgDistance: 0, totalDistanceSaved: 0 })
})

test("PATCH stop status validates input and guards the array index", async () => {
  const id = "665f1c2e8f1b2a0012345678"
  assert.equal((await request(app).patch("/routes/nope/stops/1").send({ status: "delivered" })).status, 400)
  assert.equal((await request(app).patch(`/routes/${id}/stops/0`).send({ status: "delivered" })).status, 400)
  assert.equal((await request(app).patch(`/routes/${id}/stops/1`).send({ status: "teleported" })).status, 400)
  const ok = await request(app).patch(`/routes/${id}/stops/2`).send({ status: "delivered" })
  assert.equal(ok.status, 200)
  assert.deepEqual(calls.updated[0].filter["locations.2"], { $exists: true })
  assert.equal(calls.updated[0].update.$set["locations.2.status"], "delivered")
})

test("PATCH returns 404 when nothing matched", async () => {
  Route.updateOne = async () => ({ matchedCount: 0 })
  const res = await request(app).patch("/routes/665f1c2e8f1b2a0012345678/stops/9").send({ status: "delivered" })
  assert.equal(res.status, 404)
})

test("DELETE /routes requires a valid admin token", async () => {
  assert.equal((await request(app).delete("/routes")).status, 401)
  assert.equal((await request(app).delete("/routes").set("Authorization", "Bearer nope")).status, 401)
  assert.equal(calls.deleted, 0)
  const ok = await request(app).delete("/routes").set("Authorization", "Bearer tok")
  assert.equal(ok.status, 200)
  assert.equal(calls.deleted, 1)
})

test("login: right password gives a token, wrong one is 401, repeated attempts are limited", async () => {
  assert.deepEqual((await request(app).post("/auth/login").send({ password: "secret" })).body, { token: "tok" })
  assert.equal((await request(app).post("/auth/login").send({ password: "wrong" })).status, 401)
  assert.equal((await request(app).post("/auth/login").send({})).status, 401)
  const limited = createApp({ Route, optimizer, auth, loginLimitMax: 2 })
  const codes = []
  for (let i = 0; i < 3; i++) codes.push((await request(limited).post("/auth/login").send({ password: "x" })).status)
  assert.deepEqual(codes, [401, 401, 429])
})

test("unknown paths 404 as JSON", async () => {
  const res = await request(app).get("/nope")
  assert.equal(res.status, 404)
  assert.equal(res.body.error, "Not found")
})

test("rate limiter protects /optimize", async () => {
  const limited = createApp({ Route, optimizer, auth, rateLimitMax: 2 })
  const statuses = []
  for (let i = 0; i < 4; i++) statuses.push((await request(limited).post("/optimize").send(GOOD)).status)
  assert.deepEqual(statuses, [200, 200, 429, 429])
})

test("security headers are set", async () => {
  const res = await request(app).get("/health")
  assert.equal(res.headers["x-content-type-options"], "nosniff")
  assert.equal(res.headers["x-powered-by"], undefined)
})

test("auth.js: no hard-coded secret, env required, real JWT round trip", () => {
  const realAuth = require("../auth")
  const saved = { ...process.env }
  try {
    delete process.env.JWT_SECRET; delete process.env.ADMIN_PASSWORD
    assert.throws(() => realAuth.login("x"), /not configured/)
    process.env.JWT_SECRET = "short"
    process.env.ADMIN_PASSWORD = "pw"
    assert.throws(() => realAuth.login("pw"), /not configured/) // secret too short
    process.env.JWT_SECRET = "a-long-enough-test-secret-1234"
    assert.equal(realAuth.login("wrong"), null)
    const token = realAuth.login("pw")
    assert.equal(realAuth.verify(token).id, "admin")
    process.env.JWT_SECRET = "a-different-secret-entirely-5678"
    assert.throws(() => realAuth.verify(token)) // tokens signed with another secret are rejected
  } finally {
    process.env = saved
  }
})

test("when auth is not configured, DELETE answers 503 rather than being open", async () => {
  const unconfigured = createApp({
    Route, optimizer,
    auth: { login: () => { throw Object.assign(new Error("not configured"), { code: "AUTH_NOT_CONFIGURED" }) },
            verify: () => { throw Object.assign(new Error("not configured"), { code: "AUTH_NOT_CONFIGURED" }) } },
  })
  assert.equal((await request(unconfigured).delete("/routes").set("Authorization", "Bearer x")).status, 503)
  assert.equal(calls.deleted, 0)
})

test("in-memory store behaves like the model for every call app.js makes", async () => {
  const { createMemoryRoute } = require("../memoryRoute")
  const mem = createMemoryRoute()
  const memApp = createApp({ Route: mem, optimizer, auth, rateLimitMax: 1000 })
  const a = await request(memApp).post("/optimize").send(GOOD)
  await new Promise(r => setTimeout(r, 5))
  const b = await request(memApp).post("/optimize").send(GOOD)
  const list = (await request(memApp).get("/routes?limit=1")).body
  assert.equal(list.length, 1)
  assert.equal(list[0]._id, b.body.routeId) // newest first, limit honoured
  assert.equal((await request(memApp).patch(`/routes/${a.body.routeId}/stops/2`).send({ status: "delivered" })).status, 200)
  assert.equal((await request(memApp).patch(`/routes/${a.body.routeId}/stops/9`).send({ status: "delivered" })).status, 404)
  const metrics = (await request(memApp).get("/metrics")).body
  assert.equal(metrics.totalRoutes, 2)
  assert.equal(metrics.totalDeliveries, 4)
  assert.equal(metrics.successRate, 25) // 1 delivered of 4 non-depot stops
  await request(memApp).delete("/routes").set("Authorization", "Bearer tok")
  assert.equal((await request(memApp).get("/routes")).body.length, 0)
})
