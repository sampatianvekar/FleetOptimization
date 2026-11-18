import LocationForm from "./LocationForm"

function ControlPanel({
  vehicles, setVehicles, capacity, setCapacity, addLocation, onError,
  pickMode, setPickMode, loadSample, optimize, clearHistory, loading,
}) {
  return (
    <aside className="sidebar">
      <h1>🚛 Fleet Optimization</h1>
      <p className="muted">Ant Colony routing for delivery fleets</p>

      <h2>Add stops</h2>
      <LocationForm addLocation={addLocation} onError={onError} />
      <label className="check">
        <input type="checkbox" checked={pickMode} onChange={e => setPickMode(e.target.checked)} />
        Click the map to add stops
      </label>
      <button className="btn btn-ghost" onClick={loadSample}>Load sample data (Bengaluru)</button>

      <h2>Fleet</h2>
      <div className="row">
        <label className="field">Vehicles
          <input type="number" min="1" max="50" value={vehicles}
            onChange={e => setVehicles(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
        </label>
        <label className="field">Capacity
          <input type="number" min="1" value={capacity}
            onChange={e => setCapacity(Math.max(1, Number(e.target.value) || 1))} />
        </label>
      </div>

      <button className="btn btn-primary" onClick={optimize} disabled={loading}>
        {loading ? "Optimizing…" : "Optimize fleet"}
      </button>
      <button className="btn btn-danger" onClick={clearHistory}>Clear history</button>
    </aside>
  )
}

export default ControlPanel
