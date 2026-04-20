import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api from "../api";
import Avatar from "../components/Avatar";
import type { App } from "../types";
import { FilterBar, FilterPill, FilterGroup, SearchInput } from "../components/filters/FilterBar";

interface FeedbackItem {
  id: string;
  rating: number;
  category: string;
  status: string;
  comment?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
  app: { id: string; name: string };
  _count: { replies: number };
  isUnread?: boolean;
}

interface FeedbackStats {
  totalFeedbacks: number;
  averageRating: number;
  byCategory: { category: string; count: number; avgRating: number }[];
  byRating: { rating: number; count: number }[];
}

const categoryLabels: Record<string, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  suggestion: "Suggestion",
  complaint: "Complaint",
  general: "General",
};
const categoryColors: Record<string, string> = {
  bug_report: "bg-red-100 text-red-700",
  feature_request: "bg-blue-100 text-blue-700",
  suggestion: "bg-teal-100 text-teal-700",
  complaint: "bg-orange-100 text-orange-700",
  general: "bg-gray-100 text-gray-700",
};
const categoryDot: Record<string, string> = {
  bug_report: "bg-red-500",
  feature_request: "bg-blue-500",
  suggestion: "bg-teal-500",
  complaint: "bg-orange-500",
  general: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const statusColors: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800",
  acknowledged: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  resolved: "bg-emerald-100 text-emerald-700",
};
const statusDot: Record<string, string> = {
  new: "bg-yellow-500",
  acknowledged: "bg-blue-500",
  in_progress: "bg-purple-500",
  resolved: "bg-emerald-500",
};

