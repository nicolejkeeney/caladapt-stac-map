import { LEVELS, thresholdLabel, type BoundaryState } from "../useBoundary";
import Legend from "./Legend";
import { levelLabel } from "./WarmingPanel";

export default function BoundaryPanel({ b }: { b: BoundaryState }) {
  if (!b.tool || !b.metric) return null;
  const { unit } = b.metric;
  const fmt = (v: number) => unit.convert(v).toFixed(unit.digits);

  return (
    <>
      <p className="hint">Counties are colored by the multi-model median at the warming level below the map. Click a county for its numbers.</p>

      <fieldset className="group">
        <legend>What to show</legend>
        {b.tool.metrics.map((m) => (
          <label key={m.id} className="choice">
            <input type="radio" name="boundary-metric" checked={b.metric!.id === m.id} onChange={() => b.setMetricId(m.id)} />
            <span>
              <strong>{m.title}</strong>
              <small>{m.blurb}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="group">
        <label className="field-label" htmlFor="threshold">
          Threshold
        </label>
        <select id="threshold" value={b.threshold} onChange={(e) => b.setThreshold(e.target.value)} disabled={!b.thresholds.length}>
          {b.thresholds.map((t) => (
            <option key={t} value={t}>
              {thresholdLabel(t)}
            </option>
          ))}
        </select>
        <p className="note">Percentile thresholds are set separately for each place, from its 0.8 °C (recent) climate.</p>
      </div>

      <div aria-live="polite">
        {b.error ? (
          <p className="error">The data didn't load. Check your connection and try again.</p>
        ) : b.loading ? (
          <p className="note">Loading county values…</p>
        ) : null}
      </div>

      {b.place && (
        <section className="detail">
          <h2>{b.place.name} County</h2>
          {b.selectedRows ? (
            <table className="levels-table">
              <thead>
                <tr>
                  <th scope="col">Warming</th>
                  <th scope="col">Median</th>
                  <th scope="col">Range (10–90%)</th>
                </tr>
              </thead>
              <tbody>
                {b.selectedRows.map((r) => (
                  <tr key={r.level} className={r.level === b.level ? "on" : ""}>
                    <td>{levelLabel(r.level)}</td>
                    <td>
                      {fmt(r.median)} {unit.label}
                    </td>
                    <td>
                      {fmt(r.p10)}–{fmt(r.p90)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note">No values for this county at this threshold.</p>
          )}
          {b.csvUrl && (
            <ul className="link-list">
              <li>
                <a href={b.csvUrl} download>
                  Download this county's CSV
                </a>
              </li>
            </ul>
          )}
        </section>
      )}
    </>
  );
}

export function BoundaryBar({ b }: { b: BoundaryState }) {
  if (!b.metric) return null;
  return (
    <div className="timebar">
      <div className="timebar-year">
        <span className="year">{levelLabel(b.level)}</span>
        <span className="year-context">{b.level === 0.8 ? "Recent climate (about 1987–2016)" : "warmer than 1850–1900"}</span>
      </div>

      <div className="levels" role="radiogroup" aria-label="Global warming level">
        {LEVELS.map((l) => (
          <button key={l} role="radio" aria-checked={b.level === l} className={b.level === l ? "on" : ""} onClick={() => b.setLevel(l)}>
            <strong>{levelLabel(l)}</strong>
            <small>{l === 0.8 ? "Recent" : l === 1.5 ? "Paris goal" : " "}</small>
          </button>
        ))}
      </div>

      <Legend title={b.metric.title} colormap={b.metric.colormap} rescale={b.rescale} bins={b.bins} unit={b.metric.unit} />
    </div>
  );
}
