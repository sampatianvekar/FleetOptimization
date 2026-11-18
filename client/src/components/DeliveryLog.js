function DeliveryLog({ locations }) {
  const delivered = locations.filter(l => l.status === "delivered")
  return (
    <section className="log" aria-live="polite">
      <h3>Live delivery log</h3>
      {delivered.length === 0 ? <p>No deliveries completed yet…</p> : delivered.map(l => <p key={l.name + l.x + l.y}>✅ {l.name} delivered</p>)}
    </section>
  )
}

export default DeliveryLog
