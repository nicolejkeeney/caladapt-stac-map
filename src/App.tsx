import { useEffect } from "react";
import MapView from "./components/MapView";
import CatalogPanel from "./components/CatalogPanel";
import ClimatePanel, { readoutFor } from "./components/ClimatePanel";
import PlacePanel from "./components/PlacePanel";
import TimeBar from "./components/TimeBar";
import WarmingBar from "./components/WarmingBar";
import WarmingPanel, { warmingReadout } from "./components/WarmingPanel";
import { DATASET_VIEWS, STAC_BROWSER } from "./config";
import { useCatalog } from "./useCatalog";
import { useClimate } from "./useClimate";
import { usePlaces } from "./usePlaces";
import { useWarming } from "./useWarming";

export default function App() {
  const catalog = useCatalog();
  const view = catalog.selected ? DATASET_VIEWS[catalog.selected.id] : undefined;
  const climate = useClimate(view?.kind === "climate");
  const warming = useWarming(view?.kind === "warming");
  const places = usePlaces(view?.kind === "places");

  const placeDataset = view?.placeDataset;
  useEffect(() => {
    if (placeDataset) places.setDatasetId(placeDataset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeDataset]);

  const readout = view?.kind === "climate" ? readoutFor(climate) : view?.kind === "warming" ? warmingReadout(warming) : null;

  return (
    <div className="app">
      <aside className="panel">
        <header className="masthead">
          <div className="masthead-title">
            <img src="bear.png" alt="Cal-Adapt" />
            <h1>California climate data map</h1>
          </div>
          <p>Explore how California's climate is projected to change, and download the data behind it.</p>
        </header>

        <div className="panel-body">
          <CatalogPanel
            cat={catalog}
            mapControls={
              view?.kind === "climate" ? (
                <ClimatePanel c={climate} />
              ) : view?.kind === "warming" ? (
                <WarmingPanel w={warming} />
              ) : view?.kind === "places" ? (
                <PlacePanel p={places} variableLabels={catalog.selected?.["caladapt:variable_labels"]} />
              ) : undefined
            }
          />
        </div>

        <footer className="panel-foot">
          <a href={STAC_BROWSER} target="_blank" rel="noreferrer">
            Open the full catalog in STAC Browser
          </a>
          <span>Data from Cal-Adapt</span>
        </footer>
      </aside>

      <main className="stage">
        <MapView
          raster={climate.raster ?? warming.raster}
          places={places.layer}
          footprint={view ? null : catalog.footprint}
          selectedPlaceId={places.place?.id ?? null}
          readout={readout}
          onReadoutClose={() => (view?.kind === "climate" ? climate.setProbeAt(null) : warming.setProbeAt(null))}
          onPlaceClick={(id, name) => places.setPlace({ id, name })}
          onMapClick={(lngLat) => {
            if (view?.kind === "climate") climate.setProbeAt(lngLat);
            if (view?.kind === "warming") warming.setProbeAt(lngLat);
          }}
        />
        {view?.kind === "climate" && <TimeBar c={climate} />}
        {view?.kind === "warming" && <WarmingBar w={warming} />}
      </main>
    </div>
  );
}
