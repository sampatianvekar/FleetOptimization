require("dotenv").config()

const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d)

module.exports = {
  port: num(process.env.PORT, 4000),
  useMemoryDb: process.env.USE_MEMORY_DB === "true",
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fleetDB",
  optimizerUrl: (process.env.OPTIMIZER_URL || "http://127.0.0.1:5001").replace(/\/$/, ""),
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",").map(s => s.trim()),
  optimizerTimeoutMs: num(process.env.OPTIMIZER_TIMEOUT_MS, 30000),
}
