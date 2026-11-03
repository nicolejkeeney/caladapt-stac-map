import { useEffect, useState } from "react";
import { FIRST_FUTURE_YEAR, MONTHS } from "../config";
import type { ClimateState } from "../useClimate";
import Legend from "./Legend";

const PLAY_STEP_MS = 1500;
const STEP_NAME = { yrmax: "year", mon: "month", day: "day", "1hr": "hour" } as const;
const pad = (n: number) => String(n).padStart(2, "0");

/** The time on the map, picked at the precision of the time step: a year, month, day or hour. */
export default function TimeBar({ c }: { c: ClimateState }) {
  const [playing, setPlaying] = useState(false);
  const { year, month, day, hour, minYear, maxYear, moveBy, atStart, atEnd, setTime, timeStep } = c;
  const unit = STEP_NAME[timeStep];

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => moveBy(1), PLAY_STEP_MS);
    return () => clearTimeout(t);
  }, [playing, atEnd, moveBy]);

  const stepBy = (n: number) => {
    setPlaying(false);
    moveBy(n);
  };
  const pick = (t: number) => {
    setPlaying(false);
    setTime(t);
  };

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const when = { yrmax: "", mon: MONTHS[month], day: `${MONTHS[month]} ${day}`, "1hr": `${MONTHS[month]} ${day}, ${pad(hour)}:00 UTC` }[timeStep];

  return (
    <div className="timebar">
      <div className="timebar-year" aria-live="off">
        <span className="year">{year}</span>
        <span className="year-context">
          {when && `${when} · `}
          {year < FIRST_FUTURE_YEAR ? "Simulated past" : "Projected"}
        </span>
      </div>

      <div className="timebar-controls">
        <div className="time-row">
          <button className="step" onClick={() => stepBy(-1)} disabled={atStart} aria-label={`Previous ${unit}`}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10.5 3 L5.5 8 L10.5 13" />
            </svg>
          </button>
          <button
            className="play"
            onClick={() => setPlaying(!playing)}
            disabled={!playing && atEnd}
            aria-label={playing ? "Pause" : `Play forward one ${unit} at a time`}
          >
            {playing ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="2" width="3.5" height="12" />
                <rect x="9.5" y="2" width="3.5" height="12" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 2 L14 8 L4 14 Z" />
              </svg>
            )}
          </button>
          <button className="step" onClick={() => stepBy(1)} disabled={atEnd} aria-label={`Next ${unit}`}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5.5 3 L10.5 8 L5.5 13" />
            </svg>
          </button>

          <div className="time-pickers">
            {timeStep === "1hr" || timeStep === "day" ? (
              <>
                <input
                  type="date"
                  aria-label="Date"
                  min={`${minYear}-01-01`}
                  max={`${maxYear}-12-31`}
                  value={`${year}-${pad(month + 1)}-${pad(day)}`}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split("-").map(Number);
                    if (y) pick(Date.UTC(y, m - 1, d, hour));
                  }}
                />
                {timeStep === "1hr" && (
                  <select aria-label="Hour (UTC)" value={hour} onChange={(e) => pick(Date.UTC(year, month, day, Number(e.target.value)))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {pad(h)}:00 UTC
                      </option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <>
                {timeStep === "mon" && (
                  <select aria-label="Month" value={month} onChange={(e) => pick(Date.UTC(year, Number(e.target.value), 1))}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
                <select aria-label="Year" value={year} onChange={(e) => pick(Date.UTC(Number(e.target.value), month, 1))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      <Legend title={c.layer.title} colormap={c.layer.colormap} rescale={c.rescale} bins={c.layer.bins} unit={c.layer.unit} />
    </div>
  );
}
