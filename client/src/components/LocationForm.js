import { useState } from "react"
import { parseCoordinate, parseDemand } from "../utils/validate"

function LocationForm({ addLocation, onError }) {
  const [form, setForm] = useState({ name: "", x: "", y: "", demand: "" })
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const submit = e => {
    e.preventDefault()
    const x = parseCoordinate(form.x, "lon")
    const y = parseCoordinate(form.y, "lat")
    const demand = parseDemand(form.demand)
    const bad = x.error || y.error || demand.error
    if (bad) return onError(bad)
    addLocation({ name: form.name.trim(), x: x.value, y: y.value, demand: demand.value })
    setForm({ name: "", x: "", y: "", demand: "" })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <input aria-label="Stop name" placeholder="Name (optional)" value={form.name} onChange={set("name")} />
      <div className="row">
        <input aria-label="Longitude" placeholder="Longitude (x)" inputMode="decimal" value={form.x} onChange={set("x")} />
        <input aria-label="Latitude" placeholder="Latitude (y)" inputMode="decimal" value={form.y} onChange={set("y")} />
      </div>
      <input aria-label="Demand" placeholder="Demand (default 10)" inputMode="decimal" value={form.demand} onChange={set("demand")} />
      <button type="submit" className="btn btn-dark">Add location</button>
    </form>
  )
}

export default LocationForm
