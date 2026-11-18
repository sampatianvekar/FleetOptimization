import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatETA } from "../utils/formatETA"

function RouteComparisonChart({ optimized, baseline }) {
  const data = [
    { name: "Distance (km)", Optimized: optimized?.distance_km ?? 0, Baseline: baseline?.distance_km ?? 0 },
    // minutes, not hours: on a shared axis with km an "hours" bar would be invisible
    { name: "Driving time (min)", Optimized: Math.round((optimized?.eta_hours ?? 0) * 60), Baseline: Math.round((baseline?.eta_hours ?? 0) * 60) },
  ]
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
          <YAxis />
          <Tooltip formatter={(v, _n, item) => (item?.payload?.name?.startsWith("Driving") ? formatETA(v / 60) : `${v} km`)} />
          <Legend />
          <Bar dataKey="Optimized" fill="#10b981" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Baseline" name="Baseline (input order)" fill="#ef4444" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RouteComparisonChart
