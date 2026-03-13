import { useState } from "react"

function LocationForm({ addLocation }) {
  const [name, setName] = useState("")
  const [x, setX] = useState("")
  const [y, setY] = useState("")
  const [demand, setDemand] = useState("")

  const handleAdd = () => {
    if (!x || !y) return alert("Please enter coordinates")
    addLocation({ name, x, y, demand })
    setName(""); setX(""); setY(""); setDemand("")
  }

  return (
    <div>
      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Longitude (x)" value={x} onChange={e => setX(e.target.value)} />
      <input placeholder="Latitude (y)" value={y} onChange={e => setY(e.target.value)} />
      <input placeholder="Demand" value={demand} onChange={e => setDemand(e.target.value)} />
      <button onClick={handleAdd} style={{ marginTop: "5px", width: "100%", padding: "10px", background:"#47443fee", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", border: "none", color: "white" }}>Add Location</button>
    </div>
  )
}

export default LocationForm