function Stars({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`${size} ${s <= rating ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function FeedbackList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const focusedIdxRef = useRef(focusedIdx);
  focusedIdxRef.current = focusedIdx;
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const page = parseInt(searchParams.get("page") || "1");
  const appId = searchParams.get("appId") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";
  const rating = searchParams.get("rating") || "";
  const unread = searchParams.get("unread") === "true";
  const search = searchParams.get("search") || "";

  // Local input mirror so typing stays snappy; we commit to URL on Enter.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => { setSearchInput(search); }, [search]);
  const commitSearch = () => {
    const p = new URLSearchParams(searchParams);
    const v = searchInput.trim();
    if (v) p.set("search", v); else p.delete("search");
    p.delete("page");
    setSearchParams(p);
  };

  useEffect(() => {
    Promise.all([
      api.get("/admin/apps"),
      api.get("/admin/feedback-stats"),
    ]).then(([appsRes, statsRes]) => {
      setApps(appsRes.data);
      setStats(statsRes.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (appId) params.appId = appId;
    if (category) params.category = category;
    if (status) params.status = status;
    if (rating) params.rating = rating;
    if (search) params.search = search;
    if (unread) params.unread = "true";
    api.get("/admin/feedbacks", { params }).then((r) => {
      setFeedbacks(r.data.feedbacks);
      setTotal(r.data.total);
      setLoading(false);
    });
  }, [page, appId, category, status, rating, search, unread]);

  // Keyboard shortcuts mirror TicketList: J/K to move, Enter to open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(i + 1, feedbacks.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && focusedIdxRef.current >= 0) {
        const f = feedbacks[focusedIdxRef.current];
        if (f) navigate(`/feedbacks/${f.id}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [feedbacks, navigate]);

  useEffect(() => { setFocusedIdx(-1); }, [feedbacks]);

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
    const pageIds = feedbacks.map((f) => f.id);
    const allOnPageSelected = pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const refetch = async () => {
    const params: any = { page, limit: 20 };
    if (appId) params.appId = appId;
    if (category) params.category = category;
    if (status) params.status = status;
    if (rating) params.rating = rating;
    if (search) params.search = search;
    if (unread) params.unread = "true";
    const r = await api.get("/admin/feedbacks", { params });
    setFeedbacks(r.data.feedbacks);
    setTotal(r.data.total);
  };

  const bulkStatus = async (newStatus: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await api.patch("/admin/feedbacks/bulk", { ids, status: newStatus });
      clearSelection();
      await refetch();
    } catch (err) {
      console.error("Bulk update failed:", err);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} feedback${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    try {
      await api.delete("/admin/feedbacks/bulk", { data: { ids } });
      clearSelection();
      await refetch();
    } catch (err) {
      console.error("Bulk delete failed:", err);
    }
  };

  const exportCsv = async () => {
    const params: any = {};
    if (appId) params.appId = appId;
    if (category) params.category = category;
    if (status) params.status = status;
    if (rating) params.rating = rating;
    if (search) params.search = search;
    try {
      const res = await api.get("/admin/feedbacks/export.csv", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `feedbacks-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export failed:", err);
    }
  };

  const totalPages = Math.ceil(total / 20);
  const activeFilters = [appId, category, status, rating, search].filter(Boolean).length
    + (unread ? 1 : 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedbacks</h1>
          <p className="text-sm text-gray-500 mt-1">{total} feedbacks from users across all apps</p>
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

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Feedbacks</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalFeedbacks}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Average Rating</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-bold text-yellow-500">{stats.averageRating}</p>
              <Stars rating={Math.round(stats.averageRating)} />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rating Distribution</p>
            <div className="flex items-end gap-1.5 mt-2 h-8">
              {[1, 2, 3, 4, 5].map((r) => {
                const count = stats.byRating.find((br) => br.rating === r)?.count || 0;
                const max = Math.max(...stats.byRating.map((br) => br.count), 1);
                return (
                  <div key={r} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={`w-full rounded-sm ${r <= 2 ? "bg-red-400" : r === 3 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? "4px" : "0" }} />
                    <span className="text-[10px] text-gray-400">{r}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Top Category</p>
            {stats.byCategory.length > 0 ? (
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  categoryColors[stats.byCategory.sort((a, b) => b.count - a.count)[0].category] || ""
                }`}>
                  {categoryLabels[stats.byCategory[0].category] || stats.byCategory[0].category}
                </span>
                <p className="text-xs text-gray-400 mt-1">{stats.byCategory[0].count} feedbacks</p>
              </div>
            ) : <p className="text-sm text-gray-400 mt-1">No data</p>}
          </div>
        </div>
      )}

      {/* Filter bar. Primary axis is status; category/rating/app live behind
          the "More filters" popover so the bar stays one row at normal widths. */}
      <FilterBar
        primary={
          <>
            {Object.entries(statusLabels).map(([k, v]) => (
              <FilterPill
                key={k}
                label={v}
                active={status === k}
                onClick={() => toggleFilter("status", k)}
                dot={statusDot[k]}
              />
            ))}
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <FilterPill
              label="Unread"
              active={unread}
              onClick={() => toggleBoolFilter("unread")}
              dot="bg-blue-500"
            />
          </>
        }
        search={
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            onEnter={commitSearch}
            placeholder="Search feedback…"
          />
        }
        more={
          <>
            <FilterGroup label="Category">
              {Object.entries(categoryLabels).map(([k, v]) => (
                <FilterPill
                  key={k}
                  label={v}
                  active={category === k}
                  onClick={() => toggleFilter("category", k)}
                  dot={categoryDot[k]}
                />
              ))}
            </FilterGroup>
            <FilterGroup label="Rating">
              {[5, 4, 3, 2, 1].map((r) => (
                <FilterPill
                  key={r}
                  label={`${"★".repeat(r)} ${r}`}
                  active={rating === String(r)}
                  onClick={() => toggleFilter("rating", String(r))}
                  dot={r >= 4 ? "bg-emerald-500" : r === 3 ? "bg-amber-500" : "bg-red-500"}
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
          </>
        }
        activeCount={activeFilters}
        onClear={() => setSearchParams({})}
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {feedbacks.length > 0 && (
            <div className="mb-2 flex items-center gap-2 px-1">
              <input
                type="checkbox"
                aria-label="Select all on page"
                checked={feedbacks.every((f) => selected.has(f.id))}
                onChange={toggleSelectAllOnPage}
                className="rounded cursor-pointer"
              />
              <span className="text-xs text-gray-500">Select all on this page</span>
            </div>
          )}
          {/* Feedback Cards */}
          <div className="space-y-3">
            {feedbacks.map((fb, idx) => (
              <div key={fb.id} className="relative flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`Select feedback from ${fb.user.name}`}
                checked={selected.has(fb.id)}
                onChange={() => toggleSelect(fb.id)}
                className="rounded cursor-pointer mt-6"
              />
              <Link to={`/feedbacks/${fb.id}`}
                className={`flex-1 block bg-white rounded-xl border p-5 hover:border-blue-300 hover:shadow-sm transition-all ${
                  idx === focusedIdx ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {fb.isUnread && (
                      <span
                        className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"
                        title="Unread — user has activity you haven't seen"
                      />
                    )}
                    <Avatar name={fb.user.name} avatarUrl={fb.user.avatarUrl} size={36} />
                    <div>
                      <p className={`text-sm ${fb.isUnread ? "font-semibold" : "font-medium"} text-gray-900`}>{fb.user.name}</p>
                      <p className="text-xs text-gray-400">{fb.user.email} · {fb.app.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[fb.status] || "bg-gray-100 text-gray-600"}`}>
                      {statusLabels[fb.status] || fb.status}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColors[fb.category] || "bg-gray-100 text-gray-600"}`}>
                      {categoryLabels[fb.category] || fb.category}
                    </span>
                    <Stars rating={fb.rating} />
                  </div>
                </div>
                {fb.comment && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">{fb.comment}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span>{new Date(fb.createdAt).toLocaleString()}</span>
                  {fb._count.replies > 0 && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      {fb._count.replies} replies
                    </span>
                  )}
                </div>
              </Link>
              </div>
            ))}

            {feedbacks.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-gray-400">No feedbacks found</p>
                {activeFilters > 0 && <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
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

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="w-px h-6 bg-white/20" />
          <div className="relative group">
            <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs font-medium">
              Status ▾
            </button>
            <div className="absolute bottom-full left-0 mb-1 bg-white text-gray-800 rounded-lg shadow-lg hidden group-hover:block min-w-[140px]">
              {(["new", "acknowledged", "in_progress", "resolved"] as const).map((s) => (
                <button key={s} onClick={() => bulkStatus(s)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 capitalize">
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <button onClick={bulkDelete}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-red-200 hover:bg-red-500/20">
            Delete
          </button>
          <button onClick={clearSelection}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 hover:bg-white/10">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
