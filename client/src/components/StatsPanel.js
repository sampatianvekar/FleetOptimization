import RouteComparisonChart from "./RouteComparisonChart"
import ConvergenceChart from "./ConvergenceChart"
import { formatETA } from "../utils/formatETA"
import { routeColor } from "../utils/colors"

function StatsPanel({ result, locations, metrics, history, deleteLocation }) {
  const stops = locations.filter(l => l.status !== "depot")
  const delivered = stops.filter(l => l.status === "delivered").length
  const pending = stops.filter(l => l.status === "pending").length

  return (
    <aside className="stats">
      <h2>Analytics</h2>

      {result && (
        <div className="impact">
          <div className="card"><strong>{result.distance_saved_km ?? 0} km</strong><span>Distance saved</span></div>
          <div className="card"><strong>{formatETA((result.baseline?.eta_hours ?? 0) - result.eta_hours)}</strong><span>Time saved</span></div>
          <div className="card"><strong>{result.improvement_pct ?? 0}%</strong><span>Shorter than baseline</span></div>
        </div>
      )}

      {result?.unserved?.length > 0 && (
        <div className="warn" role="alert">
          ⚠ {result.unserved.length} stop(s) could not be served (not enough vehicle capacity):{" "}
          {result.unserved.map(i => locations[i]?.name).filter(Boolean).join(", ")}. Add vehicles or capacity.
        </div>
      )}

      {result?.baseline?.unserved?.length > 0 && (
        <p className="muted note">
          Note: the baseline plan strands {result.baseline.unserved.length} stop(s) that the optimizer manages to serve, so the real saving is larger than shown.
        </p>
      )}

      <dl className="kv">
        <dt>Total distance</dt><dd>{result?.distance_km ?? 0} km</dd>
        <dt>Total driving time</dt><dd>{formatETA(result?.eta_hours ?? 0)}</dd>
        <dt>Delivered</dt><dd>{delivered}</dd>
        <dt>Pending</dt><dd>{pending}</dd>
      </dl>

      {result?.route_stats?.length > 0 && (
        <>
          <h3>Vehicles</h3>
          <ul className="plain">
            {result.route_stats.map((s, k) => (
              <li key={s.vehicle}>
                <span className="swatch" style={{ background: routeColor(k) }} />
                <b>Vehicle {s.vehicle}</b> · {s.stops} stops · {s.distance_km} km · load {s.load}/{s.capacity}
              </li>
            ))}
          </ul>
        </>
      )}

      <RouteComparisonChart optimized={result} baseline={result?.baseline} />
      <ConvergenceChart history={result?.convergence} />

      <h2>Fleet performance</h2>
      <dl className="kv">
        <dt>Total plans</dt><dd>{metrics.totalRoutes ?? 0}</dd>
        <dt>Deliveries</dt><dd>{metrics.totalDeliveries ?? 0}</dd>
        <dt>Success rate</dt><dd>{(metrics.successRate ?? 0).toFixed(1)}%</dd>
        <dt>Avg ETA</dt><dd>{formatETA(metrics.avgETA ?? 0)}</dd>
        <dt>Avg distance</dt><dd>{(metrics.avgDistance ?? 0).toFixed(1)} km</dd>
        <dt>Total km saved</dt><dd>{(metrics.totalDistanceSaved ?? 0).toFixed(1)} km</dd>
      </dl>

      <h2>Locations</h2>
      <ul className="plain">
        {locations.map((loc, i) => (
          <li key={`${loc.name}-${i}`} className="loc">
            <span>{i}. {loc.name} <em className={`status status-${loc.status}`}>{loc.status}</em> {loc.status !== "depot" && <small>· demand {loc.demand}</small>}</span>
            {loc.status !== "depot" && <button className="link" onClick={() => deleteLocation(i)} aria-label={`Delete ${loc.name}`}>Delete</button>}
          </li>
        ))}
      </ul>

      <h2>Route history</h2>
      {history.length === 0 && <p className="muted">No saved plans yet.</p>}
      {history.map(h => (
        <details key={h._id} className="hist">
          <summary>
            {new Date(h.createdAt).toLocaleString()} · {h.totalDistance ?? 0} km · {formatETA(h.eta ?? 0)}
          </summary>
          {h.routes?.map((route, r) => (
            <p key={r}><b>Vehicle {r + 1}:</b> {route.map(i => h.locations?.[i]?.name ?? i).join(" → ")}</p>
          ))}
        </details>
      ))}
    </aside>
  )
}

export default StatsPanel
