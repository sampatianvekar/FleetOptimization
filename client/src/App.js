import { useCallback, useEffect, useRef, useState } from "react"
import api, { clearToken, errorMessage, getToken, setToken } from "./api"
import ControlPanel from "./components/ControlPanel"
import DeliveryLog from "./components/DeliveryLog"
import MapView from "./components/MapView"
import StatsPanel from "./components/StatsPanel"
import { DEPOT, SAMPLE_STOPS } from "./utils/sample"
import "./App.css"

function App() {
  const [locations, setLocations] = useState([DEPOT])
  const [vehicles, setVehicles] = useState(2)
  const [capacity, setCapacity] = useState(100)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [fitSignal, setFitSignal] = useState(0)
  const [metrics, setMetrics] = useState({})
  const [history, setHistory] = useState([])
  const [toast, setToast] = useState(null)
  const routeIdRef = useRef(null)

  const notify = useCallback((message, type = "error") => setToast({ message, type, id: Date.now() }), [])
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const refresh = useCallback(() => {
    api.get("/routes", { params: { limit: 20 } }).then(r => setHistory(r.data)).catch(() => setHistory([]))
    api.get("/metrics").then(r => setMetrics(r.data)).catch(() => setMetrics({}))
  }, [])
  useEffect(refresh, [refresh])

  // Any edit invalidates the current plan (route indexes would point at the wrong stops).
  const invalidate = () => { setResult(null); routeIdRef.current = null }

  const addLocation = loc => {
    invalidate()
    setLocations(prev => [...prev, {
      name: loc.name || `Stop ${prev.length}`,
      x: Number(loc.x), y: Number(loc.y),
      demand: loc.demand ?? 10, // ?? so a demand of 0 is respected
      status: "pending",
    }])
  }
  const deleteLocation = index => { invalidate(); setLocations(prev => prev.filter((_, i) => i !== index)) }
  const loadSample = () => { invalidate(); setLocations([DEPOT, ...SAMPLE_STOPS]); setFitSignal(s => s + 1) }

  const optimize = async () => {
    if (locations.length < 2) return notify("Add at least one stop first, or load the sample data.")
    setLoading(true)
    try {
      const { data } = await api.post("/optimize", { vehicles, capacity, locations })
      routeIdRef.current = data.routeId
      setLocations(prev => prev.map((l, i) => l.status === "depot" ? l : { ...l, status: data.unserved?.includes(i) ? "unserved" : "pending" }))
      setResult(data)
      setFitSignal(s => s + 1)
      if (data.unserved?.length) notify(`${data.unserved.length} stop(s) exceed fleet capacity.`, "warn")
      refresh()
    } catch (e) {
      notify(errorMessage(e, "Optimization failed"))
    } finally {
      setLoading(false)
    }
  }

  const onStopDelivered = useCallback(index => {
    setLocations(prev => prev.map((l, i) => (i === index && l.status === "pending" ? { ...l, status: "delivered" } : l)))
    if (routeIdRef.current) {
      api.patch(`/routes/${routeIdRef.current}/stops/${index}`, { status: "delivered" })
        .then(() => setTimeout(refresh, 300))
        .catch(() => {})
    }
  }, [refresh])

  // Clearing history needs the admin password; the token is kept for this browser session only.
  const adminToken = async () => {
    const existing = getToken()
    if (existing) return existing
    const password = window.prompt("Admin password (required to clear history):")
    if (password === null) return null
    const { data } = await api.post("/auth/login", { password })
    setToken(data.token)
    return data.token
  }

  const clearHistory = async () => {
    if (!window.confirm("Delete all saved route history?")) return
    try {
      const token = await adminToken()
      if (!token) return
      await api.delete("/routes", { headers: { Authorization: `Bearer ${token}` } })
      refresh()
      notify("History cleared", "ok")
    } catch (e) {
      if (e?.response?.status === 401) clearToken() // expired or wrong: ask again next time
      notify(errorMessage(e, "Could not clear history"))
    }
  }

  return (
    <div className="app">
      <ControlPanel
        vehicles={vehicles} setVehicles={setVehicles} capacity={capacity} setCapacity={setCapacity}
        addLocation={addLocation} onError={notify} pickMode={pickMode} setPickMode={setPickMode}
        loadSample={loadSample} optimize={optimize} clearHistory={clearHistory} loading={loading}
      />
      <main className="main">
        <MapView
          locations={locations} result={result} pickMode={pickMode} fitSignal={fitSignal}
          onMapClick={addLocation} onStopDelivered={onStopDelivered}
        />
        <DeliveryLog locations={locations} />
      </main>
      <StatsPanel result={result} locations={locations} metrics={metrics} history={history} deleteLocation={deleteLocation} />
      {toast && <div key={toast.id} className={`toast toast-${toast.type}`} role="status">{toast.message}</div>}
    </div>
  )
}

export default App
