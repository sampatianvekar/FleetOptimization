import axios from "axios"
import { useState } from "react"
import Dashboard from "./components/Dashboard"

function App() {

  const [result, setResult] = useState(null)
  const [nonOptimizedResult, setNonOptimizedResult] = useState(null)
  const [vehicles, setVehicles] = useState(2)
  const [locations, setLocations] = useState([
    { name: "Depot", x: 77.6, y: 12.9, demand: 0, status: "depot" }
  ])

  const generateNonOptimized = () => {
  if (locations.length <= 1) return null

  const route = locations.map((_, i) => i)
  route.push(0)

  let totalDistance = 0
  for (let i = 0; i < route.length - 1; i++) {
    const a = locations[route[i]]
    const b = locations[route[i + 1]]

    const dx = a.x - b.x
    const dy = a.y - b.y
    totalDistance += Math.sqrt(dx * dx + dy * dy) * 111
  }

  const avgSpeed = 40
  const eta = totalDistance / avgSpeed

  return {
    routes: [route],
    distance_km: Number(totalDistance.toFixed(2)),
    eta_hours: Number(eta.toFixed(2))
  }
}

  const addLocation = (loc) => {
    setLocations(prev => [
      ...prev,
      {
        name: loc.name || `Stop ${prev.length}`,
        x: Number(loc.x),
        y: Number(loc.y),
        demand: Number(loc.demand || 10),
        status: "pending"
      }
    ])
  }

  const deleteLocation = (index) => {
    setLocations(prev => prev.filter((_, i) => i !== index))
  }

  const optimize = async () => {
    try {

      setLocations(prev =>
      prev.map(loc =>
        loc.status === "depot"
          ? loc
          : { ...loc, status: "pending" }
      )
    )

    const baseline = generateNonOptimized()
    setNonOptimizedResult(baseline)
    const res = await axios.post("http://localhost:4000/optimize", {
      vehicles,
      locations
    })
      setResult(res.data)
    } catch (e) {
      console.error("Optimization failed", e)
      alert("Optimization failed. Check backend server.")
    }
  }

  const clearHistory = async () => {
    try {
      await axios.delete("http://localhost:4000/routes")
      setResult(null)
    } catch (e) {
      console.error("Clear history failed", e)
    }
  }

  return (
    <Dashboard
      result={result}
      locations={locations}
      setLocations={setLocations}
      addLocation={addLocation}
      deleteLocation={deleteLocation}
      optimize={optimize}
      nonOptimized={nonOptimizedResult}
      setVehicles={setVehicles}
      clearHistory={clearHistory}
    />
  )
}

export default App