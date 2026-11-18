import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import api, { clearToken, getToken, setToken } from "./api"
import App from "./App"

jest.mock("./api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  errorMessage: e => e?.response?.data?.error || "Something went wrong",
  getToken: jest.fn(),
  setToken: jest.fn(),
  clearToken: jest.fn(),
}))
// OpenLayers and recharts need a real browser; they have their own coverage upstream.
jest.mock("./components/MapView", () => () => <div data-testid="map" />)
jest.mock("./components/RouteComparisonChart", () => () => <div data-testid="chart" />)
jest.mock("./components/ConvergenceChart", () => () => null)

const renderApp = () => act(async () => { render(<App />) }) // let the initial fetches settle

beforeEach(() => {
  api.get.mockResolvedValue({ data: [] })
  api.patch.mockResolvedValue({ data: { ok: true } })
})

test("loads sample data and shows an optimization result", async () => {
  api.post.mockResolvedValue({
    data: {
      routes: [[0, 1, 2, 0]], distance_km: 30, eta_hours: 0.75, distance_saved_km: 20, improvement_pct: 40,
      baseline: { distance_km: 50, eta_hours: 1.25 }, unserved: [], route_stats: [{ vehicle: 1, stops: 2, load: 35, capacity: 100, distance_km: 30, eta_minutes: 45 }],
      convergence: [], routeId: "abc",
    },
  })
  await renderApp()
  fireEvent.click(screen.getByText(/load sample data/i))
  expect(screen.getByText(/Koramangala/)).toBeInTheDocument()
  fireEvent.click(screen.getByText(/optimize fleet/i))
  await waitFor(() => expect(screen.getByText("20 km")).toBeInTheDocument())
  expect(api.post).toHaveBeenCalledWith("/optimize", expect.objectContaining({ vehicles: 2, capacity: 100 }))
  expect(screen.getByText("40%")).toBeInTheDocument()
})

test("rejects invalid coordinates with a message instead of calling the API", async () => {
  await renderApp()
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "500" } })
  fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "12.9" } })
  fireEvent.click(screen.getByText("Add location"))
  expect(screen.getByRole("status")).toHaveTextContent(/between -180 and 180/)
})

test("accepts a demand of 0 (previously silently turned into 10)", async () => {
  await renderApp()
  fireEvent.change(screen.getByLabelText("Stop name"), { target: { value: "Pickup" } })
  fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "77.6" } })
  fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "12.9" } })
  fireEvent.change(screen.getByLabelText("Demand"), { target: { value: "0" } })
  fireEvent.click(screen.getByText("Add location"))
  expect(screen.getByText(/demand 0/)).toBeInTheDocument()
})

test("optimizing with only the depot shows guidance", async () => {
  await renderApp()
  fireEvent.click(screen.getByText(/optimize fleet/i))
  expect(screen.getByRole("status")).toHaveTextContent(/add at least one stop/i)
  expect(api.post).not.toHaveBeenCalled()
})

test("surfaces server error messages", async () => {
  api.post.mockRejectedValue({ response: { data: { error: "Optimizer service is not reachable." } } })
  await renderApp()
  fireEvent.click(screen.getByText(/load sample data/i))
  fireEvent.click(screen.getByText(/optimize fleet/i))
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/not reachable/))
})

test("clearing history asks for the admin password, logs in, and sends the bearer token", async () => {
  getToken.mockReturnValue(null)
  api.post.mockResolvedValue({ data: { token: "tok123" } })
  api.delete.mockResolvedValue({ data: {} })
  jest.spyOn(window, "confirm").mockReturnValue(true)
  jest.spyOn(window, "prompt").mockReturnValue("hunter2")
  await renderApp()
  fireEvent.click(screen.getByText(/clear history/i))
  await waitFor(() => expect(api.delete).toHaveBeenCalled())
  expect(api.post).toHaveBeenCalledWith("/auth/login", { password: "hunter2" })
  expect(setToken).toHaveBeenCalledWith("tok123")
  expect(api.delete).toHaveBeenCalledWith("/routes", { headers: { Authorization: "Bearer tok123" } })
})

test("a rejected token is forgotten so the next attempt prompts again", async () => {
  getToken.mockReturnValue("stale")
  api.delete.mockRejectedValue({ response: { status: 401, data: { error: "Invalid or expired token, please log in again" } } })
  jest.spyOn(window, "confirm").mockReturnValue(true)
  await renderApp()
  fireEvent.click(screen.getByText(/clear history/i))
  await waitFor(() => expect(clearToken).toHaveBeenCalled())
  expect(screen.getByRole("status")).toHaveTextContent(/log in again/i)
})

test("cancelling the password prompt does nothing", async () => {
  getToken.mockReturnValue(null)
  jest.spyOn(window, "confirm").mockReturnValue(true)
  jest.spyOn(window, "prompt").mockReturnValue(null)
  await renderApp()
  fireEvent.click(screen.getByText(/clear history/i))
  await waitFor(() => expect(window.prompt).toHaveBeenCalled())
  expect(api.delete).not.toHaveBeenCalled()
})
