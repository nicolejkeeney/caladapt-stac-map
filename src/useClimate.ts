import { useEffect, useMemo, useRef, useState } from "react";
import { CLIMATE_LAYERS, FIRST_FUTURE_YEAR, SCENARIOS } from "./config";
import { buildColorTable } from "./colormap";
import { eq, pointValue, searchAll, StacItem, tileUrl } from "./stac";

const cache = new Map<string, Promise<StacItem[]>>();

function loadItems(variable: string, frequency: string): Promise<StacItem[]> {
  const key = `${variable}/${frequency}`;
  if (!cache.has(key)) {
    const p = searchAll("loca2", [eq("variable_id", variable), eq("cmip6:table_id", frequency)]);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key)!;
}

const prop = (i: StacItem, k: string) => String(i.properties[`cmip6:${k}`]);

/** Pick one ensemble member per model/scenario, preferring r1i1p1f1. */
function pickItem(items: StacItem[], model: string, experiment: string): StacItem | undefined {
  return items
    .filter((i) => prop(i, "source_id") === model && prop(i, "experiment_id") === experiment)
    .sort((a, b) => (prop(a, "member_id") === "r1i1p1f1" ? -1 : prop(a, "member_id").localeCompare(prop(b, "member_id"))))[0];
}

export interface Probe {
  lngLat: [number, number];
  status: "loading" | "done" | "error";
  value: number | null;
}

export function useClimate(active: boolean) {
  const [layerId, setLayerId] = useState(CLIMATE_LAYERS[0].id);
  const [scenario, setScenario] = useState(SCENARIOS[1].id);
  const [model, setModel] = useState("");
  const [year, setYear] = useState(2050);
  const [month, setMonth] = useState(6); // July, 0-based
  const [items, setItems] = useState<StacItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);

  const layer = CLIMATE_LAYERS.find((l) => l.id === layerId)!;
  const chooseLayer = (id: string) => {
    setLayerId(id);
    setMonth(CLIMATE_LAYERS.find((l) => l.id === id)!.defaultMonth ?? 6);
  };

  useEffect(() => {
    let stale = false;
    setItems(null);
    setError(null);
    loadItems(layer.variable, layer.frequency)
      .then((res) => !stale && setItems(res))
      .catch(() => !stale && setError("The data catalog didn't respond. Check your connection and pick the layer again."));
    return () => {
      stale = true;
    };
  }, [layer.variable, layer.frequency]);

  // Models that have a run for the chosen scenario
  const models = useMemo(() => {
    if (!items) return [];
    const set = new Set(items.filter((i) => prop(i, "experiment_id") === scenario).map((i) => prop(i, "source_id")));
    return [...set].sort();
  }, [items, scenario]);

  useEffect(() => {
    if (models.length && !models.includes(model)) setModel(models.includes("cesm2-lens") ? "cesm2-lens" : models[0]);
  }, [models, model]);

  const hasHistorical = !!items && !!model && !!pickItem(items, model, "historical");
  const minYear = hasHistorical ? 1950 : FIRST_FUTURE_YEAR;
  const maxYear = 2100;
  useEffect(() => {
    if (year < minYear) setYear(minYear);
  }, [minYear, year]);

  const experiment = year < FIRST_FUTURE_YEAR ? "historical" : scenario;
  const item = items && model ? pickItem(items, model, experiment) : undefined;
  const datetime = layer.frequency === "yrmax" ? `${year}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // Tiles take about a second each, so wait until the slider settles
  const liveUrl = item
    ? tileUrl({ href: item.assets.data.href, variable: layer.variable, datetime, colorTable: buildColorTable(layer.colormap, layer.rescale, layer.bins) })
    : null;
  const [raster, setRaster] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setRaster(liveUrl), 250);
    return () => clearTimeout(t);
  }, [liveUrl]);

  // Value at the clicked point, refreshed when the layer or time changes
  const probeAbort = useRef<AbortController | null>(null);
  const probeAt = probe?.lngLat;
  useEffect(() => {
    if (!probeAt || !item || !active) return;
    probeAbort.current?.abort();
    const ctrl = new AbortController();
    probeAbort.current = ctrl;
    setProbe({ lngLat: probeAt, status: "loading", value: null });
    const t = setTimeout(() => {
      pointValue({ href: item.assets.data.href, variable: layer.variable, datetime, lng: probeAt[0], lat: probeAt[1], signal: ctrl.signal })
        .then((value) => setProbe({ lngLat: probeAt, status: "done", value }))
        .catch((e) => e.name !== "AbortError" && setProbe({ lngLat: probeAt, status: "error", value: null }));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeAt?.[0], probeAt?.[1], item?.id, datetime, active]);

  return {
    layer,
    setLayerId: chooseLayer,
    scenario,
    setScenario,
    model,
    setModel,
    models,
    year,
    setYear,
    month,
    setMonth,
    minYear,
    maxYear,
    experiment,
    loading: !items && !error,
    error,
    missing: !!items && !item,
    item,
    datetime,
    raster: active ? raster : null,
    probe: active ? probe : null,
    setProbeAt: (lngLat: [number, number] | null) => setProbe(lngLat ? { lngLat, status: "loading", value: null } : null),
  };
}

export type ClimateState = ReturnType<typeof useClimate>;
