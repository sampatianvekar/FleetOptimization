const mongoose = require("mongoose")

const RouteSchema = new mongoose.Schema({

routes: Array,

totalDistance: Number,

eta: Number,

locations: [
{
name:String,
x:Number,
y:Number,
demand:Number,
status:String
}
],

createdAt:{
type:Date,
default:Date.now
}

},{ timestamps: true })

module.exports = mongoose.model("Route",RouteSchema)