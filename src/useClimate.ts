import { useEffect, useMemo, useRef, useState } from "react";
import { FIRST_FUTURE_YEAR, Frequency, GRIDDED_DATASETS, GRIDS, SCENARIOS } from "./config";
import { buildColorTable } from "./colormap";
import { eq, pointValue, searchAll, StacItem, tileUrl } from "./stac";

const cache = new Map<string, Promise<StacItem[]>>();

/** Every item for one variable, across all its time steps. */
function loadItems(collection: string, filters: Record<string, string | boolean>, variable: string): Promise<StacItem[]> {
  const key = `${collection}/${variable}`;
  if (!cache.has(key)) {
    const where = Object.entries(filters).map(([k, v]) => eq(k, v));
    const p = searchAll(collection, [eq("variable_id", variable), ...where]);
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
  const [timeStep, setTimeStep] = useState<Frequency>("mon");
  const [grid, setGrid] = useState("d03");
  const [scenario, setScenario] = useState(SCENARIOS[1].id);
  const [model, setModel] = useState("");
  // The time on the map, as a UTC timestamp; how precise it is depends on the time step
  const [time, setTimeRaw] = useState(() => Date.UTC(2050, 6, 1));
  const [allItems, setAllItems] = useState<StacItem[] | null>(null);
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
    setAllItems(null);
    setError(null);
    loadItems(collection, dataset.filters, layer.variable)
      .then((res) => !stale && setAllItems(res))
      .catch(() => !stale && setError("The data catalog didn't respond. Check your connection and pick the layer again."));
    return () => {
      stale = true;
    };
  }, [collection, layer.variable]);

  // Time steps this variable has in the catalog: the ones the tiler can draw, and
  // the rest, which are listed but can't be picked
  const [timeSteps, unmappedSteps] = useMemo(() => {
    const have = new Set((allItems ?? []).map((i) => prop(i, "table_id")));
    const all = (["yrmax", "mon", "day", "1hr"] as Frequency[]).filter((s) => have.has(s));
    return [dataset.steps.filter((s) => have.has(s)), all.filter((s) => !dataset.steps.includes(s))];
  }, [allItems, dataset]);

  useEffect(() => {
    if (timeSteps.length && !timeSteps.includes(timeStep)) setTimeStep(timeSteps.includes("mon") ? "mon" : timeSteps[0]);
  }, [timeSteps, timeStep]);

  // Grids this variable has at this time step, finest first
  const grids = useMemo(() => {
    const have = new Set((allItems ?? []).filter((i) => prop(i, "table_id") === timeStep).map((i) => prop(i, "grid_label")));
    return Object.keys(GRIDS).filter((g) => have.has(g));
  }, [allItems, timeStep]);

  useEffect(() => {
    if (grids.length && !grids.includes(grid)) setGrid(grids[0]);
  }, [grids, grid]);

  const items = useMemo(
    () => allItems?.filter((i) => prop(i, "table_id") === timeStep && prop(i, "grid_label") === grid) ?? null,
    [allItems, timeStep, grid],
  );

  // Future scenarios this dataset has runs for
  const scenarios = useMemo(() => {
    const ids = new Set((items ?? []).map((i) => prop(i, "experiment_id")));
    return SCENARIOS.filter((s) => ids.has(s.id));
  }, [items]);

  useEffect(() => {
    if (scenarios.length && !scenarios.some((s) => s.id === scenario)) setScenario(scenarios[0].id);
  }, [scenarios, scenario]);

  // Models that have a run for the chosen scenario
  const models = useMemo(() => {
    if (!items) return [];
    const set = new Set(items.filter((i) => prop(i, "experiment_id") === scenario).map((i) => prop(i, "source_id")));
    return [...set].sort();
  }, [items, scenario]);

  useEffect(() => {
    if (models.length && !models.includes(model)) setModel(models.includes("cesm2-lens") ? "cesm2-lens" : models[0]);
  }, [models, model]);

  // Years covered by this model's runs: its historical run (if any) through its future run
  const historicalRun = items && model ? pickItem(items, model, "historical") : undefined;
  const futureRun = items && model ? pickItem(items, model, scenario) : undefined;
  const yearOf = (iso: unknown) => Number(String(iso).slice(0, 4));
  const minYear = yearOf((historicalRun ?? futureRun)?.properties.start_datetime) || FIRST_FUTURE_YEAR;
  const maxYear = yearOf(futureRun?.properties.end_datetime) || 2100;
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

  const atStart = {
    yrmax: year <= minYear,
    mon: year <= minYear && month === 0,
    day: time < Date.UTC(minYear, 0, 2),
    "1hr": time <= Date.UTC(minYear, 0, 1),
  }[timeStep];
  const atEnd = {
    yrmax: year >= maxYear,
    mon: year >= maxYear && month === 11,
    day: time >= Date.UTC(maxYear, 11, 31),
    "1hr": time >= Date.UTC(maxYear, 11, 31, 23),
  }[timeStep];

  /** Move by n time steps: years, months, days or hours. */
  const moveBy = (n: number) =>
    setTimeRaw((t) => {
      const at = new Date(t);
      const [y, m, dd] = [at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()];
      const next = {
        yrmax: Date.UTC(y + n, m, 1),
        mon: Date.UTC(y, m + n, 1),
        day: Date.UTC(y, m, dd + n),
        "1hr": t + n * 3600_000,
      }[timeStep];
      return clamp(next);
    });

  const experiment = year < FIRST_FUTURE_YEAR ? "historical" : scenario;
  const item = items && model ? pickItem(items, model, experiment) : undefined;
  const datetime = {
    yrmax: `${year}-01-01`,
    mon: `${year}-${pad(month + 1)}-01`,
    day: `${year}-${pad(month + 1)}-${pad(day)}${dataset.dayTime ?? ""}`,
    "1hr": `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:00:00`,
  }[timeStep];
  const rescale = layer.rescaleByStep?.[timeStep] ?? layer.rescale;

  // Tiles take about a second each, so wait until the time settles
  const liveUrl = item
    ? tileUrl({ href: item.assets.data.href, variable: layer.variable, datetime, colorTable: buildColorTable(layer.colormap, rescale, layer.bins) })
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
    timeStep,
    setTimeStep,
    timeSteps,
    unmappedSteps,
    grid,
    setGrid,
    grids,
    rescale,
    scenario,
    setScenario,
    scenarios,
    model,
    setModel,
    models,
    time,
    setTime,
    moveBy,
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
    missing: !!items && !!items.length && !item,
    item,
    datetime,
    raster: active ? raster : null,
    rasterBounds: item?.bbox as [number, number, number, number] | undefined,
    probe: active ? probe : null,
    setProbeAt: (lngLat: [number, number] | null) => setProbe(lngLat ? { lngLat, status: "loading", value: null } : null),
  };
}

export type ClimateState = ReturnType<typeof useClimate>;
