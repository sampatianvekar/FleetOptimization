const axios = require("axios")
const mongoose = require("mongoose")

const config = require("./config")
const { createMemoryRoute } = require("./memoryRoute")
const auth = require("./auth")
const { createApp } = require("./app")

const optimizer = {
  solve: async body => (await axios.post(`${config.optimizerUrl}/optimize`, body, { timeout: config.optimizerTimeoutMs })).data,
}

async function main() {
  let Route
  if (config.useMemoryDb) {
    Route = createMemoryRoute()
    console.log("Using IN-MEMORY storage (USE_MEMORY_DB=true). Data is lost on restart.")
  } else {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
    Route = require("./models/Route")
    console.log("MongoDB connected")
  }

  const app = createApp({ Route, optimizer, auth, clientOrigins: config.clientOrigins })
  const server = app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`))

  const shutdown = () => server.close(() => Promise.resolve(config.useMemoryDb || mongoose.disconnect()).then(() => process.exit(0)))
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main().catch(err => {
  console.error("Failed to start:", err.message)
  process.exit(1)
})
