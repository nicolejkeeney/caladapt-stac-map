import { useEffect, useRef, useState } from "react";
import { buildColorTable } from "./colormap";
import { WARMING_LAYERS } from "./config";
import { dimension, pointValue, tileUrl } from "./stac";

export type WarmingViewKind = "abs" | "del";

export interface WarmingProbe {
  lngLat: [number, number];
  status: "loading" | "done" | "error";
  value: number | null;
  low: number | null;
  high: number | null;
}

export function useWarming(active: boolean) {
  const [layerId, setLayerId] = useState(WARMING_LAYERS[0].id);
  const [kind, setKind] = useState<WarmingViewKind>("abs");
  const [level, setLevel] = useState(2.0);
  const [dim, setDim] = useState<{ name: string; values: number[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probe, setProbe] = useState<WarmingProbe | null>(null);

  const layer = WARMING_LAYERS.find((l) => l.id === layerId)!;
  const view = layer[kind];

  // Warming levels come from the store itself; older stores call the dimension
  // "gwl", newer ones "warming_level"
  useEffect(() => {
    if (!active) return;
    let stale = false;
    setError(null);
    dimension(view.mean, view.variable)
      .then((d) => !stale && setDim(d))
      .catch(() => !stale && setError("The map server didn't respond. Check your connection and try again."));
    return () => {
      stale = true;
    };
  }, [active, view.mean, view.variable]);

  // Change maps are relative to 0.8 °C, so that level is always zero
  const levels = (dim?.values ?? []).filter((l) => kind === "abs" || l > 0.8);
  const lvl = levels.includes(level) ? level : (levels.find((l) => l >= level) ?? levels[0] ?? level);
  const datetime = lvl.toFixed(1);

  const raster = dim
    ? tileUrl({ href: view.mean, variable: view.variable, datetime, colorTable: buildColorTable(view.colormap, view.rescale, view.bins) })
    : null;

  const ctrl = useRef<AbortController | null>(null);
  const at = probe?.lngLat;
  useEffect(() => {
    if (!at || !dim || !active) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setProbe({ lngLat: at, status: "loading", value: null, low: null, high: null });
    const read = (href: string) =>
      pointValue({ href, variable: view.variable, datetime, lng: at[0], lat: at[1], signal: c.signal });
    // The range is a bonus: if a range file can't be read, still show the value
    const optional = (p: Promise<number | null>) => p.catch((e) => (e.name === "AbortError" ? Promise.reject(e) : null));
    Promise.all([read(view.mean), optional(read(view.min)), optional(read(view.max))])
      .then(([value, low, high]) => setProbe({ lngLat: at, status: "done", value, low, high }))
      .catch((e) => e.name !== "AbortError" && setProbe({ lngLat: at, status: "error", value: null, low: null, high: null }));
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at?.[0], at?.[1], view.mean, datetime, active, !!dim]);

  return {
    layer,
    setLayerId,
    kind,
    setKind,
    view,
    levels,
    level: lvl,
    setLevel,
    dimName: dim?.name ?? "warming_level",
    loading: !dim && !error,
    error,
    raster: active ? raster : null,
    probe: active ? probe : null,
    setProbeAt: (lngLat: [number, number] | null) =>
      setProbe(lngLat ? { lngLat, status: "loading", value: null, low: null, high: null } : null),
  };
}

export type WarmingState = ReturnType<typeof useWarming>;
