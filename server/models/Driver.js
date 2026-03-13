const mongoose = require("mongoose")

const DriverSchema = new mongoose.Schema({
    name:String,
    licenseNumber:String,
    assignedVehicle:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Vehicle"
    }
})

module.exports = mongoose.model("Driver",DriverSchema)