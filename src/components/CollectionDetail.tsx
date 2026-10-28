import { ReactNode, useEffect, useRef } from "react";
import { STAC_BROWSER } from "../config";
import type { StacCollection } from "../stac";

function years(c: StacCollection) {
  const [start, end] = c.extent.temporal.interval[0] ?? [];
  const y = (d: string | null | undefined) => d?.slice(0, 4);
  if (!start && !end) return null;
  return `${y(start) ?? "…"}–${y(end) ?? "present"}`;
}

/** `children` are the map controls, for datasets that have them. */
export default function CollectionDetail(props: { c: StacCollection; onBack: () => void; children?: ReactNode }) {
  const { c } = props;
  const hasMap = Boolean(props.children);
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
      {thumb && !hasMap && <img className="collection-hero" src={thumb} alt="" />}
      <h2>{c.title ?? c.id}</h2>
      {c.description.split(/\n\s*\n/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}

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

      {props.children}

      {!hasMap && variables.length > 0 && <LabelList title="Variables" values={variables} />}
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
