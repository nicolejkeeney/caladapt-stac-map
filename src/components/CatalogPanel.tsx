import { TOPICS } from "../config";
import type { StacCollection } from "../stac";
import type { CatalogState } from "../useCatalog";
import CollectionDetail, { MapTarget } from "./CollectionDetail";

function kindOf(c: StacCollection) {
  if (c["caladapt:spatial_type"] === "grid") return "Gridded maps";
  if (c["caladapt:spatial_type"] === "point") return "Locations";
  if (c["caladapt:boundary_labels"]) return "Area summaries";
  return null;
}

export default function CatalogPanel({ cat, onOpenMap }: { cat: CatalogState; onOpenMap: (t: MapTarget) => void }) {
  if (cat.selected) {
    return <CollectionDetail c={cat.selected} onBack={() => cat.setSelectedId(null)} onOpenMap={onOpenMap} />;
  }

  return (
    <>
      <div className="group">
        <label className="field-label" htmlFor="catalog-search">
          Search the data catalog
        </label>
        <input
          id="catalog-search"
          type="search"
          placeholder="e.g. precipitation, wind, heat waves"
          value={cat.query}
          onChange={(e) => cat.setQuery(e.target.value)}
        />
      </div>

      <div className="topics" role="group" aria-label="Topics">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            aria-pressed={cat.topicId === t.id}
            onClick={() => cat.setTopicId(cat.topicId === t.id ? null : t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      {cat.error ? (
        <p className="error">The data catalog didn't respond. Check your connection and try again.</p>
      ) : !cat.collections ? (
        <p className="note">Loading the catalog…</p>
      ) : (
        <>
          <p className="note" aria-live="polite">
            {cat.results.length === cat.collections.length
              ? `${cat.results.length} datasets`
              : `${cat.results.length} of ${cat.collections.length} datasets`}
          </p>
          <ul className="collections">
            {cat.results.map((c) => (
              <li key={c.id}>
                <CollectionCard c={c} onSelect={() => cat.setSelectedId(c.id)} />
              </li>
            ))}
          </ul>
          {cat.results.length === 0 && <p className="hint">No datasets match. Try another word, or clear the topic.</p>}
        </>
      )}
    </>
  );
}

function CollectionCard({ c, onSelect }: { c: StacCollection; onSelect: () => void }) {
  const thumb = c.assets?.thumbnail?.href;
  const kind = kindOf(c);
  return (
    <button className="collection" onClick={onSelect}>
      {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="collection-blank" />}
      <span>
        <strong>{c.title ?? c.id}</strong>
        <small className="collection-desc">{c.description}</small>
        {kind && <small className="collection-kind">{kind}</small>}
      </span>
    </button>
  );
}
