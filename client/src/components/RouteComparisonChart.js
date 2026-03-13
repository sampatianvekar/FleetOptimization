import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"
import { formatETA } from "../utils/formatETA"

function RouteComparisonChart({ optimized, nonOptimized }) {

  const data = [
    {
      name: "Distance (km)",
      Optimized: optimized?.distance_km ?? 0,
      NonOptimized: nonOptimized?.distance_km ?? 0
    },
    {
      name: "ETA (hrs)",
      Optimized: optimized?.eta_hours ?? 0,
      NonOptimized: nonOptimized?.eta_hours ?? 0
    }
  ]

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value, name) => name.includes("ETA") ? formatETA(value) : `${value} km`
         }/>
          <Legend />
          <Bar dataKey="Optimized" name="Optimized" fill="#10b981"  radius={[6,6,0,0]} />
          <Bar dataKey="NonOptimized" name="Non Optimized" fill="#ef4444" radius={[6,6,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RouteComparisonChart