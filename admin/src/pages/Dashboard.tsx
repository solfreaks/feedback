import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, AreaChart, Area, CartesianGrid,
} from "recharts";
import api from "../api";
import type { Analytics } from "../types";

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

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#9ca3af"];
const BAR_COLORS: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#10b981" };
const RATING_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];

interface FeedbackStats {
  totalFeedbacks: number;
  averageRating: number;
  byCategory: { category: string; count: number; avgRating: number }[];
  byRating: { rating: number; count: number }[];
  byApp: { appName: string; count: number; avgRating: number }[];
}

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

const categoryLabels: Record<string, string> = {
  bug_report: "Bug Reports", feature_request: "Feature Requests",
  suggestion: "Suggestions", complaint: "Complaints", general: "General",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Analytics | null>(null);
  const [fbStats, setFbStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/admin/analytics"),
      api.get("/admin/feedback-stats"),
    ]).then(([ticketRes, fbRes]) => {
      setStats(ticketRes.data);
      setFbStats(fbRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-600 mx-auto" />
          <p className="text-sm text-gray-400 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const overview = stats?.overview;
  const totalTickets = overview?.totalTickets ?? 0;

  // Chart data
  const statusData = [
    { name: "Open", value: overview?.openTickets ?? 0 },
    { name: "In Progress", value: overview?.inProgressTickets ?? 0 },
    { name: "Resolved", value: overview?.resolvedTickets ?? 0 },
    { name: "Closed", value: overview?.closedTickets ?? 0 },
  ].filter((d) => d.value > 0);

  const priorityData = (stats?.byPriority ?? []).map((p) => ({
    name: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
    value: p.count,
    fill: BAR_COLORS[p.priority] || "#9ca3af",
  }));



  const appData = (stats?.byApp ?? []).map((a) => ({
    name: a.appName,
    tickets: a.count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of tickets and feedback across all apps</p>
        </div>
        <div className="text-xs text-gray-400">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: "Total Tickets", value: overview?.totalTickets ?? 0, change: null, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", gradient: "from-blue-500 to-blue-600" },
          { label: "Open Tickets", value: overview?.openTickets ?? 0, change: null, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", gradient: "from-amber-500 to-amber-600" },
          { label: "Critical", value: overview?.criticalOpen ?? 0, change: null, icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z", gradient: "from-red-500 to-red-600" },
          { label: "SLA Breached", value: overview?.slaBreached ?? 0, change: null, icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636", gradient: "from-rose-500 to-rose-600" },
          { label: "Avg Rating", value: fbStats?.averageRating ?? 0, change: null, icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", gradient: "from-yellow-500 to-yellow-600" },
        ].map((s) => (
          <div key={s.label} className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5 group hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{s.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
              </div>
              <div className={`bg-gradient-to-br ${s.gradient} p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                </svg>
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${s.gradient} opacity-60`} />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Ticket Status Donut Chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Ticket Status</h2>
          <p className="text-xs text-gray-400 mb-4">{totalTickets} total tickets</p>
          {statusData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={statusData} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {statusData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm text-gray-600">{d.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">{d.value}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        ({totalTickets > 0 ? Math.round((d.value / totalTickets) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-300 text-sm">No ticket data</div>
          )}
        </div>

        {/* Priority Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">By Priority</h2>
          <p className="text-xs text-gray-400 mb-4">Distribution across priority levels</p>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={priorityData} barCategoryGap="25%">
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: "13px" }}
                  cursor={{ fill: "rgba(0,0,0,0.02)" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-300 text-sm">No priority data</div>
          )}
        </div>

        {/* Rating Distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900">Feedback Ratings</h2>
            <Link to="/feedbacks" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <p className="text-xs text-gray-400 mb-4">{fbStats?.totalFeedbacks ?? 0} total feedbacks</p>

          <div className="text-center mb-4">
            <span className="text-4xl font-bold text-gray-900">{fbStats?.averageRating ?? 0}</span>
            <span className="text-lg text-gray-400">/5</span>
            <div className="flex justify-center mt-1">
              <Stars rating={Math.round(fbStats?.averageRating ?? 0)} size="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((r) => {
              const count = fbStats?.byRating.find((br) => br.rating === r)?.count || 0;
              const total = fbStats?.totalFeedbacks || 1;
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-3">{r}</span>
                  <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(count / total) * 100}%`, backgroundColor: RATING_COLORS[r - 1] }} />
                  </div>
                  <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Second Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tickets by App */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Tickets by App</h2>
          <p className="text-xs text-gray-400 mb-4">Volume across registered applications</p>
          {appData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={appData}>
                <defs>
                  <linearGradient id="ticketGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: "13px" }}
                />
                <Area type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={2.5} fill="url(#ticketGradient)" dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No app data</div>
          )}
        </div>

        {/* Feedback by Category */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Feedback Categories</h2>
          <p className="text-xs text-gray-400 mb-4">Breakdown by feedback type</p>
          {fbStats?.byCategory && fbStats.byCategory.length > 0 ? (
            <div className="space-y-3">
              {fbStats.byCategory
                .sort((a, b) => b.count - a.count)
                .map((cat) => {
                  const total = fbStats.totalFeedbacks || 1;
                  const pct = Math.round((cat.count / total) * 100);
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">
                          {categoryLabels[cat.category] || cat.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <Stars rating={Math.round(cat.avgRating)} size="w-3 h-3" />
                          <span className="text-xs text-gray-500">{cat.count} ({pct}%)</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No feedback data</div>
          )}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Recent Tickets</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest support tickets across all apps</p>
          </div>
          <Link to="/tickets"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
            View all
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">App</th>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(stats?.recentTickets ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <Link to={`/tickets/${t.id}`} className="text-gray-900 group-hover:text-blue-600 font-medium transition-colors">{t.title}</Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">{t.app.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-[10px] font-bold text-white">
                        {t.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-600">{t.user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${priorityColors[t.priority]}`}>{t.priority}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColors[t.status]}`}>{t.status.replace("_", " ")}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!stats?.recentTickets || stats.recentTickets.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-400 text-sm">No tickets yet</p>
                    <p className="text-gray-300 text-xs mt-1">Tickets from your apps will appear here</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
