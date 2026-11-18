import { useEffect, useRef } from "react"
import Map from "ol/Map"
import View from "ol/View"
import TileLayer from "ol/layer/Tile"
import OSM from "ol/source/OSM"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import Feature from "ol/Feature"
import Point from "ol/geom/Point"
import LineString from "ol/geom/LineString"
import { fromLonLat, toLonLat } from "ol/proj"
import { Circle as CircleStyle, Fill, RegularShape, Stroke, Style, Text } from "ol/style"
import { routeColor, STATUS_COLORS } from "../utils/colors"

const SEGMENT_MS = 1400 // time a truck takes per leg

const markerStyle = (loc, index) => {
  const fill = new Fill({ color: STATUS_COLORS[loc.status] || STATUS_COLORS.pending })
  const stroke = new Stroke({ color: "#fff", width: 2 })
  return new Style({
    image: loc.status === "depot"
      ? new RegularShape({ points: 4, radius: 10, angle: Math.PI / 4, fill, stroke })
      : new CircleStyle({ radius: 7, fill, stroke }),
    text: new Text({
      text: loc.status === "depot" ? "Depot" : `${index}. ${loc.name || ""}`,
      offsetY: -18, font: "600 11px Inter, sans-serif",
      fill: new Fill({ color: "#111827" }), stroke: new Stroke({ color: "#fff", width: 3 }),
    }),
  })
}

function MapView({ locations, result, pickMode, fitSignal, onMapClick, onStopDelivered }) {
  const targetRef = useRef(null)
  const mapRef = useRef(null)
  const markers = useRef(new VectorSource())
  const routesSrc = useRef(new VectorSource())
  // Latest props for long-lived callbacks (avoids re-subscribing / restarting animations).
  const latest = useRef({})
  latest.current = { locations, onMapClick, onStopDelivered, pickMode }

  // one-time map setup
  useEffect(() => {
    const map = new Map({
      target: targetRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source: routesSrc.current }),
        new VectorLayer({ source: markers.current }),
      ],
      view: new View({ center: fromLonLat([77.62, 12.95]), zoom: 11 }),
    })
    map.on("singleclick", e => {
      if (latest.current.pickMode) {
        const [x, y] = toLonLat(e.coordinate)
        latest.current.onMapClick({ x: Number(x.toFixed(5)), y: Number(y.toFixed(5)) })
      }
    })
    mapRef.current = map
    return () => map.setTarget(undefined)
  }, [])

  // markers follow the locations list
  useEffect(() => {
    markers.current.clear()
    markers.current.addFeatures(locations.map((loc, i) => {
      const f = new Feature({ geometry: new Point(fromLonLat([loc.x, loc.y])) })
      f.setStyle(markerStyle(loc, i))
      return f
    }))
  }, [locations])

  useEffect(() => {
    const el = targetRef.current
    if (el) el.style.cursor = pickMode ? "crosshair" : ""
  }, [pickMode])

  // zoom to fit when asked (sample loaded / new plan)
  useEffect(() => {
    if (!fitSignal || !mapRef.current || markers.current.isEmpty()) return
    mapRef.current.getView().fit(markers.current.getExtent(), { padding: [70, 70, 70, 70], maxZoom: 14, duration: 400 })
  }, [fitSignal])

  // routes + truck animation: restarted only when a new plan arrives
  useEffect(() => {
    routesSrc.current.clear()
    if (!result?.routes?.length) return undefined

    const locs = latest.current.locations
    const trucks = result.routes.map((route, k) => {
      const coords = route.map(i => fromLonLat([locs[i].x, locs[i].y]))
      const line = new Feature({ geometry: new LineString(coords) })
      line.setStyle(new Style({ stroke: new Stroke({ color: routeColor(k), width: 4, lineDash: [1, 0] }) }))
      const truck = new Feature({ geometry: new Point(coords[0]) })
      truck.setStyle(new Style({
        image: new CircleStyle({ radius: 13, fill: new Fill({ color: routeColor(k) }), stroke: new Stroke({ color: "#fff", width: 2 }) }),
        text: new Text({ text: "🚚", font: "14px sans-serif" }),
      }))
      routesSrc.current.addFeatures([line, truck])
      return { route, coords, truck, seg: 0, start: null, done: false }
    })

    let raf
    const tick = now => {
      let active = false
      trucks.forEach(t => {
        if (t.done) return
        if (t.start === null) t.start = now
        let p = (now - t.start) / SEGMENT_MS
        if (p >= 1) {
          t.seg += 1
          t.start = now
          p = 0
          const stop = t.route[t.seg]
          if (stop > 0) latest.current.onStopDelivered(stop)
          if (t.seg >= t.coords.length - 1) { t.done = true; return }
        }
        const [a, b] = [t.coords[t.seg], t.coords[t.seg + 1]]
        t.truck.getGeometry().setCoordinates([a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p])
        active = true
      })
      if (active) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [result])

  return <div ref={targetRef} className="map" aria-label="Route map" />
}

export default MapView
