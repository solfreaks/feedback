import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shared list-page filter bar. Three slots:
 *   - `primary`   – pill group shown inline (status for tickets, category
 *                   for feedback, role for users, etc.). Stays visible.
 *   - `search`    – the SearchInput, rendered in the middle.
 *   - `more`      – hidden behind a "More filters" button that opens a popover.
 *                   Secondary axes (app, assignee, date range) live here so the
 *                   bar stays shallow.
 *
 * `activeCount` drives the badge on the "More" button and shows the
 * optional `onClear` link. Keep state ownership on the calling page — this
 * component is purely presentation.
 */
export function FilterBar({
  primary,
  search,
  more,
  activeCount,
  onClear,
  rightSlot,
}: {
  primary?: ReactNode;
  search?: ReactNode;
  more?: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  rightSlot?: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 mb-5">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Primary pills */}
        {primary && (
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {primary}
          </div>
        )}

        {/* Search flexes to fill remaining row */}
        {search && <div className="flex-1 min-w-[200px]">{search}</div>}

        {/* Right-side controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {more && (
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  moreOpen || (activeCount ?? 0) > 0
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
                More filters
                {(activeCount ?? 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-blue-600 text-white">
                    {activeCount}
                  </span>
                )}
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(92vw,360px)] bg-white rounded-xl border border-gray-200 shadow-lg z-20 p-3 animate-fade-in">
                  <div className="max-h-[60vh] overflow-y-auto">{more}</div>
                </div>
              )}
            </div>
          )}

          {onClear && (activeCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-gray-500 hover:text-red-600 font-medium transition-colors"
            >
              Clear
            </button>
          )}

          {rightSlot}
        </div>
      </div>
    </div>
  );
}

/** Single filter pill — primary slot or `more` popover groups. */
export function FilterPill({
  label,
  active,
  onClick,
  dot,
  icon,
  count,
  size = "md",
}: {
  label: ReactNode;
  active: boolean;
  onClick: () => void;
  dot?: string;
  icon?: ReactNode;
  count?: number;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 ${pad} rounded-full font-medium border transition-all active:scale-95 ${
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50"
      }`}
    >
      {icon ?? (dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white/70" : dot}`} />)}
      {label}
      {count !== undefined && count > 0 && (
        <span className={`tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          active ? "bg-white/25" : "bg-gray-100 text-gray-500"
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

/** Labeled row of pills inside the `more` popover. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Shared search input — debounced externally by the caller. */
export function SearchInput({
  value,
  onChange,
  onEnter,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        placeholder={placeholder ?? "Search…"}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-300 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
