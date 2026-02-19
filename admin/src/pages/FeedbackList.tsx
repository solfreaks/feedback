import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import type { App } from "../types";

interface FeedbackItem {
  id: string;
  rating: number;
  category: string;
  comment?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
  app: { id: string; name: string };
  _count: { replies: number };
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

export default function FeedbackList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get("page") || "1");
  const appId = searchParams.get("appId") || "";
  const category = searchParams.get("category") || "";
  const rating = searchParams.get("rating") || "";

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
    if (rating) params.rating = rating;
    api.get("/admin/feedbacks", { params }).then((r) => {
      setFeedbacks(r.data.feedbacks);
      setTotal(r.data.total);
      setLoading(false);
    });
  }, [page, appId, category, rating]);

  const toggleFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (p.get(key) === value) p.delete(key); else p.set(key, value);
    p.set("page", "1");
    setSearchParams(p);
  };

  const totalPages = Math.ceil(total / 20);
  const activeFilters = [appId, category, rating].filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feedbacks</h1>
        <p className="text-sm text-gray-500 mt-1">{total} feedbacks from users across all apps</p>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-2.5">
        {/* Category pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-16 flex-shrink-0">Category</span>
          {Object.entries(categoryLabels).map(([k, v]) => (
            <FilterPill key={k} label={v} active={category === k}
              onClick={() => toggleFilter("category", k)} dot={categoryDot[k]} />
          ))}
        </div>

        {/* Rating pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-16 flex-shrink-0">Rating</span>
          {[5, 4, 3, 2, 1].map((r) => (
            <FilterPill key={r} label={`${"★".repeat(r)} ${r}`} active={rating === String(r)}
              onClick={() => toggleFilter("rating", String(r))}
              dot={r >= 4 ? "bg-emerald-500" : r === 3 ? "bg-amber-500" : "bg-red-500"} />
          ))}
        </div>

        {/* App pills */}
        {apps.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-16 flex-shrink-0">App</span>
            {apps.map((a) => (
              <FilterPill key={a.id} label={a.name} active={appId === a.id}
                onClick={() => toggleFilter("appId", a.id)} />
            ))}
          </div>
        )}

        {/* Active count + clear */}
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
          {/* Feedback Cards */}
          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <Link key={fb.id} to={`/feedbacks/${fb.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-sm font-bold text-white">
                      {fb.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{fb.user.name}</p>
                      <p className="text-xs text-gray-400">{fb.user.email} · {fb.app.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
    </div>
  );
}
