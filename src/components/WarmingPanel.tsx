import { CALADAPT_SITE, GUIDANCE_SITE, STAC_BROWSER, WARMING_LAYERS, WARMING_MODELS } from "../config";
import { warmingMethods } from "../snippets";
import type { WarmingState } from "../useWarming";
import { formatCoords } from "./ClimatePanel";
import GetData from "./GetData";
import Term from "./Term";

function fmt(w: WarmingState, raw: number) {
  const { convert, digits, label } = w.layer.unit;
  const s = convert(raw).toFixed(digits);
  return `${w.kind === "del" && raw > 0 ? "+" : ""}${s} ${label}`;
}

export function levelLabel(level: number) {
  return `+${level.toFixed(1)} °C`;
}

export function warmingReadout(w: WarmingState) {
  if (!w.probe) return null;
  const { status, value, low, high } = w.probe;
  return {
    lngLat: w.probe.lngLat,
    title: `${w.layer.title}${w.kind === "del" ? ", change" : ""} in a ${levelLabel(w.level)} world`,
    value: status === "loading" ? "…" : status === "error" ? "No reading" : value === null ? "No data here" : fmt(w, value),
    detail: status === "done" && low !== null && high !== null ? `Range across 4 models: ${fmt(w, low)} to ${fmt(w, high)}` : undefined,
    sub: formatCoords(w.probe.lngLat),
  };
}

export default function WarmingPanel({ w }: { w: WarmingState }) {
  const access = warmingMethods(w.layer, w.view, w.dimName, w.level);
  const toolHref = `${CALADAPT_SITE}/dashboard/climate-metrics-map?metric=${w.layer.id}${w.kind === "del" ? "&valueType=del" : ""}`;

  return (
    <>
      <p className="hint">
        Instead of picking a year, pick how much warmer the world gets: its{" "}
        <Term slug="global-warming-level">global warming level</Term>. When the world reaches each level depends on how quickly
        emissions fall.
      </p>

      <fieldset className="group">
        <legend>What to show</legend>
        {WARMING_LAYERS.map((l) => (
          <label key={l.id} className="choice">
            <input type="radio" name="warming-layer" checked={w.layer.id === l.id} onChange={() => w.setLayerId(l.id)} />
            <span>
              <strong>{l.title}</strong>
              <small>{l.blurb}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="group">
        <span className="field-label" id="view-label">
          Show
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="view-label">
          <button role="radio" aria-checked={w.kind === "abs"} onClick={() => w.setKind("abs")}>
            Total
          </button>
          <button role="radio" aria-checked={w.kind === "del"} onClick={() => w.setKind("del")}>
            Change from a 0.8 °C world
          </button>
        </div>
        <p className="note">{w.view.description}.</p>
      </div>

      <div className="group">
        <span className="field-label">About this data</span>
        <p className="note">
          Average of 4 <Term slug="bias-correction">bias-corrected</Term> <Term slug="global-climate-model">climate models</Term> (
          {WARMING_MODELS.join(", ")}),{" "}
          <Term slug="dynamical-downscaling">downscaled</Term> to a 3 km grid with WRF under the{" "}
          <Term slug="shared-socioeconomic-pathways">SSP3-7.0</Term> scenario. Click the map to see how much the models agree.
        </p>
        <ul className="link-list">
          <li>
            <a href={`${CALADAPT_SITE}${w.layer.dataMethods}`} target="_blank" rel="noreferrer">
              How this was calculated
            </a>
          </li>
          <li>
            <a href={`${GUIDANCE_SITE}/scientific-guidance/global-warming-levels.html`} target="_blank" rel="noreferrer">
              Guidance on using warming levels
            </a>
          </li>
          <li>
            <a href={toolHref} target="_blank" rel="noreferrer">
              Open in the Climate Metrics Map
            </a>
          </li>
        </ul>
      </div>

      <GetData
        methods={access.methods}
        browse={access.browse}
        catalogLink={w.layer.stacCollection ? `${STAC_BROWSER}/collections/${w.layer.stacCollection}` : undefined}
      />

      <div aria-live="polite">
        {w.error ? <p className="error">{w.error}</p> : w.loading ? <p className="note">Loading warming levels…</p> : null}
      </div>
    </>
  );
}
