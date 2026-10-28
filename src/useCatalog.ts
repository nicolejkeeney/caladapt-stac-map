import { useEffect, useMemo, useState } from "react";
import { DATASET_VIEWS, TOPICS } from "./config";
import { listCollections, StacCollection } from "./stac";
import { loadGeometries } from "./usePlaces";

export type CatalogState = ReturnType<typeof useCatalog>;

function searchText(c: StacCollection) {
  return [
    c.id,
    c.title,
    c.description,
    ...(c.keywords ?? []),
    ...Object.values(c["caladapt:variable_labels"] ?? {}),
  ]
    .join(" ")
    .toLowerCase();
}

export function useCatalog() {
  const [collections, setCollections] = useState<StacCollection[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    listCollections()
      .then((cs) => setCollections(cs.sort(byMapThenTitle)))
      .catch(() => setError(true));
  }, []);

  const results = useMemo(() => {
    if (!collections) return [];
    const topic = TOPICS.find((t) => t.id === topicId);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return collections.filter((c) => {
      if (topic && !topic.collections.includes(c.id)) return false;
      const text = searchText(c);
      return words.every((w) => text.includes(w));
    });
  }, [collections, query, topicId]);

  const selected = collections?.find((c) => c.id === selectedId) ?? null;

  // Where the selected dataset has data: its stations or areas when it lists
  // them, otherwise the outline of its bounding box.
  const [footprint, setFootprint] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    setFootprint(null);
    if (!selected) return;
    const hasGeometries = Object.values(selected.assets ?? {}).some((a) => a.roles?.includes("item-geometries"));
    if (!hasGeometries) {
      setFootprint(bboxOutline(selected.extent.spatial.bbox[0]));
      return;
    }
    let stale = false;
    loadGeometries(selected.id)
      .then((g) => !stale && setFootprint(g))
      .catch(() => !stale && setFootprint(bboxOutline(selected.extent.spatial.bbox[0])));
    return () => {
      stale = true;
    };
  }, [selected]);

  return { collections, results, error, query, setQuery, topicId, setTopicId, selected, setSelectedId, footprint };
}

// Datasets with an interactive map first, then alphabetical
function byMapThenTitle(a: StacCollection, b: StacCollection) {
  const mapped = Number(b.id in DATASET_VIEWS) - Number(a.id in DATASET_VIEWS);
  return mapped || (a.title ?? a.id).localeCompare(b.title ?? b.id);
}

function bboxOutline([w, s, e, n]: number[]): GeoJSON.FeatureCollection {
  const ring = [[w, s], [e, s], [e, n], [w, n], [w, s]];
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
}
