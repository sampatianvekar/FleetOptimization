import { formatETA } from "./formatETA"
import { parseCoordinate, parseDemand } from "./validate"

test("formatETA", () => {
  expect(formatETA(1.5)).toBe("1h 30m")
  expect(formatETA(0)).toBe("0h 0m")
  expect(formatETA(undefined)).toBe("0h 0m")
  expect(formatETA(NaN)).toBe("0h 0m")
  expect(formatETA(0.999)).toBe("1h 0m")
})

test("coordinate validation", () => {
  expect(parseCoordinate("77.6", "lon").value).toBe(77.6)
  expect(parseCoordinate("", "lat").error).toMatch(/number/)
  expect(parseCoordinate("91", "lat").error).toMatch(/-90 and 90/)
  expect(parseCoordinate("-181", "lon").error).toMatch(/-180 and 180/)
})

test("demand validation keeps zero", () => {
  expect(parseDemand("").value).toBe(10)
  expect(parseDemand("0").value).toBe(0)
  expect(parseDemand("-1").error).toBeTruthy()
})
