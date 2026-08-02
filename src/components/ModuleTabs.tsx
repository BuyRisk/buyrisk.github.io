import { useState, type ReactNode } from "react";

export interface ModuleTab {
  id: string;
  label: string;
  /** Rendered lazily: only the active tab's component mounts, so inactive
   *  sub-tools don't run animations or hold state in the background. */
  render: () => ReactNode;
}

/**
 * The top-level switcher for a consolidated tool module. Renders a labelled
 * segmented control and mounts only the active sub-tool. One shared primitive
 * keeps every module's tab behaviour and markup identical.
 */
export default function ModuleTabs({ label, tabs }: { label?: string; tabs: ModuleTab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div className="module-tabs">
        {label && <span className="wl-field-label">{label}</span>}
        <div className="wl-simmode wl-simmode--wrap" role="tablist" aria-label={label ?? "View"}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              className={active === t.id ? "active" : ""}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {current.render()}
    </div>
  );
}
