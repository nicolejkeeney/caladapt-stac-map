import { useEffect, useMemo, useState } from "react";
import { PLACE_DATASETS } from "./config";
import { eq, getCollection, getGeoJson, getItem, searchAll, StacItem } from "./stac";
import type { PlacesLayer } from "./components/MapView";

const geometryCache = new Map<string, Promise<GeoJSON.FeatureCollection>>();

/** Each place collection publishes its unique geometries as an `item-geometries` asset. */
function loadGeometries(collection: string) {
  if (!geometryCache.has(collection)) {
    const p = getCollection(collection).then((c) => {
      const asset = Object.values(c.assets ?? {}).find((a) => a.roles?.includes("item-geometries"));
      if (!asset) throw new Error(`${collection} has no item-geometries asset`);
      return getGeoJson(asset.href);
    });
    p.catch(() => geometryCache.delete(collection));
    geometryCache.set(collection, p);
  }
  return geometryCache.get(collection)!;
}

export interface Place {
  id: string;
  name: string;
}

export function usePlaces(active: boolean) {
  const [datasetId, setDatasetIdRaw] = useState(PLACE_DATASETS[0].id);
  const dataset = PLACE_DATASETS.find((d) => d.id === datasetId)!;
  const [loaded, setLoaded] = useState<{ collection: string; data: GeoJSON.FeatureCollection } | null>(null);
  // Ignore geometries left over from the previous dataset until the new ones arrive
  const geojson = loaded?.collection === dataset.collection ? loaded.data : null;
  const [place, setPlace] = useState<Place | null>(null);

  const setDatasetId = (id: string) => {
    setPlace(null);
    setDatasetIdRaw(id);
  };
  const [items, setItems] = useState<StacItem[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    let stale = false;
    loadGeometries(dataset.collection)
      .then((data) => !stale && setLoaded({ collection: dataset.collection, data }))
      .catch(() => !stale && setStatus("error"));
    return () => {
      stale = true;
    };
  }, [dataset.collection]);

  useEffect(() => {
    if (!place) {
      setItems(null);
      return;
    }
    const ctrl = new AbortController();
    setItems(null);
    setStatus("loading");
    const m = dataset.match;
    const request =
      m.type === "property"
        ? searchAll(dataset.collection, [eq(m.property, place.id)], ctrl.signal)
        : getItem(dataset.collection, m.prefix + place.id, ctrl.signal).then((i) => [i]);
    request
      .then((res) => {
        setItems(res);
        setStatus("idle");
      })
      .catch((e) => e.name !== "AbortError" && setStatus("error"));
    return () => ctrl.abort();
  }, [place, dataset]);

  const layer: PlacesLayer | null = useMemo(
    () =>
      geojson && {
        key: dataset.id,
        geojson,
        kind: dataset.kind,
        idProperty: dataset.idProperty,
        nameProperty: dataset.nameProperty,
      },
    [geojson, dataset],
  );

  const placeOptions = useMemo(
    () =>
      (geojson?.features ?? [])
        .map((f) => ({ id: String(f.properties?.[dataset.idProperty]), name: String(f.properties?.[dataset.nameProperty] ?? f.properties?.[dataset.idProperty]) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [geojson, dataset],
  );

  const feature = useMemo(
    () => (place ? geojson?.features.find((f) => String(f.properties?.[dataset.idProperty]) === place.id) : undefined),
    [geojson, place, dataset],
  );

  return {
    dataset,
    setDatasetId,
    layer: active ? layer : null,
    placeOptions,
    place,
    setPlace,
    feature,
    items,
    status,
  };
}

export type PlacesState = ReturnType<typeof usePlaces>;
