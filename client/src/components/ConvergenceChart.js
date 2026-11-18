import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

function ConvergenceChart({ history }) {
  if (!history?.length) return null
  const data = history.map((km, i) => ({ iteration: i + 1, km }))
  return (
    <>
      <h3>Colony convergence</h3>
      <div className="chart chart-sm">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="iteration" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip formatter={v => `${v} km`} labelFormatter={i => `Iteration ${i}`} />
            <Line type="monotone" dataKey="km" stroke="#2563eb" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export default ConvergenceChart
