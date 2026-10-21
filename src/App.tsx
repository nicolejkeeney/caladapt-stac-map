import { useState } from "react";
import MapView from "./components/MapView";
import ClimatePanel, { readoutFor } from "./components/ClimatePanel";
import PlacePanel from "./components/PlacePanel";
import TimeBar from "./components/TimeBar";
import WarmingBar from "./components/WarmingBar";
import WarmingPanel, { warmingReadout } from "./components/WarmingPanel";
import { STAC_BROWSER } from "./config";
import { useClimate } from "./useClimate";
import { usePlaces } from "./usePlaces";
import { useWarming } from "./useWarming";

type Mode = "climate" | "warming" | "places";

const MODES: { id: Mode; label: string }[] = [
  { id: "climate", label: "Year by year" },
  { id: "warming", label: "Warming levels" },
  { id: "places", label: "Data for a place" },
];

export default function App() {
  const [mode, setMode] = useState<Mode>("climate");
  const climate = useClimate(mode === "climate");
  const warming = useWarming(mode === "warming");
  const places = usePlaces(mode === "places");

  const readout = mode === "climate" ? readoutFor(climate) : mode === "warming" ? warmingReadout(warming) : null;

  return (
    <div className="app">
      <aside className="panel">
        <header className="masthead">
          <h1>California climate data map</h1>
          <p>Explore how California's climate is projected to change, and download the data behind it.</p>
        </header>

        <div className="modes" role="tablist" aria-label="What do you want to do?">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="panel-body" role="tabpanel">
          {mode === "climate" && <ClimatePanel c={climate} />}
          {mode === "warming" && <WarmingPanel w={warming} />}
          {mode === "places" && <PlacePanel p={places} />}
        </div>

        <footer className="panel-foot">
          <a href={STAC_BROWSER} target="_blank" rel="noreferrer">
            Browse every dataset in the catalog
          </a>
          <span>Data from Cal-Adapt</span>
        </footer>
      </aside>

      <main className="stage">
        <MapView
          raster={climate.raster ?? warming.raster}
          places={places.layer}
          selectedPlaceId={places.place?.id ?? null}
          readout={readout}
          onReadoutClose={() => (mode === "climate" ? climate.setProbeAt(null) : warming.setProbeAt(null))}
          onPlaceClick={(id, name) => places.setPlace({ id, name })}
          onMapClick={(lngLat) => {
            if (mode === "climate") climate.setProbeAt(lngLat);
            if (mode === "warming") warming.setProbeAt(lngLat);
          }}
        />
        {mode === "climate" && <TimeBar c={climate} />}
        {mode === "warming" && <WarmingBar w={warming} />}
      </main>
    </div>
  );
}
