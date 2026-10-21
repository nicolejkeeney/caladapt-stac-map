import { useState } from "react";

export default function CodeBlock({ code, label = "code" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <pre>{code}</pre>
      <button
        className="link-button"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : `Copy ${label}`}
      </button>
    </div>
  );
}
