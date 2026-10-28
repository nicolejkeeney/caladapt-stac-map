import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, RasterTileSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CA_BOUNDS, PlaceKind } from "../config";

const BASEMAP = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const INK = "#222222";
const PACIFIC = "#33658a"; // brand cobalt
const OCEAN = "#4d9de0"; // brand ocean blue
const HILLS = "#f79226"; // brand deep orange

export interface PlacesLayer {
  key: string;
  geojson: GeoJSON.FeatureCollection;
  kind: PlaceKind;
  idProperty: string;
  nameProperty: string;
}

export interface Readout {
  lngLat: [number, number];
  title: string;
  value: string;
  detail?: string;
  sub: string;
}

interface Props {
  raster: string | null;
  places: PlacesLayer | null;
  footprint: GeoJSON.FeatureCollection | null;
  selectedPlaceId: string | null;
  readout: Readout | null;
  onReadoutClose: () => void;
  onPlaceClick: (id: string, name: string) => void;
  onMapClick: (lngLat: [number, number]) => void;
}

const FOOTPRINT_LAYERS = ["footprint-fill", "footprint-line", "footprint-circle"];
const PLACE_LAYERS = ["places-fill", "places-line", "places-hover", "places-circle", "places-selected"];

export default function MapView({ raster, places, footprint, selectedPlaceId, readout, onReadoutClose, onPlaceClick, onMapClick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [ready, setReady] = useState(false);

  // Handlers change every render; keep the latest in a ref so map listeners
  // are attached only once.
  const handlers = useRef({ onPlaceClick, onMapClick, onReadoutClose, places });
  handlers.current = { onPlaceClick, onMapClick, onReadoutClose, places };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: BASEMAP,
      bounds: CA_BOUNDS,
      fitBoundsOptions: { padding: { top: 24, left: 24, right: 24, bottom: 150 } },
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    map.on("load", () => setReady(true));

    map.on("click", (e) => {
      const { places: p, onPlaceClick: placeClick, onMapClick: mapClick } = handlers.current;
      const layers = ["places-fill", "places-circle"].filter((l) => map.getLayer(l));
      const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined;
      if (hit && p) {
        placeClick(String(hit.properties[p.idProperty]), String(hit.properties[p.nameProperty] ?? ""));
      } else {
        mapClick([e.lngLat.lng, e.lngLat.lat]);
      }
    });

    map.on("mousemove", (e) => {
      const p = handlers.current.places;
      const layers = ["places-fill", "places-circle"].filter((l) => map.getLayer(l));
      const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
      if (map.getLayer("places-hover") && p) {
        map.setFilter("places-hover", ["==", ["get", p.idProperty], hit ? hit.properties[p.idProperty] : "__none__"]);
      }
    });

    return () => map.remove();
  }, []);

  // Gridded climate layer, drawn beneath the basemap's labels
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource("climate") as RasterTileSource | undefined;
    if (!raster) {
      if (map.getLayer("climate")) map.removeLayer("climate");
      if (source) map.removeSource("climate");
      return;
    }
    if (source) {
      source.setTiles([raster]);
      return;
    }
    map.addSource("climate", { type: "raster", tiles: [raster], tileSize: 256, bounds: [-128.5, 29.5, -111, 45.1] });
    const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    map.addLayer({ id: "climate", type: "raster", source: "climate", paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 } }, firstLabel);
  }, [raster, ready]);

  // Counties or stations
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    PLACE_LAYERS.forEach((l) => map.getLayer(l) && map.removeLayer(l));
    if (map.getSource("places")) map.removeSource("places");
    if (!places) return;

    map.addSource("places", { type: "geojson", data: places.geojson });
    const none = ["==", ["get", places.idProperty], "__none__"] as any;
    if (places.kind === "county") {
      map.addLayer({ id: "places-fill", type: "fill", source: "places", paint: { "fill-color": OCEAN, "fill-opacity": 0.1 } });
      map.addLayer({ id: "places-line", type: "line", source: "places", paint: { "line-color": PACIFIC, "line-width": 0.8, "line-opacity": 0.6 } });
      map.addLayer({ id: "places-hover", type: "fill", source: "places", filter: none, paint: { "fill-color": OCEAN, "fill-opacity": 0.3 } });
      map.addLayer({ id: "places-selected", type: "line", source: "places", filter: none, paint: { "line-color": HILLS, "line-width": 3 } });
    } else {
      const dense = places.geojson.features.length > 1000;
      const radius: any = dense ? ["interpolate", ["linear"], ["zoom"], 4, 1.6, 8, 4, 12, 7] : ["interpolate", ["linear"], ["zoom"], 4, 4, 10, 8];
      map.addLayer({
        id: "places-circle",
        type: "circle",
        source: "places",
        paint: { "circle-radius": radius, "circle-color": PACIFIC, "circle-opacity": 0.75, "circle-stroke-color": "#fff", "circle-stroke-width": dense ? 0.4 : 1.2 },
      });
      map.addLayer({
        id: "places-hover",
        type: "circle",
        source: "places",
        filter: none,
        paint: { "circle-radius": 9, "circle-color": "transparent", "circle-stroke-color": INK, "circle-stroke-width": 2 },
      });
      map.addLayer({
        id: "places-selected",
        type: "circle",
        source: "places",
        filter: none,
        paint: { "circle-radius": 9, "circle-color": HILLS, "circle-stroke-color": INK, "circle-stroke-width": 2 },
      });
    }
  }, [places, ready]);

  // Where a dataset from Browse has data. Hovering a station shows its name.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    FOOTPRINT_LAYERS.forEach((l) => map.getLayer(l) && map.removeLayer(l));
    if (map.getSource("footprint")) map.removeSource("footprint");
    if (!footprint) return;

    map.addSource("footprint", { type: "geojson", data: footprint });
    const polygons = ["==", ["geometry-type"], "Polygon"] as any;
    map.addLayer({ id: "footprint-fill", type: "fill", source: "footprint", filter: polygons, paint: { "fill-color": OCEAN, "fill-opacity": 0.08 } });
    map.addLayer({ id: "footprint-line", type: "line", source: "footprint", filter: polygons, paint: { "line-color": PACIFIC, "line-width": 1.5 } });
    map.addLayer({
      id: "footprint-circle",
      type: "circle",
      source: "footprint",
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 6, "circle-color": HILLS, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 },
    });

    const bounds = new maplibregl.LngLatBounds();
    const extend = (c: any): void => (typeof c[0] === "number" ? void bounds.extend(c) : c.forEach(extend));
    footprint.features.forEach((f) => f.geometry && "coordinates" in f.geometry && extend(f.geometry.coordinates));
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 7 });

    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "name-tip" });
    const show = (e: maplibregl.MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties ?? {};
      const name = p.station_name ?? p.county_name ?? p.name;
      if (name) tip.setLngLat(e.lngLat).setText(String(name)).addTo(map);
    };
    const hide = () => tip.remove();
    map.on("mousemove", "footprint-circle", show);
    map.on("mouseleave", "footprint-circle", hide);
    return () => {
      map.off("mousemove", "footprint-circle", show);
      map.off("mouseleave", "footprint-circle", hide);
      tip.remove();
    };
  }, [footprint, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !places || !map.getLayer("places-selected")) return;
    map.setFilter("places-selected", ["==", ["get", places.idProperty], selectedPlaceId ?? "__none__"]);
  }, [selectedPlaceId, places, ready]);

  // Marker plus a popup showing the value at the clicked spot
  const at = readout?.lngLat;
  useEffect(() => {
    const map = mapRef.current;
    const old = popupRef.current;
    popupRef.current = null; // so removing it doesn't count as the user closing it
    old?.remove();
    markerRef.current?.remove();
    markerRef.current = null;
    if (!map || !at) return;
    markerRef.current = new maplibregl.Marker({ color: HILLS }).setLngLat(at).addTo(map);
    const popup = new maplibregl.Popup({ offset: [0, -36], closeOnClick: false, maxWidth: "260px", className: "readout-popup" })
      .setLngLat(at)
      .addTo(map);
    popup.on("close", () => {
      if (popupRef.current === popup) handlers.current.onReadoutClose();
    });
    popupRef.current = popup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at?.[0], at?.[1]]);

  useEffect(() => {
    if (!popupRef.current || !readout) return;
    const el = document.createElement("div");
    const add = (tag: string, cls: string, text: string) => {
      const n = document.createElement(tag);
      n.className = cls;
      n.textContent = text;
      el.appendChild(n);
    };
    add("p", "popup-title", readout.title);
    add("p", "popup-value", readout.value);
    if (readout.detail) add("p", "popup-detail", readout.detail);
    add("p", "popup-sub", readout.sub);
    popupRef.current.setDOMContent(el);
  }, [readout]);

  // Keep the canvas sized when the layout changes (e.g. phone rotation)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !container.current) return;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={container} className="map" role="region" aria-label="Map of California" />;
}

