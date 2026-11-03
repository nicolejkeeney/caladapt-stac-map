import { useEffect } from "react";
import MapView from "./components/MapView";
import CatalogPanel from "./components/CatalogPanel";
import BoundaryPanel, { BoundaryBar } from "./components/BoundaryPanel";
import ClimatePanel, { readoutFor } from "./components/ClimatePanel";
import PlacePanel from "./components/PlacePanel";
import TimeBar from "./components/TimeBar";
import WarmingBar from "./components/WarmingBar";
import WarmingPanel, { warmingReadout } from "./components/WarmingPanel";
import { DATASET_VIEWS, STAC_BROWSER } from "./config";
import { useBoundary } from "./useBoundary";
import { useCatalog } from "./useCatalog";
import { useClimate } from "./useClimate";
import { usePlaces } from "./usePlaces";
import { useWarming } from "./useWarming";

export default function App() {
  const catalog = useCatalog();
  const view = catalog.selected ? DATASET_VIEWS[catalog.selected.id] : undefined;
  const climate = useClimate(view?.kind === "climate", view?.kind === "climate" ? catalog.selected?.id : undefined);
  const warming = useWarming(view?.kind === "warming");
  const places = usePlaces(view?.kind === "places");
  const boundary = useBoundary(view?.kind === "boundary", view?.kind === "boundary" ? catalog.selected?.id : undefined);

  const placeDataset = view?.placeDataset;
  useEffect(() => {
    if (placeDataset) places.setDatasetId(placeDataset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeDataset]);

  const readout = view?.kind === "climate" ? readoutFor(climate) : view?.kind === "warming" ? warmingReadout(warming) : null;

  return (
    <div className="app">
      {/* Shared with STAC Browser, so the map and catalog read as one site */}
      <header className="site-header">
        <div className="site-title">
          <img src="bear.png" alt="" />
          <span>Cal-Adapt climate data catalog</span>
        </div>
        <nav className="site-tabs" aria-label="Views">
          <a href={STAC_BROWSER}>Catalog</a>
          <a href="./" aria-current="page">
            Map
          </a>
        </nav>
      </header>

      <div className="workspace">
        <aside className="panel">
          {/* The site header already names the page, so the heading is for screen readers;
              the intro shows only until a dataset is picked */}
          <h1 className="visually-hidden">California climate data map</h1>
          {!catalog.selected && (
            <p className="intro">Explore how California's climate is projected to change, and download the data behind it.</p>
          )}

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
                ) : view?.kind === "boundary" ? (
                  <BoundaryPanel b={boundary} />
                ) : undefined
              }
            />
          </div>

          <footer className="panel-foot">
            <span>Data from Cal-Adapt</span>
          </footer>
        </aside>

        <main className="stage">
          <MapView
            raster={climate.raster ?? warming.raster}
            rasterTileSize={climate.raster ? climate.dataset.tileSize : undefined}
            places={places.layer ?? boundary.layer}
            footprint={view ? null : catalog.footprint}
            selectedPlaceId={(view?.kind === "boundary" ? boundary.place : places.place)?.id ?? null}
            readout={readout}
            onReadoutClose={() => (view?.kind === "climate" ? climate.setProbeAt(null) : warming.setProbeAt(null))}
            onPlaceClick={(id, name) => (view?.kind === "boundary" ? boundary.setPlace : places.setPlace)({ id, name })}
            onMapClick={(lngLat) => {
              if (view?.kind === "climate") climate.setProbeAt(lngLat);
              if (view?.kind === "warming") warming.setProbeAt(lngLat);
            }}
          />
          {view?.kind === "climate" && <TimeBar c={climate} />}
          {view?.kind === "warming" && <WarmingBar w={warming} />}
          {view?.kind === "boundary" && <BoundaryBar b={boundary} />}
        </main>
      </div>
    </div>
  );
}
