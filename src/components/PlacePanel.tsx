import { useEffect, useMemo, useState } from "react";
import { FREQUENCY_NAMES, MODEL_NAMES, SCENARIO_NAMES, VARIABLE_NAMES } from "../config";
import { httpsHref, StacItem } from "../stac";
import type { PlacesState } from "../usePlaces";
import CodeBlock from "./CodeBlock";

const LARGE_LIST = 500;

/** `variableLabels` come from the selected collection, for profiles split by variable. */
export default function PlacePanel({ p, variableLabels }: { p: PlacesState; variableLabels?: Record<string, string> }) {
  return (
    <>
      <PlacePicker p={p} />

      {p.status === "error" && <p className="error">The data catalog didn't respond. Check your connection and try again.</p>}
      {!p.place ? (
        <p className="hint">
          Click a {p.dataset.kind === "county" ? "county" : "station"} on the map, or choose one above.
        </p>
      ) : !p.items ? (
        p.status === "loading" && <p className="note">Finding data for {p.place.name || p.place.id}…</p>
      ) : p.dataset.kind === "county" ? (
        <CountyDetail p={p} items={p.items} />
      ) : p.dataset.filters ? (
        <ProfileDetail p={p} items={p.items} variableLabels={variableLabels} />
      ) : (
        <StationDetail p={p} item={p.items[0]} />
      )}
    </>
  );
}

function PlacePicker({ p }: { p: PlacesState }) {
  const noun = p.dataset.kind === "county" ? "county" : "station";
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(""), [p.dataset.id]);

  if (p.placeOptions.length <= LARGE_LIST) {
    return (
      <div className="group">
        <label className="field-label" htmlFor="place">
          Choose a {noun}
        </label>
        <select
          id="place"
          value={p.place?.id ?? ""}
          onChange={(e) => p.setPlace(p.placeOptions.find((o) => o.id === e.target.value) ?? null)}
        >
          <option value="">Select…</option>
          {p.placeOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Too many stations for a dropdown; match on station ID instead
  const q = query.trim().toLowerCase();
  const matches = q ? p.placeOptions.filter((o) => o.id.toLowerCase().includes(q)).slice(0, 50) : [];
  return (
    <div className="group">
      <label className="field-label" htmlFor="place-search">
        Find a station by ID
      </label>
      <input
        id="place-search"
        list="place-matches"
        placeholder="e.g. RAWS or CIMIS_"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          const hit = p.placeOptions.find((o) => o.id === e.target.value);
          if (hit) p.setPlace(hit);
        }}
      />
      <datalist id="place-matches">
        {matches.map((o) => (
          <option key={o.id} value={o.id} />
        ))}
      </datalist>
    </div>
  );
}

const prop = (i: StacItem, k: string) => String(i.properties[k] ?? "");

function unique(items: StacItem[], key: string) {
  return [...new Set(items.map((i) => prop(i, key)))].sort();
}

function CountyDetail({ p, items }: { p: PlacesState; items: StacItem[] }) {
  const scenarios = unique(items, "cmip6:experiment_id");
  const frequencies = unique(items, "cmip6:table_id");
  const [scenario, setScenario] = useState("ssp370");
  const [frequency, setFrequency] = useState("mon");
  const [model, setModel] = useState("");

  const sc = scenarios.includes(scenario) ? scenario : scenarios[0];
  const fq = frequencies.includes(frequency) ? frequency : frequencies[0];
  const forRun = items.filter((i) => prop(i, "cmip6:experiment_id") === sc && prop(i, "cmip6:table_id") === fq);
  const models = unique(forRun, "cmip6:source_id");
  const md = models.includes(model) ? model : models[0];
  const runs = forRun.filter((i) => prop(i, "cmip6:source_id") === md);

  return (
    <section className="detail">
      <h2>{p.place!.name} County</h2>
      <p className="note">
        {items.length} model runs available. Narrow them down, then download the variables you need.
      </p>

      <div className="filters">
        <Select label="Scenario" value={sc} onChange={setScenario} options={scenarios} names={SCENARIO_NAMES} />
        <Select label="Time step" value={fq} onChange={setFrequency} options={frequencies} names={FREQUENCY_NAMES} />
        <Select label="Climate model" value={md} onChange={setModel} options={models} />
      </div>

      {runs.map((run) => (
        <div key={run.id} className="run">
          {runs.length > 1 && <p className="run-label">Run {prop(run, "cmip6:member_id")}</p>}
          <ul className="downloads">
            {Object.entries(run.assets).map(([key, a]) => (
              <li key={key}>
                <span>
                  {VARIABLE_NAMES[key] ?? a.title ?? key}
                  {a["file:size"] && <small>{formatBytes(a["file:size"])}</small>}
                </span>
                <a href={httpsHref(a.href)} download>
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="note">
        Files are NetCDF (.nc), covering {fq === "day" ? "every day" : "every month"} from{" "}
        {sc === "historical" ? "1950 to 2014" : "2015 to 2100"}. Open them in Python, R, QGIS or Panoply.
      </p>
    </section>
  );
}

function StationDetail({ p, item }: { p: PlacesState; item: StacItem }) {
  const props = { ...p.feature?.properties, ...item.properties };
  const year = (d?: string) => d?.slice(0, 4);
  const rows: [string, string | undefined][] = [
    ["Network", props.network],
    ["State", props.state],
    ["Elevation", props.elevation_m != null ? `${Math.round(props.elevation_m * 3.281).toLocaleString()} ft` : undefined],
    ["Record", props.start_datetime ? `${year(props.start_datetime)}–${year(props.end_datetime)}` : undefined],
    ["Observations", props.total_observations?.toLocaleString()],
  ];
  const href = item.assets.data?.href;
  const snippet = `import xarray as xr\n\nds = xr.open_zarr(\n    "${href}",\n    storage_options={"anon": True},\n)`;

  return (
    <section className="detail">
      <h2>{props.station_name ?? item.id}</h2>
      <dl className="facts">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      <p className="note">
        This station's data is stored as Zarr, a cloud format you open with code rather than download. Paste this into Python:
      </p>
      <CodeBlock code={snippet} />
    </section>
  );
}

function ProfileDetail({ p, items, variableLabels }: { p: PlacesState; items: StacItem[]; variableLabels?: Record<string, string> }) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const names: Record<string, Record<string, string> | undefined> = { model: MODEL_NAMES, variable: variableLabels };

  // Each filter's options come from the files left after the filters above it
  let matching = items;
  const selects = [];
  for (const f of p.dataset.filters!) {
    const options = unique(matching, f.property).filter(Boolean);
    if (options.length === 0) continue;
    const value = options.includes(chosen[f.property]) ? chosen[f.property] : options[0];
    matching = matching.filter((i) => prop(i, f.property) === value);
    selects.push(
      <Select
        key={f.property}
        label={f.label}
        value={value}
        onChange={(v) => setChosen({ ...chosen, [f.property]: v })}
        options={options}
        names={names[f.property] ?? Object.fromEntries(options.map((o) => [o, readable(o)]))}
      />,
    );
  }

  return (
    <section className="detail">
      <h2>{p.place!.name}</h2>
      <p className="note">{items.length} files available. Narrow them down, then download the one you need.</p>
      <div className="filters">{selects}</div>
      <ul className="downloads">
        {matching.flatMap((item) =>
          Object.entries(item.assets).map(([key, a]) => (
            <li key={item.id + key}>
              <span>
                {a.title ?? `${key.toUpperCase()} file`}
                {item.properties["file:size"] && <small>{formatBytes(item.properties["file:size"])}</small>}
              </span>
              <a href={httpsHref(a.href)} download>
                Download
              </a>
            </li>
          )),
        )}
      </ul>
    </section>
  );
}

/** "95ptile" -> "95th percentile", "mid-century" -> "Mid-century" */
function readable(value: string) {
  const pct = value.match(/^(\d+)ptile$/);
  if (pct) return `${pct[1]}th percentile`;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Select(props: { label: string; value: string; onChange: (v: string) => void; options: string[]; names?: Record<string, string> }) {
  const id = useMemo(() => `f-${props.label.replace(/\W/g, "").toLowerCase()}`, [props.label]);
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {props.label}
      </label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {props.names?.[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatBytes(n: number) {
  return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
}
