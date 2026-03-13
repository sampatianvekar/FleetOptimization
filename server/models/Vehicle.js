const mongoose = require("mongoose")

const VehicleSchema = new mongoose.Schema({
    vehicleNumber:String,
    capacity:Number,
    status:{
        type:String,
        default:"available"
    }
})

module.exports = mongoose.model("Vehicle",VehicleSchema)