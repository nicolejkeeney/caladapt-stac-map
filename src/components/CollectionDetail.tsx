import { useEffect, useRef } from "react";
import { STAC_BROWSER } from "../config";
import type { StacCollection } from "../stac";

// Collections one of the map modes can already show
export type MapTarget = { mode: "climate" | "warming" | "places"; placeDataset?: string };

export const MAP_TARGETS: Record<string, MapTarget> = {
  loca2: { mode: "climate" },
  "wrf-climate-metrics-map": { mode: "warming" },
  "loca2-county": { mode: "places", placeDataset: "counties" },
  hadisd: { mode: "places", placeDataset: "hadisd" },
  "historical-data-platform": { mode: "places", placeDataset: "hdp" },
};

function years(c: StacCollection) {
  const [start, end] = c.extent.temporal.interval[0] ?? [];
  const y = (d: string | null | undefined) => d?.slice(0, 4);
  if (!start && !end) return null;
  return `${y(start) ?? "…"}–${y(end) ?? "present"}`;
}

export default function CollectionDetail(props: { c: StacCollection; onBack: () => void; onOpenMap: (t: MapTarget) => void }) {
  const { c } = props;
  const target = MAP_TARGETS[c.id];
  const variables = [...new Set(Object.values(c["caladapt:variable_labels"] ?? {}))];
  const boundaries = Object.values(c["caladapt:boundary_labels"] ?? {});
  const stations = Object.keys(c["caladapt:station_labels"] ?? {}).length;
  const span = years(c);
  const thumb = c.assets?.thumbnail?.href;
  const top = useRef<HTMLElement>(null);

  // Start at the top, not wherever the list was scrolled to
  useEffect(() => {
    top.current?.closest(".panel-body")?.scrollTo(0, 0);
  }, [c.id]);

  return (
    <section className="detail collection-detail" ref={top}>
      <button className="back" onClick={props.onBack}>
        All datasets
      </button>
      {thumb && <img className="collection-hero" src={thumb} alt="" />}
      <h2>{c.title ?? c.id}</h2>
      {c.description.split(/\n\s*\n/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {target && (
        <button className="primary" onClick={() => props.onOpenMap(target)}>
          Show on the map
        </button>
      )}

      <dl className="facts">
        {span && (
          <div>
            <dt>Years</dt>
            <dd>{span}</dd>
          </div>
        )}
        {stations > 0 && (
          <div>
            <dt>Locations</dt>
            <dd>{stations}</dd>
          </div>
        )}
      </dl>

      {variables.length > 0 && <LabelList title="Variables" values={variables} />}
      {boundaries.length > 0 && <LabelList title="Summarized by" values={boundaries} />}

      <a className="catalog-link" href={`${STAC_BROWSER}/collections/${c.id}`} target="_blank" rel="noreferrer">
        See full details in STAC Browser
      </a>
    </section>
  );
}

function LabelList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="group">
      <span className="field-label">{title}</span>
      <ul className="label-list">
        {values.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </div>
  );
}
