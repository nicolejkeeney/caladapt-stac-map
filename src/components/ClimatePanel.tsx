import { CLIMATE_LAYERS, GUIDANCE_SITE, MODEL_NAMES, MONTHS, SCENARIOS, STAC_BROWSER } from "../config";
import { loca2Methods } from "../snippets";
import type { ClimateState } from "../useClimate";
import GetData from "./GetData";
import Term from "./Term";

export function formatValue(c: ClimateState, raw: number) {
  const { convert, digits, label } = c.layer.unit;
  return `${convert(raw).toFixed(digits)} ${label}`;
}

export function formatCoords([lng, lat]: [number, number]) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
}

export const modelName = (id: string) => MODEL_NAMES[id] ?? id.toUpperCase();

export function readoutFor(c: ClimateState) {
  if (!c.probe) return null;
  const when = c.layer.frequency === "yrmax" ? `${c.year}` : `${MONTHS[c.month]} ${c.year}`;
  const { status, value } = c.probe;
  return {
    lngLat: c.probe.lngLat,
    title: `${c.layer.title}, ${when}`,
    value: status === "loading" ? "…" : status === "error" ? "No reading" : value === null ? "No data here" : formatValue(c, value),
    sub: `${formatCoords(c.probe.lngLat)}, ${modelName(c.model)} model`,
  };
}

export default function ClimatePanel({ c }: { c: ClimateState }) {
  return (
    <>
      <p className="hint">Click anywhere on the map to read the value at that spot. Use the slider to move through time.</p>

      <fieldset className="group">
        <legend>What to show</legend>
        {CLIMATE_LAYERS.map((l) => (
          <label key={l.id} className="choice">
            <input type="radio" name="layer" checked={c.layer.id === l.id} onChange={() => c.setLayerId(l.id)} />
            <span>
              <strong>{l.title}</strong>
              <small>{l.blurb}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="group">
        <legend>
          Future <Term slug="shared-socioeconomic-pathways">emissions scenario</Term>
        </legend>
        {SCENARIOS.map((s) => (
          <label key={s.id} className="choice">
            <input type="radio" name="scenario" checked={c.scenario === s.id} onChange={() => c.setScenario(s.id)} />
            <span>
              <strong>{s.title}</strong>
              <small>{s.blurb}</small>
            </span>
          </label>
        ))}
        <p className="note">Years before 2015 show the model's simulation of the past, which is the same for every scenario.</p>
      </fieldset>

      <div className="group">
        <label className="field-label" htmlFor="model">
          <Term slug="global-climate-model">Climate model</Term>
        </label>
        <select id="model" value={c.model} onChange={(e) => c.setModel(e.target.value)} disabled={!c.models.length}>
          {c.models.map((m) => (
            <option key={m} value={m}>
              {modelName(m)}
            </option>
          ))}
        </select>
        <p className="note">Each model simulates the climate a little differently. Switch between a few to see the range of possible futures.</p>
      </div>

      <div className="group">
        <span className="field-label">About this data</span>
        <p className="note">
          LOCA2: 15 climate models <Term slug="statistical-downscaling">statistically downscaled</Term> to a 3 km grid by UC San Diego.
        </p>
        <ul className="link-list">
          <li>
            <a href={`${GUIDANCE_SITE}/scientific-guidance/model-selection.html`} target="_blank" rel="noreferrer">
              How to choose climate models
            </a>
          </li>
          <li>
            <a href={`${GUIDANCE_SITE}/scientific-guidance/WRF-vs-LOCA2-Hybrid.html`} target="_blank" rel="noreferrer">
              LOCA2 or WRF: which data to use
            </a>
          </li>
        </ul>
      </div>

      {c.item && (
        <GetData
          {...loca2Methods(c.item, c.layer.variable, c.layer.frequency === "yrmax" ? `${c.year}` : c.datetime.slice(0, 7))}
          catalogLink={`${STAC_BROWSER}/collections/${c.item.collection}/items/${c.item.id}`}
        />
      )}

      <div aria-live="polite">
        {c.error ? (
          <p className="error">{c.error}</p>
        ) : c.loading ? (
          <p className="note">Loading model runs…</p>
        ) : c.missing ? (
          <p className="error">
            {modelName(c.model)} has no run for this scenario in {c.year}. Pick another model or year.
          </p>
        ) : null}
      </div>
    </>
  );
}
