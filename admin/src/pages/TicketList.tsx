import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
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

function FilterPill({ label, active, onClick, dot }: { label: string; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
        active
          ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
      }`}>
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      {label}
      {active && (
        <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </button>
  );
}

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [admins, setAdmins] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Analytics["overview"] | null>(null);

  const page = parseInt(searchParams.get("page") || "1");
  const appId = searchParams.get("appId") || "";
  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";
  const assignedTo = searchParams.get("assignedTo") || "";
  const search = searchParams.get("search") || "";

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
    api.get("/admin/tickets", { params }).then((r) => {
      setTickets(r.data.tickets);
      setTotal(r.data.total);
      setLoading(false);
    });
  }, [page, appId, status, priority, assignedTo, search]);

  // Sync search input when URL changes
  useEffect(() => { setSearchInput(search); }, [search]);

  const toggleFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (p.get(key) === value) p.delete(key); else p.set(key, value);
    p.set("page", "1");
    setSearchParams(p);
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
  const activeFilters = [appId, status, priority, assignedTo, search].filter(Boolean).length;

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

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search tickets by title or description..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-20 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-300 transition-all" />
          {searchInput && (
            <button onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
              Search
            </button>
          )}
        </div>

        {/* Filter groups */}
        <div className="space-y-2.5">
          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0">Status</span>
            {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
              <FilterPill key={s} label={s.replace("_", " ")} active={status === s}
                onClick={() => toggleFilter("status", s)} dot={statusDot[s]} />
            ))}
          </div>

          {/* Priority pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0">Priority</span>
            {(["critical", "high", "medium", "low"] as const).map((p) => (
              <FilterPill key={p} label={p} active={priority === p}
                onClick={() => toggleFilter("priority", p)} dot={priorityDot[p]} />
            ))}
          </div>

          {/* App pills */}
          {apps.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0">App</span>
              {apps.map((a) => (
                <FilterPill key={a.id} label={a.name} active={appId === a.id}
                  onClick={() => toggleFilter("appId", a.id)} />
              ))}
            </div>
          )}

          {/* Assignee pills */}
          {admins.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-14 flex-shrink-0">Assign</span>
              <FilterPill label="Unassigned" active={assignedTo === "unassigned"}
                onClick={() => toggleFilter("assignedTo", "unassigned")} dot="bg-gray-400" />
              {admins.map((a) => (
                <FilterPill key={a.id} label={a.name} active={assignedTo === a.id}
                  onClick={() => toggleFilter("assignedTo", a.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Active filter count + clear */}
        {activeFilters > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-500">{activeFilters} filter{activeFilters > 1 ? "s" : ""} active</span>
            <button onClick={clearAllFilters}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all
            </button>
            <span className="ml-auto text-xs text-gray-400">{total} result{total !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

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
                  {tickets.map((t) => {
                    const slaBreach = t.slaDeadline && new Date(t.slaDeadline) < new Date() && t.status !== "closed" && t.status !== "resolved";
                    const slaLeft = t.slaDeadline && !slaBreach ? slaTimeLeft(t.slaDeadline) : null;
                    return (
                      <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${slaBreach ? "bg-red-50/50" : ""}`}>
                        <td className="px-6 py-3.5">
                          <Link to={`/tickets/${t.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                            {t.title}
                          </Link>
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
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">
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
    </div>
  );
}
