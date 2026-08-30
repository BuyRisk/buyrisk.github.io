import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

export interface ModuleTab {
  id: string;
  label: string;
  /** Eagerly bundled tab — use for the default (first) tab so it can server-
   *  render and paint immediately. */
  render?: () => ReactNode;
  /** Code-split tab: `() => import("./SomeLab")`. Only fetched when first
   *  opened, which keeps a module page's initial bundle to its default tab.
   *  Safe because non-default tabs can only activate client-side. */
  load?: () => Promise<{ default: ComponentType }>;
}

/**
 * The top-level switcher for a consolidated tool module. Renders a labelled
 * segmented control and mounts only the active sub-tool (inactive tools don't
 * run animations or hold state in the background). One shared primitive keeps
 * every module's tab behaviour and markup identical.
 *
 * Deep links: `#tab-id` selects that tab on load, and switching tabs updates
 * the hash — this is what lets a retired standalone page redirect into its
 * new home tab (see the redirects map in astro.config.mjs).
 */
export default function ModuleTabs({ label, tabs }: { label?: string; tabs: ModuleTab[] }) {
  const [active, setActive] = useState(tabs[0].id);

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h && tabs.some((t) => t.id === h)) setActive(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (id: string) => {
    setActive(id);
    if (typeof history !== "undefined") history.replaceState(null, "", `#${id}`);
  };

  // One lazy wrapper per code-split tab, created once (module tab arrays are
  // static literals, so the empty dependency list is safe).
  const lazies = useMemo(() => {
    const m = new Map<string, ComponentType>();
    for (const t of tabs) if (t.load) m.set(t.id, lazy(t.load));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const LazyTab = lazies.get(current.id);

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
              onClick={() => select(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {current.render ? (
        current.render()
      ) : LazyTab ? (
        <Suspense fallback={<p className="wl-note">Loading…</p>}>
          <LazyTab />
        </Suspense>
      ) : null}
    </div>
  );
}
