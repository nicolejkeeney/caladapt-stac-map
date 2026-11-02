import { useEffect, useMemo, useRef, useState } from "react";
import { FIRST_FUTURE_YEAR, GRIDDED_DATASETS, SCENARIOS } from "./config";
import { buildColorTable } from "./colormap";
import { eq, pointValue, searchAll, StacItem, tileUrl } from "./stac";

const cache = new Map<string, Promise<StacItem[]>>();

function loadItems(collection: string, filters: Record<string, string>, variable: string, frequency: string): Promise<StacItem[]> {
  const key = `${collection}/${variable}/${frequency}`;
  if (!cache.has(key)) {
    const where = Object.entries(filters).map(([k, v]) => eq(k, v));
    const p = searchAll(collection, [eq("variable_id", variable), eq("cmip6:table_id", frequency), ...where]);
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

const pad = (n: number) => String(n).padStart(2, "0");

export interface Probe {
  lngLat: [number, number];
  status: "loading" | "done" | "error";
  value: number | null;
}

export function useClimate(active: boolean, collection = "loca2") {
  const dataset = GRIDDED_DATASETS[collection] ?? GRIDDED_DATASETS.loca2;
  const [layerId, setLayerId] = useState(dataset.layers[0].id);
  const [scenario, setScenario] = useState(SCENARIOS[1].id);
  const [model, setModel] = useState("");
  // The time on the map, as a UTC timestamp; how precise it is depends on the layer
  const [time, setTimeRaw] = useState(() => Date.UTC(2050, 6, 1));
  const [items, setItems] = useState<StacItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);

  const layer = dataset.layers.find((l) => l.id === layerId) ?? dataset.layers[0];
  const chooseLayer = (id: string) => {
    setLayerId(id);
    const month = dataset.layers.find((l) => l.id === id)!.defaultMonth ?? 6;
    setTimeRaw((t) => Date.UTC(new Date(t).getUTCFullYear(), month, 1));
  };

  // Each dataset starts on its first layer
  useEffect(() => {
    chooseLayer(dataset.layers[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  useEffect(() => {
    let stale = false;
    setItems(null);
    setError(null);
    loadItems(collection, dataset.filters, layer.variable, layer.frequency)
      .then((res) => !stale && setItems(res))
      .catch(() => !stale && setError("The data catalog didn't respond. Check your connection and pick the layer again."));
    return () => {
      stale = true;
    };
  }, [collection, layer.variable, layer.frequency]);

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
  const clamp = (t: number) => Math.min(Math.max(t, Date.UTC(minYear, 0, 1)), Date.UTC(maxYear, 11, 31, 23));
  const setTime = (t: number) => setTimeRaw(clamp(t));
  useEffect(() => {
    setTimeRaw((t) => clamp(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minYear, maxYear]);

  const d = new Date(time);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-based
  const day = d.getUTCDate();
  const hour = d.getUTCHours();

  const atStart =
    layer.frequency === "yrmax" ? year <= minYear : layer.frequency === "mon" ? year <= minYear && month === 0 : time <= Date.UTC(minYear, 0, 1);
  const atEnd =
    layer.frequency === "yrmax"
      ? year >= maxYear
      : layer.frequency === "mon"
        ? year >= maxYear && month === 11
        : time >= Date.UTC(maxYear, 11, 31, 23);

  /** Move by n of the layer's time steps: years, months or hours. */
  const step = (n: number) =>
    setTimeRaw((t) => {
      const at = new Date(t);
      const y = at.getUTCFullYear();
      const m = at.getUTCMonth();
      return clamp(
        layer.frequency === "yrmax" ? Date.UTC(y + n, m, 1) : layer.frequency === "mon" ? Date.UTC(y, m + n, 1) : t + n * 3600_000,
      );
    });

  const experiment = year < FIRST_FUTURE_YEAR ? "historical" : scenario;
  const item = items && model ? pickItem(items, model, experiment) : undefined;
  const datetime =
    layer.frequency === "yrmax"
      ? `${year}-01-01`
      : layer.frequency === "mon"
        ? `${year}-${pad(month + 1)}-01`
        : `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:00:00`;

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
    collection,
    dataset,
    layer,
    setLayerId: chooseLayer,
    scenario,
    setScenario,
    model,
    setModel,
    models,
    time,
    setTime,
    step,
    atStart,
    atEnd,
    year,
    month,
    day,
    hour,
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
