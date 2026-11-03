import { useEffect, useMemo, useState } from "react";
import { BOUNDARY_TOOLS, COUNTY_GEOMETRIES_URL } from "./config";
import { binColors, binEdges } from "./colormap";
import { eq, getGeoJson, httpsHref, searchAll, StacItem } from "./stac";
import type { PlacesLayer } from "./components/MapView";
import type { Place } from "./usePlaces";

export const LEVELS = [0.8, 1.5, 2.0, 2.5, 3.0];
const BINS = 10;

/** One region's CSV: multi-model median, p10 and p90 days per year at each warming level. */
export type RegionRow = { level: number; median: number; p10: number; p90: number };

const itemCache = new Map<string, Promise<StacItem[]>>();
const csvCache = new Map<string, Promise<RegionRow[] | null>>();

async function loadCsv(url: string): Promise<RegionRow[] | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const [header, ...lines] = (await res.text()).trim().split("\n");
  const col = header.split(",");
  return lines.map((line) => {
    const v = Object.fromEntries(line.split(",").map((x, i) => [col[i], Number(x)]));
    return { level: v.warming_level, median: v.multimodel_median, p10: v.multimodel_p10, p90: v.multimodel_p90 };
  });
}

/** "t2max_ge95F" -> "95°F", "t2max_ge99pctl" -> "99th percentile" */
export function thresholdLabel(threshold: string) {
  const m = threshold.match(/_ge(\d+)(F|pctl)$/);
  if (!m) return threshold;
  return m[2] === "F" ? `${m[1]}°F` : `${m[1]}th percentile`;
}

const thresholdOrder = (t: string) => {
  const m = t.match(/_ge(\d+)(F|pctl)$/);
  return m ? (m[2] === "pctl" ? 1000 : 0) + Number(m[1]) : 0;
};

const csvName = (county: string, threshold: string) => `${county.replace(/ /g, "_")}_County_${threshold}.csv`;

/** A WRF tool's per-county CSVs, colored by region on the map. */
export function useBoundary(active: boolean, collection?: string) {
  const tool = collection ? BOUNDARY_TOOLS[collection] : undefined;
  const [metricId, setMetricId] = useState(tool?.metrics[0].id ?? "");
  const metric = tool?.metrics.find((m) => m.id === metricId) ?? tool?.metrics[0];
  const [threshold, setThreshold] = useState(metric?.defaultThreshold ?? "");
  const [level, setLevel] = useState(2.0);
  const [place, setPlace] = useState<Place | null>(null);
  const [items, setItems] = useState<StacItem[] | null>(null);
  const [counties, setCounties] = useState<GeoJSON.FeatureCollection | null>(null);
  const [rows, setRows] = useState<Record<string, RegionRow[] | null> | null>(null);
  const [error, setError] = useState(false);

  const chooseMetric = (id: string) => {
    setMetricId(id);
    setThreshold(tool!.metrics.find((m) => m.id === id)!.defaultThreshold);
  };

  // Each tool starts on its first metric and that metric's default threshold
  useEffect(() => {
    if (tool) chooseMetric(tool.metrics[0].id);
    setPlace(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  useEffect(() => {
    if (active && !counties) getGeoJson(COUNTY_GEOMETRIES_URL).then(setCounties).catch(() => setError(true));
  }, [active, counties]);

  // One item per threshold; its data asset is the folder of county CSVs
  useEffect(() => {
    if (!active || !tool || !metric || !collection) return;
    const key = `${collection}/${tool.boundary}/${metric.id}`;
    if (!itemCache.has(key)) {
      const p = searchAll(collection, [eq("boundary", tool.boundary), eq("variable_id", metric.id)]);
      p.catch(() => itemCache.delete(key));
      itemCache.set(key, p);
    }
    let stale = false;
    setItems(null);
    itemCache
      .get(key)!
      .then((res) => !stale && setItems(res))
      .catch(() => !stale && setError(true));
    return () => {
      stale = true;
    };
  }, [active, collection, tool, metric]);

  const thresholds = useMemo(
    () => (items ?? []).map((i) => String(i.properties.threshold_name)).sort((a, b) => thresholdOrder(a) - thresholdOrder(b)),
    [items],
  );
  const item = items?.find((i) => i.properties.threshold_name === threshold);
  const folder = item ? httpsHref(item.assets.data.href).replace(/\/?$/, "/") : null;

  // Every county's CSV for this metric and threshold
  useEffect(() => {
    if (!folder || !counties) return;
    let stale = false;
    setRows(null);
    const names = counties.features.map((f) => String(f.properties?.county_name));
    Promise.all(
      names.map((name) => {
        const url = folder + csvName(name, threshold);
        if (!csvCache.has(url)) {
          const p = loadCsv(url).catch(() => null);
          csvCache.set(url, p);
        }
        return csvCache.get(url)!.then((r) => [name, r] as const);
      }),
    ).then((pairs) => !stale && setRows(Object.fromEntries(pairs)));
    return () => {
      stale = true;
    };
  }, [folder, counties, threshold]);

  // The color range comes from the warmest level, so it holds while the level changes
  const max = useMemo(() => {
    const values = Object.values(rows ?? {}).flatMap((r) => r?.filter((x) => x.level === 3.0).map((x) => x.median) ?? []);
    const top = Math.max(1, ...values);
    const step = top > 50 ? 20 : top > 20 ? 10 : 5;
    return Math.ceil(top / step) * step;
  }, [rows]);

  const layer: PlacesLayer | null = useMemo(() => {
    if (!counties || !rows || !metric) return null;
    const geojson: GeoJSON.FeatureCollection = {
      ...counties,
      features: counties.features.map((f) => {
        const r = rows[String(f.properties?.county_name)];
        return { ...f, properties: { ...f.properties, value: r?.find((x) => x.level === level)?.median ?? null } };
      }),
    };
    return {
      key: `${metric.id}/${threshold}/${level}`,
      geojson,
      kind: "county",
      idProperty: "fips",
      nameProperty: "county_name",
      fill: { property: "value", edges: binEdges(0, max, BINS), colors: binColors(metric.colormap, BINS) },
    };
  }, [counties, rows, metric, threshold, level, max]);

  const selectedRows = place ? (rows?.[place.name] ?? null) : null;
  const csvUrl = place && folder ? folder + csvName(place.name, threshold) : null;

  return {
    tool,
    metric,
    setMetricId: chooseMetric,
    threshold,
    setThreshold,
    thresholds,
    level,
    setLevel,
    rescale: [0, max] as [number, number],
    bins: BINS,
    place,
    setPlace,
    selectedRows,
    csvUrl,
    loading: !error && (!items || !rows),
    error,
    layer: active ? layer : null,
  };
}

export type BoundaryState = ReturnType<typeof useBoundary>;
