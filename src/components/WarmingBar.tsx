import type { WarmingState } from "../useWarming";
import Legend from "./Legend";
import { levelLabel } from "./WarmingPanel";

export default function WarmingBar({ w }: { w: WarmingState }) {
  return (
    <div className="timebar">
      <div className="timebar-year">
        <span className="year">{levelLabel(w.level)}</span>
        <span className="year-context">{w.level === 0.8 ? "Recent climate (about 1987–2016)" : "warmer than 1850–1900"}</span>
      </div>

      <div className="levels" role="radiogroup" aria-label="Global warming level">
        {w.levels.map((l) => (
          <button key={l} role="radio" aria-checked={w.level === l} className={w.level === l ? "on" : ""} onClick={() => w.setLevel(l)}>
            <strong>{levelLabel(l)}</strong>
            <small>{l === 0.8 ? "Recent" : l === 1.5 ? "Paris goal" : " "}</small>
          </button>
        ))}
      </div>

      <Legend
        title={w.layer.title}
        colormap={w.view.colormap}
        rescale={w.view.rescale}
        bins={w.view.bins}
        unit={w.layer.unit}
        signed={w.kind === "del"}
      />
    </div>
  );
}
