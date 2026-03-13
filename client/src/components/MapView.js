import React, { useEffect, useRef } from "react"
import Map from "ol/Map"
import View from "ol/View"
import TileLayer from "ol/layer/Tile"
import OSM from "ol/source/OSM"
import { fromLonLat } from "ol/proj"
import Feature from "ol/Feature"
import LineString from "ol/geom/LineString"
import VectorSource from "ol/source/Vector"
import VectorLayer from "ol/layer/Vector"
import { Stroke, Style, Fill, Circle as CircleStyle, Icon } from "ol/style"
import Point from "ol/geom/Point"

function MapView({ routes, locations, setLocations }) {

  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const vectorLayerRef = useRef(null)
  const deliveredRef = useRef({})  // prevent repeated state updates

  useEffect(() => {
    if (!mapInstance.current) {
      mapInstance.current = new Map({
        target: mapRef.current,
        layers: [new TileLayer({ source: new OSM() })],
        view: new View({ center: fromLonLat([77.7, 12.95]), zoom: 11 })
      })
    }

    if (vectorLayerRef.current) {
      mapInstance.current.removeLayer(vectorLayerRef.current)
    }

    const features = []

    // Location markers
    locations.forEach(loc => {
      const color = loc.status === "delivered" ? "green" :
                    loc.status === "in-transit" ? "orange" :
                    loc.status === "pending" ? "red" : "blue"

      const point = new Feature({ geometry: new Point(fromLonLat([loc.x, loc.y])) })
      point.setStyle(new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({ color }) }) }))
      features.push(point)
    })

    // Routes + truck animation
    if (routes) {
      routes.forEach(route => {
        const coords = route.map(i => fromLonLat([locations[i].x, locations[i].y]))

        // Route line
        const routeFeature = new Feature({ geometry: new LineString(coords) })
        routeFeature.setStyle(new Style({ stroke: new Stroke({ color: `hsl(${Math.random()*360},70%,50%)`, width: 4 }) }))
        features.push(routeFeature)

        // Truck
        const truckFeature = new Feature({ geometry: new Point(coords[0]) })
        truckFeature.setStyle(new Style({ image: new Icon({ src: "https://img.icons8.com/ios-filled/100/000000/truck.png", scale: 0.4, anchor: [0.5, 0.5] }) }))
        features.push(truckFeature)

        let routeIndex = 0, progress = 0

        function animate() {
          if (routeIndex >= coords.length - 1) return
          const start = coords[routeIndex], end = coords[routeIndex + 1]
          progress += 0.005

          const x = start[0] + (end[0]-start[0])*progress
          const y = start[1] + (end[1]-start[1])*progress
          truckFeature.getGeometry().setCoordinates([x, y])

          if (progress >= 1) {
            progress = 0
            routeIndex++
            const stopIndex = route[routeIndex]
            if (!deliveredRef.current[stopIndex]) {
              deliveredRef.current[stopIndex] = true
              setLocations(prev => {
                const updated = [...prev]
                if (updated[stopIndex]?.status === "pending") updated[stopIndex].status = "delivered"
                return updated
              })
            }
          }

          requestAnimationFrame(animate)
        }

        setTimeout(() => animate(), 500)
      })
    }

    const vectorSource = new VectorSource({ features })
    const vectorLayer = new VectorLayer({ source: vectorSource })
    mapInstance.current.addLayer(vectorLayer)
    vectorLayerRef.current = vectorLayer

  }, [routes, locations])

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
}

export default MapView