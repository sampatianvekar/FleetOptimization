const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const axios = require("axios")

const Vehicle = require("./models/Vehicle")
const Driver = require("./models/Driver")
const Route = require("./models/Route")

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect("mongodb://127.0.0.1:27017/fleetDB")
  .then(()=>console.log("MongoDB Connected"))
  .catch(err=>console.log(err))

// CRUD routes
app.get("/routes", async (req,res)=>{ 
  const routes = await Route.find().sort({createdAt:-1})
  res.json(routes)
})
app.delete("/routes", async (req,res)=>{
  await Route.deleteMany({})
  res.json({message:"History cleared"})
})
app.get("/metrics", async (req,res)=>{
  const routes = await Route.find()
  let totalRoutes = routes.length, totalDeliveries = 0, delivered = 0, totalETA = 0, totalDistance = 0
  routes.forEach(r=>{
    totalETA += r.eta ?? 0
    totalDistance += r.totalDistance ?? 0
    r.locations.forEach(loc=>{ totalDeliveries++; if(loc.status==="delivered") delivered++ })
  })
  res.json({
    totalRoutes,
    totalDeliveries,
    successRate: totalDeliveries? (delivered/totalDeliveries)*100 :0,
    avgETA: totalRoutes? totalETA/totalRoutes :0,
    avgDistance: totalRoutes? totalDistance/totalRoutes :0
  })
})

// Optimize route via Flask
app.post("/optimize", async (req,res)=>{
  try{
    const response = await axios.post("http://localhost:5000/optimize", req.body)
    const saved = await Route.create({
      routes: response.data.routes,
      totalDistance: response.data.distance_km,
      eta: response.data.eta_hours,
      locations: req.body.locations
    })
    res.json(response.data)
  } catch(e){
    console.error(e)
    res.status(500).send("Optimization failed")
  }
})

app.listen(4000, ()=>console.log("Server running on port 4000"))