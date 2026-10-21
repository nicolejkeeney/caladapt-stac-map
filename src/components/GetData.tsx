import { useState } from "react";
import { GUIDANCE_SITE } from "../config";
import type { AccessMethod } from "../snippets";
import CodeBlock from "./CodeBlock";

interface Props {
  methods: AccessMethod[];
  browse: string;
  catalogLink?: string;
}

/** "Get this data": copyable code for the layer on the map, one tab per access method. */
export default function GetData({ methods, browse, catalogLink }: Props) {
  const [tab, setTab] = useState(methods[0].id);
  const active = methods.find((m) => m.id === tab) ?? methods[0];

  return (
    <details className="group get-data">
      <summary>Get this data</summary>
      <div className="segmented" role="tablist" aria-label="Access method">
        {methods.map((m) => (
          <button key={m.id} role="tab" aria-selected={m.id === active.id} onClick={() => setTab(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="note">{active.intro}</p>
      <CodeBlock code={active.code} label={active.language === "shell" ? "command" : "code"} />
      <ul className="link-list">
        <li>
          <a href={browse} target="_blank" rel="noreferrer">
            Browse the files in cloud storage
          </a>
        </li>
        {catalogLink && (
          <li>
            <a href={catalogLink} target="_blank" rel="noreferrer">
              See it in the data catalog
            </a>
          </li>
        )}
        <li>
          <a href={`${GUIDANCE_SITE}/data-tools/access-methods.html`} target="_blank" rel="noreferrer">
            Guide to data access methods
          </a>
        </li>
      </ul>
    </details>
  );
}
