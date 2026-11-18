const mongoose = require("mongoose")

const STATUSES = ["depot", "pending", "in-transit", "delivered", "unserved"]

const LocationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 80 },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    demand: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: STATUSES, default: "pending" },
  },
  { _id: false }
)

const RouteStatSchema = new mongoose.Schema(
  { vehicle: Number, stops: Number, load: Number, capacity: Number, distance_km: Number, eta_minutes: Number },
  { _id: false }
)

const RouteSchema = new mongoose.Schema(
  {
    routes: [[Number]],               // one array of location indexes per vehicle
    totalDistance: Number,            // km
    eta: Number,                      // hours (kept for backwards compatibility)
    baselineDistance: Number,         // km for the naive plan on the same problem
    baselineEta: Number,
    vehicles: Number,
    capacity: Number,
    unserved: [Number],
    routeStats: [RouteStatSchema],
    locations: [LocationSchema],
  },
  { timestamps: true }
)

RouteSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Route", RouteSchema)
module.exports.STATUSES = STATUSES
