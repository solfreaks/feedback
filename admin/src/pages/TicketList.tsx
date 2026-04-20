import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { FilterBar, FilterPill, FilterGroup, SearchInput } from "../components/filters/FilterBar";
import api from "../api";
import Avatar from "../components/Avatar";
import type { Ticket, App, Analytics } from "../types";

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 ring-1 ring-red-200",
  high: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
  medium: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  low: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
};
const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  in_progress: "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
  resolved: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  closed: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
};

const priorityDot: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};
const statusDot: Record<string, string> = {
  open: "bg-blue-500",
  in_progress: "bg-violet-500",
  resolved: "bg-emerald-500",
  closed: "bg-gray-400",
};

function slaTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function TicketList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const focusedIdxRef = useRef(focusedIdx);
  focusedIdxRef.current = focusedIdx;
  const [apps, setApps] = useState<App[]>([]);
  const [admins, setAdmins] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Analytics["overview"] | null>(null);
  // Selected ticket IDs persist across pagination so the admin can build up a
  // working set before acting. Stored as Set for fast add/remove lookups.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const page = parseInt(searchParams.get("page") || "1");
  const appId = searchParams.get("appId") || "";
  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";
  const assignedTo = searchParams.get("assignedTo") || "";
  const search = searchParams.get("search") || "";
  const stale = searchParams.get("stale") === "true";
  const unread = searchParams.get("unread") === "true";

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    Promise.all([
      api.get("/admin/apps"),
      api.get("/admin/admins"),
      api.get("/admin/analytics"),
    ]).then(([appsRes, adminsRes, analyticsRes]) => {
      setApps(appsRes.data);
      setAdmins(adminsRes.data);
      setStats(analyticsRes.data.overview);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (appId) params.appId = appId;
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (assignedTo) params.assignedTo = assignedTo;
    if (search) params.search = search;
    if (stale) params.stale = "true";
    if (unread) params.unread = "true";
    api.get("/admin/tickets", { params }).then((r) => {
      setTickets(r.data.tickets);
      setTotal(r.data.total);
      setLoading(false);
    });
  }, [page, appId, status, priority, assignedTo, search, stale, unread]);

  // Sync search input when URL changes
  useEffect(() => { setSearchInput(search); }, [search]);

  // Keyboard shortcuts: J/K to move selection, Enter to open, / to focus search.
  // Skipped when the user is typing in an input — standard convention.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, tickets.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusedIdxRef.current >= 0) {
        const t = tickets[focusedIdxRef.current];
        if (t) navigate(`/tickets/${t.id}`);
      } else if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[type="text"][placeholder*="Search tickets"]');
        input?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tickets, navigate]);

  // Reset focus when results change.
  useEffect(() => { setFocusedIdx(-1); }, [tickets]);

  const toggleFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (p.get(key) === value) p.delete(key); else p.set(key, value);
    p.set("page", "1");
    setSearchParams(p);
  };

  const toggleBoolFilter = (key: string) => {
    const p = new URLSearchParams(searchParams);
    if (p.get(key) === "true") p.delete(key); else p.set(key, "true");
    p.set("page", "1");
    setSearchParams(p);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = tickets.map((t) => t.id);
    const allOnPageSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const bulkUpdate = async (patch: Record<string, unknown>) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await api.patch("/admin/tickets/bulk", { ids, ...patch });
      clearSelection();
      // Refetch current page
      const params: any = { page, limit: 20 };
      if (appId) params.appId = appId;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (assignedTo) params.assignedTo = assignedTo;
      if (search) params.search = search;
      if (stale) params.stale = "true";
      if (unread) params.unread = "true";
      const r = await api.get("/admin/tickets", { params });
      setTickets(r.data.tickets);
      setTotal(r.data.total);
    } catch (err) {
      console.error("Bulk update failed:", err);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} ticket${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    try {
      await api.delete("/admin/tickets/bulk", { data: { ids } });
      clearSelection();
      const params: any = { page, limit: 20 };
      if (appId) params.appId = appId;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (assignedTo) params.assignedTo = assignedTo;
      if (search) params.search = search;
      if (stale) params.stale = "true";
      if (unread) params.unread = "true";
      const r = await api.get("/admin/tickets", { params });
      setTickets(r.data.tickets);
      setTotal(r.data.total);
    } catch (err) {
      console.error("Bulk delete failed:", err);
    }
  };

  const exportCsv = async () => {
    // Re-use the current filter set. Fetch the CSV as a blob via the axios
    // instance (auth headers get applied automatically) and trigger a download.
    const params: any = {};
    if (appId) params.appId = appId;
    if (status) params.status = status;
    if (priority) params.priority = priority;
    if (search) params.search = search;
    try {
      const res = await api.get("/admin/tickets/export.csv", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export failed:", err);
    }
  };

  const handleSearch = () => {
    const p = new URLSearchParams(searchParams);
    if (searchInput.trim()) p.set("search", searchInput.trim()); else p.delete("search");
    p.set("page", "1");
    setSearchParams(p);
  };

  const clearAllFilters = () => {
    setSearchInput("");
    setSearchParams({});
  };

  const totalPages = Math.ceil(total / 20);
  const activeFilters = [appId, status, priority, assignedTo, search].filter(Boolean).length
    + (stale ? 1 : 0) + (unread ? 1 : 0);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Manage support tickets across all apps</p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          title="Export current results as CSV"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total Tickets", value: stats.totalTickets, bg: "bg-blue-50", text: "text-blue-600", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
            { label: "Open", value: stats.openTickets, bg: "bg-amber-50", text: "text-amber-600", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
            { label: "Critical", value: stats.criticalOpen, bg: "bg-red-50", text: "text-red-600", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" },
            { label: "SLA Breached", value: stats.slaBreached, bg: "bg-rose-50", text: "text-rose-600", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <svg className={`w-5 h-5 ${s.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar. Primary axis is status (most-used); everything else
          lives behind "More filters" to keep the row shallow. */}
      <FilterBar
        primary={
          <>
            {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
              <FilterPill
                key={s}
                label={s.replace("_", " ")}
                active={status === s}
                onClick={() => toggleFilter("status", s)}
                dot={statusDot[s]}
              />
            ))}
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <FilterPill
              label="Unread"
              active={unread}
              onClick={() => toggleBoolFilter("unread")}
              dot="bg-blue-500"
            />
            <FilterPill
              label="Stale · 24h+"
              active={stale}
              onClick={() => toggleBoolFilter("stale")}
              dot="bg-amber-500"
            />
          </>
        }
        search={
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onEnter={handleSearch}
            placeholder="Search tickets by title or description…"
          />
        }
        more={
          <>
            <FilterGroup label="Priority">
              {(["critical", "high", "medium", "low"] as const).map((p) => (
                <FilterPill
                  key={p}
                  label={p}
                  active={priority === p}
                  onClick={() => toggleFilter("priority", p)}
                  dot={priorityDot[p]}
                />
              ))}
            </FilterGroup>
            {apps.length > 0 && (
              <FilterGroup label="App">
                {apps.map((a) => (
                  <FilterPill
                    key={a.id}
                    label={a.name}
                    active={appId === a.id}
                    onClick={() => toggleFilter("appId", a.id)}
                  />
                ))}
              </FilterGroup>
            )}
            {admins.length > 0 && (
              <FilterGroup label="Assignee">
                <FilterPill
                  label="Unassigned"
                  active={assignedTo === "unassigned"}
                  onClick={() => toggleFilter("assignedTo", "unassigned")}
                  dot="bg-gray-400"
                />
                {admins.map((a) => (
                  <FilterPill
                    key={a.id}
                    label={a.name}
                    active={assignedTo === a.id}
                    onClick={() => toggleFilter("assignedTo", a.id)}
                  />
                ))}
              </FilterGroup>
            )}
          </>
        }
        activeCount={activeFilters}
        onClear={clearAllFilters}
        rightSlot={
          activeFilters > 0 ? (
            <span className="text-xs text-gray-400 ml-1">
              {total} result{total !== 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all on page"
                        checked={tickets.length > 0 && tickets.every((t) => selected.has(t.id))}
                        onChange={toggleSelectAllOnPage}
                        className="rounded cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">App</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Assignee</th>
                    <th className="px-6 py-3">SLA</th>
                    <th className="px-6 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map((t, idx) => {
                    const slaBreach = t.slaDeadline && new Date(t.slaDeadline) < new Date() && t.status !== "closed" && t.status !== "resolved";
                    const slaLeft = t.slaDeadline && !slaBreach ? slaTimeLeft(t.slaDeadline) : null;
                    const isFocused = idx === focusedIdx;
                    // SLA red wins over stale amber; focused row overlays a ring.
                    const rowTint = slaBreach
                      ? "bg-red-50/50"
                      : t.isStale
                        ? "bg-amber-50/40"
                        : "";
                    return (
                      <tr
                        key={t.id}
                        className={`hover:bg-gray-50 transition-colors ${rowTint} ${isFocused ? "outline outline-2 -outline-offset-2 outline-blue-400" : ""}`}
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            aria-label={`Select ${t.title}`}
                            checked={selected.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            {t.isUnread && (
                              <span
                                className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"
                                title="Unread — user has activity you haven't seen"
                              />
                            )}
                            <Link to={`/tickets/${t.id}`} className={`text-blue-600 hover:text-blue-800 ${t.isUnread ? "font-semibold" : "font-medium"}`}>
                              {t.title}
                            </Link>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {t._count.comments}
                            </span>
                            {t._count.attachments > 0 && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                {t._count.attachments}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={t.user.name} avatarUrl={t.user.avatarUrl} size={24} />
                            <span className="text-gray-700">{t.user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs font-medium text-gray-700">{t.app.name}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityColors[t.priority]}`}>{t.priority}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[t.status]}`}>{t.status.replace("_", " ")}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          {t.assignee ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar name={t.assignee.name} avatarUrl={t.assignee.avatarUrl} size={20} />
                              <span className="text-gray-600 text-xs">{t.assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          {slaBreach ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-xs font-bold text-red-700 ring-1 ring-red-200">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                              BREACHED
                            </span>
                          ) : slaLeft ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-xs font-medium text-sky-700 ring-1 ring-sky-200">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {slaLeft}
                            </span>
                          ) : t.status === "resolved" || t.status === "closed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-xs font-medium text-emerald-600 ring-1 ring-emerald-200">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Met
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-gray-500 text-xs">{formatDate(t.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {tickets.length === 0 && (
                    <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>No tickets found</span>
                        {activeFilters > 0 && <span className="text-xs">Try adjusting your filters</span>}
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleFilter("page", String(page - 1))} disabled={page <= 1}
                  className="p-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button key={p} onClick={() => { const sp = new URLSearchParams(searchParams); sp.set("page", String(p)); setSearchParams(sp); }}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        p === page ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                      }`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => { const sp = new URLSearchParams(searchParams); sp.set("page", String(page + 1)); setSearchParams(sp); }}
                  disabled={page >= totalPages}
                  className="p-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bulk-action floating bar — shown while any ticket is selected. */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="w-px h-6 bg-white/20" />

          {/* Status */}
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs font-medium">
              Status ▾
            </button>
            <div className="absolute bottom-full left-0 mb-1 bg-white text-gray-800 rounded-lg shadow-lg hidden group-hover:block min-w-[140px]">
              {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
                <button key={s} onClick={() => bulkUpdate({ status: s })}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 capitalize">
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs font-medium">
              Priority ▾
            </button>
            <div className="absolute bottom-full left-0 mb-1 bg-white text-gray-800 rounded-lg shadow-lg hidden group-hover:block min-w-[120px]">
              {(["critical", "high", "medium", "low"] as const).map((p) => (
                <button key={p} onClick={() => bulkUpdate({ priority: p })}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 capitalize">
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Assign */}
          <div className="relative">
            <button
              onClick={() => setBulkAssignOpen((o) => !o)}
              className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs font-medium"
            >
              Assign ▾
            </button>
            {bulkAssignOpen && (
              <div className="absolute bottom-full left-0 mb-1 bg-white text-gray-800 rounded-lg shadow-lg min-w-[200px] max-h-64 overflow-y-auto">
                <button
                  onClick={() => { bulkUpdate({ assignedTo: null }); setBulkAssignOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100"
                >
                  Unassign
                </button>
                {admins.map((a) => (
                  <button key={a.id}
                    onClick={() => { bulkUpdate({ assignedTo: a.id }); setBulkAssignOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/20" />

          <button
            onClick={bulkDelete}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-red-200 hover:bg-red-500/20"
          >
            Delete
          </button>

          <button
            onClick={clearSelection}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
