// Approximate Bengaluru neighbourhood centres for a quick demo.
export const DEPOT = { name: "Depot", x: 77.6, y: 12.9, demand: 0, status: "depot" }

export const SAMPLE_STOPS = [
  ["Koramangala", 77.6245, 12.9352, 20],
  ["Indiranagar", 77.6408, 12.9784, 15],
  ["Whitefield", 77.75, 12.9698, 25],
  ["Electronic City", 77.677, 12.8452, 30],
  ["Jayanagar", 77.5838, 12.925, 10],
  ["Malleshwaram", 77.57, 13.0035, 15],
  ["Hebbal", 77.597, 13.0358, 20],
  ["Marathahalli", 77.6974, 12.9591, 15],
  ["HSR Layout", 77.6412, 12.9116, 20],
  ["Yelahanka", 77.5963, 13.1007, 25],
].map(([name, x, y, demand]) => ({ name, x, y, demand, status: "pending" }))
