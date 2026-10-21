import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { GUIDANCE_SITE } from "../config";
import glossary from "../data/glossary.json";

type Slug = keyof typeof glossary;

/** Renders the glossary's inline markdown links as real links. */
function Definition({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        return m ? (
          <a key={i} href={m[2]} target="_blank" rel="noreferrer">
            {m[1]}
          </a>
        ) : (
          part
        );
      })}
    </>
  );
}

/** A term with its Analytics Engine glossary definition, shown on click. */
export default function Term({ slug, children }: { slug: Slug; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const entry = glossary[slug];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span className="term" ref={ref}>
      <button type="button" className="term-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {children}
      </button>
      {open && (
        <span className="term-popover" id={id} role="note">
          <strong>{entry.term}</strong>
          <span>
            <Definition text={entry.definition} />
          </span>
          <a href={`${GUIDANCE_SITE}/glossary/#${slug}`} target="_blank" rel="noreferrer">
            Open the glossary
          </a>
        </span>
      )}
    </span>
  );
}
