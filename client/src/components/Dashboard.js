import MapView from "./MapView"
import LocationForm from "./LocationForm"
import { useEffect, useState } from "react"
import axios from "axios"
import RouteComparisonChart from "./RouteComparisonChart"
import { formatETA } from "../utils/formatETA"

function Dashboard({ result, locations, setLocations, addLocation, deleteLocation, optimize, setVehicles, clearHistory, nonOptimized }) {

  const avgSpeed = 40 // km/h

  let etaText = "0 hr 0 min"
  if (result?.distance_km) {
    const hours = result.distance_km / avgSpeed
    const totalMinutes = Math.round(hours * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    etaText = `${h} hr ${m} min`
  }

  const delivered = locations.filter(l => l.status === "delivered").length
  const pending = locations.filter(l => l.status === "pending").length
  const [metrics, setMetrics] = useState({})
  const [history, setHistory] = useState([])

  useEffect(() => {
    axios.get("http://localhost:4000/routes")
      .then(res => setHistory(res.data))
      .catch(() => setHistory([]))

    axios.get("http://localhost:4000/metrics")
      .then(res => setMetrics(res.data))
      .catch(() => setMetrics({}))
  }, [result])

  // Optimization Impact Calculations
  const distanceSaved =
    nonOptimized?.distance_km && result?.distance_km
    ? nonOptimized.distance_km - result.distance_km
    : 0;

  const timeSaved =
    nonOptimized?.distance_km && result?.distance_km
    ? (nonOptimized.distance_km - result.distance_km) / avgSpeed
    : 0;

  const efficiency =
    nonOptimized?.distance_km && nonOptimized.distance_km > 0
    ? (distanceSaved / nonOptimized.distance_km) * 100
    : 0;

  const cardStyle = {
    flex: 1,
    background: "#ffffff",
    padding: "15px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    textAlign: "center",
    fontSize: "14px"
   };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, sans-serif" }}>

      {/* SIDEBAR */}
      
      <div style={{ width: "250px", background: "#111827", color: "white", padding: "20px", boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
       <h1 style={{ marginBottom: "20px" }}>
        Fleet Optimization System</h1>
         <h2>Fleet Panel</h2>

        <LocationForm addLocation={addLocation} />

        <br />

        <input placeholder="Vehicles" onChange={e => setVehicles(Number(e.target.value) || 1)} />

        <button onClick={optimize} style={{ marginTop: "20px", padding: "10px", width: "100%", background: "#10b981", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", border: "none", color: "white" }}>
          Optimize Fleet
        </button>

        <button onClick={clearHistory} style={{ marginTop: "10px", padding: "10px", width: "100%", background: "#ef4444", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", border: "none", color: "white" }}>
          Clear History
        </button>
        
      </div>

      


      {/* MAP + DELIVERY LOG */}
<div style={{ flex: 1, display: "flex", flexDirection: "column", width:"100%", height:"100%" }}>

  {/* Map */}
  <div style={{ flex: 3 }}>
    <MapView
      routes={result?.routes}
      locations={locations}
      setLocations={setLocations}
    />
  </div>

  

  {/* Live Delivery Log */}
  <div
    style={{
      flex: 1,
      background: "#1F2937",
      color: "#E5E7EB",
      padding: "15px",
      borderTopLeftRadius:"16px",
      borderTopRightRadius:"16px",
      overflowY: "auto"
    }}
  >
    <h3 style={{ marginBottom: "10px" }}>Live Delivery Log</h3>

    {locations.filter(l => l.status === "delivered").length === 0 && (
      <p>No deliveries completed yet...</p>
    )}

    {locations
      .filter(l => l.status === "delivered")
      .map((loc, i) => (
        <p key={i} style={{ marginBottom: "6px" }}>
          ✅ {loc.name} delivered
        </p>
      ))}

      
  </div>

  <div style={{ marginBottom: "20px" }}>
  <div style={cardStyle}>
    🚚 <strong>{distanceSaved.toFixed(2)} km</strong><br/>
    Distance Saved
  </div>

  <div style={{ ...cardStyle, marginTop: "10px" }}>
    ⏱ <strong>{formatETA(timeSaved)}</strong><br/>
    Time Saved
  </div>

  <div style={{ ...cardStyle, marginTop: "10px" }}>
    ⚡ <strong>{efficiency.toFixed(1)}%</strong><br/>
    Efficiency Gain
  </div>
</div>

</div>


      {/* STATS */}
      <div style={{ width: "300px", background: "#ffffff", padding: "20px", boxShadow: "0 4px 10px rgba(0,0,0,0.08)", borderRadius: "12px" }}>
        
        
        <h3>Analytics</h3>
        <p>Total Distance:</p>
        <h2>{result?.distance_km ?? 0} km</h2>
        <p>Estimated Time:</p>
        <h2>{etaText}</h2>
        <p>Delivered:</p>
        <h2>{delivered}</h2>
        <p>Pending:</p>
        <h2>{pending}</h2>

        <h2>Fleet Performance</h2>
        <div style={{ background: "#fff", padding: "10px", marginBottom: "20px" }}>
          <p>Total Routes: {(metrics.totalRoutes ?? 0)}</p>
          <p>Total Deliveries: {(metrics.totalDeliveries ?? 0)}</p>
          <p>Success Rate: {(metrics.successRate ?? 0).toFixed(2)}%</p>
          <p>Avg ETA: {formatETA(metrics.avgETA ?? 0)}</p>
          <p>Avg Distance: {(metrics.avgDistance ?? 0).toFixed(2)} km</p>
        </div>
        <br>
        </br>

          <div style={{ height: "320px", marginTop: "20px" }}>
  <RouteComparisonChart
    optimized={result}
    nonOptimized={nonOptimized}
  />
</div>

        <h3>Route History</h3>
        {history.map((h, i) => (
          <div key={i} style={{ background: "white", marginBottom: "10px", padding: "10px" }}>
            <p>Date: {new Date(h.createdAt).toLocaleString()}</p>
            <p>Distance: {h.totalDistance ?? 0} km</p>
            <p>ETA: {formatETA(h.eta ?? 0)}</p>
            <hr />
            <h4>Route Details</h4>
            {h.routes?.map((route, rIndex) => (
              <div key={rIndex}>
                <p><b>Vehicle {rIndex + 1}</b></p>
                {route.map((stop, idx) => {
                  if (idx === route.length - 1) return null
                  return <p key={idx}>{h.locations?.[route[idx]]?.name} → {h.locations?.[route[idx + 1]]?.name}</p>
                })}
              </div>
            ))}
          </div>
        ))}

        <h3>Locations</h3>
        {locations.map((loc, idx) => (
          <div key={idx} style={{ background: "#fff", marginBottom: "5px", padding: "5px", display: "flex", justifyContent: "space-between" }}>
            <span>
            {loc.name} — 
            <span style={{
            color:
             loc.status === "delivered" ? "green" :
             loc.status === "pending" ? "red" :
                "orange",
            fontWeight: "bold"
            }}>
             {loc.status}
            </span>
        </span>
            {loc.status !== "depot" && <button onClick={() => deleteLocation(idx)}>Delete</button>}
          </div>
        ))}
      </div>

    </div>

    
  )
}

export default Dashboard