import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import Avatar from "../components/Avatar";
import type { Ticket, App } from "../types";

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

export default function TicketList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const page = parseInt(searchParams.get("page") || "1");
  const appId = searchParams.get("appId") || "";
  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";

  useEffect(() => {
    api.get("/admin/apps").then((r) => setApps(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (appId) params.appId = appId;
    if (status) params.status = status;
    if (priority) params.priority = priority;
    api.get("/admin/tickets", { params }).then((r) => {
      setTickets(r.data.tickets);
      setTotal(r.data.total);
      setLoading(false);
    });
  }, [page, appId, status, priority]);

  const toggleFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (p.get(key) === value) p.delete(key); else p.set(key, value);
    p.set("page", "1");
    setSearchParams(p);
  };

  const totalPages = Math.ceil(total / 20);
  const activeFilters = [appId, status, priority].filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total tickets across all apps</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by title..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-300 transition-all" />
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
        </div>

        {/* Active filter count + clear */}
        {activeFilters > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-500">{activeFilters} filter{activeFilters > 1 ? "s" : ""} active</span>
            <button onClick={() => setSearchParams({})}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all
            </button>
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
                    return (
                      <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${slaBreach ? "bg-red-50/50" : ""}`}>
                        <td className="px-6 py-3.5">
                          <Link to={`/tickets/${t.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                            {t.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{t._count.comments} comments</span>
                            {t._count.attachments > 0 && (
                              <span className="text-xs text-gray-400">{t._count.attachments} files</span>
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
                        <td className="px-6 py-3.5 text-gray-600">{t.assignee?.name || <span className="text-gray-300">Unassigned</span>}</td>
                        <td className="px-6 py-3.5">
                          {slaBreach ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-xs font-bold text-red-700 ring-1 ring-red-200">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                              BREACHED
                            </span>
                          ) : t.slaDeadline ? (
                            <span className="text-xs text-gray-500">{new Date(t.slaDeadline).toLocaleString()}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-6 py-3.5 text-gray-500 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
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
