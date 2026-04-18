import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import api from "../api";
import { useCountUp } from "../hooks/useCountUp";
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
const WORKLOAD_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

interface FeedbackStats {
  totalFeedbacks: number;
  averageRating: number;
  byCategory: { category: string; count: number; avgRating: number }[];
  byRating: { rating: number; count: number }[];
  byApp: { appName: string; count: number; avgRating: number }[];
}

interface MyDashboard {
  role: string;
  assignedAppIds: string[] | null;
  myTickets: any[];
  myOpenCount: number;
  myTotalAssigned: number;
  myResolvedCount: number;
  mySlaBreached: number;
  trends: {
    ticketsCurrent: number;
    ticketsPrev: number;
    ticketsChange: number;
    feedbacksCurrent: number;
    feedbacksPrev: number;
    feedbacksChange: number;
  };
  unassignedCount: number;
  slaCompliance: {
    total: number;
    met: number;
    breached: number;
    rate: number;
  };
  workload: { adminId: string; name: string; count: number }[];
  activity: {
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    user: { id: string; name: string; avatarUrl?: string };
    ticket: { id: string; title: string; app: { name: string } };
  }[];
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

function TrendBadge({ change, label }: { change: number; label: string }) {
  if (change === 0) return <span className="text-xs text-gray-400">{label}</span>;
  const isUp = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-amber-600" : "text-emerald-600"}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d={isUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
      {Math.abs(change)}% {label}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function activityDescription(field: string, oldValue: string | null, newValue: string | null) {
  switch (field) {
    case "status": return `changed status from ${oldValue || "none"} to ${newValue}`;
    case "priority": return `changed priority from ${oldValue || "none"} to ${newValue}`;
    case "assignedTo": return newValue ? `assigned to ${newValue}` : "unassigned ticket";
    default: return `updated ${field}`;
  }
}

interface RecentFeedback {
  id: string;
  rating: number;
  category: string;
  comment?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
  app: { id: string; name: string };
  _count: { replies: number };
}

const DATE_RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Analytics | null>(null);
  const [fbStats, setFbStats] = useState<FeedbackStats | null>(null);
  const [recentFeedbacks, setRecentFeedbacks] = useState<RecentFeedback[]>([]);
  const [myDash, setMyDash] = useState<MyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [animated, setAnimated] = useState(false);
  const [dateRange, setDateRange] = useState(7);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchData = useCallback((days: number) => {
    api.get("/admin/my-dashboard", { params: { days } }).then((myRes) => {
      const my: MyDashboard = myRes.data;
      setMyDash(my);

      const scopeParams: Record<string, string> = {};
      if (my.assignedAppIds && my.assignedAppIds.length > 0) {
        scopeParams.appIds = my.assignedAppIds.join(",");
      }

      return Promise.all([
        api.get("/admin/analytics", { params: scopeParams }),
        api.get("/admin/feedback-stats", { params: scopeParams }),
        api.get("/admin/feedbacks", { params: { limit: 5, ...scopeParams } }),
      ]);
    }).then(([ticketRes, fbRes, recentFbRes]) => {
      setStats(ticketRes.data);
      setFbStats(fbRes.data);
      setRecentFeedbacks(recentFbRes.data.feedbacks ?? []);
      setLastRefresh(new Date());
      setLoading(false);
      setAnimated(true);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setAnimated(false);
    fetchData(dateRange);
    // Auto-refresh every 30s
    timerRef.current = setInterval(() => fetchData(dateRange), 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [dateRange, fetchData]);

  // Derived values (safe to compute even while loading, using nullish defaults)
  const overview = stats?.overview;
  const totalTickets = overview?.totalTickets ?? 0;
  const resolvedClosed = (overview?.resolvedTickets ?? 0) + (overview?.closedTickets ?? 0);
  const resolutionRate = totalTickets > 0 ? Math.round((resolvedClosed / totalTickets) * 100) : 0;
  const sla = myDash?.slaCompliance;
  const slaRate = sla?.rate ?? 100;

  // Animated counters — must be called unconditionally before any early return
  const cMyOpen = useCountUp(myDash?.myOpenCount ?? 0, 600, animated);
  const cMyTotal = useCountUp(myDash?.myTotalAssigned ?? 0, 600, animated);
  const cMyResolved = useCountUp(myDash?.myResolvedCount ?? 0, 600, animated);
  const cMySla = useCountUp(myDash?.mySlaBreached ?? 0, 600, animated);
  const cTotalTickets = useCountUp(overview?.totalTickets ?? 0, 700, animated);
  const cTotalFeedbacks = useCountUp(fbStats?.totalFeedbacks ?? 0, 700, animated);
  const cOpenTickets = useCountUp(overview?.openTickets ?? 0, 700, animated);
  const cCritical = useCountUp(overview?.criticalOpen ?? 0, 700, animated);
  const cResolutionRate = useCountUp(resolutionRate, 800, animated);
  const cAvgRating = useCountUp(Math.round((fbStats?.averageRating ?? 0) * 10), 700, animated);
  const animSlaRate = useCountUp(slaRate, 900, animated);
  const animSlaDash = useMemo(() => (animSlaRate / 100) * 314, [animSlaRate]);

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

  const isSuperAdmin = myDash?.role === "super_admin";

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

  const fbByAppMap = Object.fromEntries((fbStats?.byApp ?? []).map((a) => [a.appName, a]));
  const ticketAppNames = new Set((stats?.byApp ?? []).map((a) => a.appName));
  const allAppNames = new Set([...ticketAppNames, ...Object.keys(fbByAppMap)]);
  const appData = [...allAppNames].map((name) => ({
    name,
    tickets: (stats?.byApp ?? []).find((a) => a.appName === name)?.count ?? 0,
    feedbacks: fbByAppMap[name]?.count ?? 0,
  }));

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const slaColor = slaRate >= 90 ? "text-emerald-600" : slaRate >= 70 ? "text-amber-600" : "text-red-600";
  const slaTrackColor = slaRate >= 90 ? "#10b981" : slaRate >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {user.name || "Admin"}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSuperAdmin
              ? "Overview of tickets and feedback across all apps"
              : `Showing data for your ${myDash?.assignedAppIds?.length ?? 0} assigned app${(myDash?.assignedAppIds?.length ?? 0) !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range filter */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${dateRange === opt.value ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                {opt.label}
              </button>
            ))}
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${isSuperAdmin ? "bg-purple-100 text-purple-700 ring-1 ring-purple-200" : "bg-blue-100 text-blue-700 ring-1 ring-blue-200"}`}>
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live &middot; {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* Quick Actions + Unassigned Alert */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate("/tickets?status=open")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Open Tickets
        </button>
        <button onClick={() => navigate("/tickets?assignedTo=unassigned")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Unassigned
        </button>
        <button onClick={() => navigate("/tickets?priority=critical")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Critical
        </button>
        <button onClick={() => navigate("/feedbacks")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
          <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Feedbacks
        </button>

        {/* Unassigned tickets alert */}
        {(myDash?.unassignedCount ?? 0) > 0 && (
          <Link to="/tickets?assignedTo=unassigned"
            className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-all animate-pulse">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {myDash!.unassignedCount} unassigned ticket{myDash!.unassignedCount !== 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* My Stats + Trends Row */}
      {myDash && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5 group hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">My Open Tickets</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{cMyOpen}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 opacity-60" />
          </div>
          <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5 group hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">My Total Assigned</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{cMyTotal}</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-600 opacity-60" />
          </div>
          <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5 group hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">My Resolved</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{cMyResolved}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-60" />
          </div>
          <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5 group hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">My SLA Breached</p>
                <p className={`text-3xl font-bold mt-2 ${myDash.mySlaBreached > 0 ? "text-red-600" : "text-gray-900"}`}>{cMySla}</p>
              </div>
              <div className={`bg-gradient-to-br ${myDash.mySlaBreached > 0 ? "from-red-500 to-red-600" : "from-gray-400 to-gray-500"} p-2.5 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${myDash.mySlaBreached > 0 ? "from-red-500 to-red-600" : "from-gray-400 to-gray-500"} opacity-60`} />
          </div>
        </div>
      )}

      {/* My Active Tickets Table */}
      {myDash && myDash.myTickets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">My Active Tickets</h2>
              <p className="text-xs text-gray-400 mt-0.5">Tickets currently assigned to you</p>
            </div>
            <Link to={`/tickets?assignedTo=${user.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
              View all mine
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
                {myDash.myTickets.map((t: any) => (
                  <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <Link to={`/tickets/${t.id}`} className="text-gray-900 group-hover:text-blue-600 font-medium transition-colors">{t.title}</Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">{t.app?.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-[10px] font-bold text-white">
                          {t.user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-600">{t.user?.name}</span>
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
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overall Stats with Trends */}
      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
        {[
          { label: "Total Tickets", value: cTotalTickets, trend: myDash?.trends ? <TrendBadge change={myDash.trends.ticketsChange} label={`vs prev ${dateRange}d`} /> : null, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", gradient: "from-blue-500 to-blue-600" },
          { label: "Total Feedbacks", value: cTotalFeedbacks, trend: myDash?.trends ? <TrendBadge change={myDash.trends.feedbacksChange} label={`vs prev ${dateRange}d`} /> : null, icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z", gradient: "from-indigo-500 to-indigo-600" },
          { label: "Open Tickets", value: cOpenTickets, trend: null, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", gradient: "from-amber-500 to-amber-600" },
          { label: "Critical", value: cCritical, trend: null, icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z", gradient: "from-red-500 to-red-600" },
          { label: "Resolved", value: `${cResolutionRate}%`, trend: null, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", gradient: "from-emerald-500 to-emerald-600" },
          { label: "Avg Rating", value: (cAvgRating / 10).toFixed(1), trend: null, icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z", gradient: "from-yellow-500 to-yellow-600" },
        ].map((s, i) => (
          <div key={s.label} className="relative overflow-hidden bg-white rounded-2xl border border-gray-200 p-5 group hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{s.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{s.value}</p>
                {s.trend && <div className="mt-1">{s.trend}</div>}
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

      {/* Scope indicator for non-super admins */}
      {!isSuperAdmin && myDash?.assignedAppIds && myDash.assignedAppIds.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <svg className="w-10 h-10 text-amber-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-amber-800 font-medium">No apps assigned to you</p>
          <p className="text-amber-600 text-sm mt-1">Ask a super admin to assign you to apps so you can see their data here.</p>
        </div>
      )}

      {/* SLA Compliance + Workload + Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        {/* SLA Compliance Gauge */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">SLA Compliance</h2>
          <p className="text-xs text-gray-400 mb-4">Active tickets meeting SLA deadline</p>
          <div className="flex flex-col items-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={slaTrackColor} strokeWidth="10"
                  strokeDasharray={`${animSlaDash} 314`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-3xl font-bold ${slaColor}`}>{animSlaRate}%</span>
              </div>
            </div>
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{sla?.met ?? 0}</p>
                <p className="text-xs text-gray-400">On Track</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-red-600">{sla?.breached ?? 0}</p>
                <p className="text-xs text-gray-400">Breached</p>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{sla?.total ?? 0}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Workload */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Admin Workload</h2>
          <p className="text-xs text-gray-400 mb-4">Open tickets per admin</p>
          {(myDash?.workload ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={myDash!.workload} layout="vertical" barCategoryGap="20%">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} width={80} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: "13px" }}
                />
                <Bar dataKey="count" name="Tickets" radius={[0, 6, 6, 0]}>
                  {(myDash!.workload).map((_, i) => <Cell key={i} fill={WORKLOAD_COLORS[i % WORKLOAD_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-gray-300 text-sm">No assigned tickets</div>
          )}
        </div>

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
      </div>

      {/* Priority + Rating Row */}
      <div className="grid lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
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

        {/* Activity Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Activity Timeline</h2>
          <p className="text-xs text-gray-400 mb-4">Recent changes across tickets</p>
          {(myDash?.activity ?? []).length > 0 ? (
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {myDash!.activity.map((a) => (
                <div key={a.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600">
                    {a.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-medium">{a.user.name}</span>{" "}
                      {activityDescription(a.field, a.oldValue, a.newValue)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Link to={`/tickets/${a.ticket.id}`} className="text-[11px] text-blue-500 hover:underline truncate max-w-[140px]">
                        {a.ticket.title}
                      </Link>
                      <span className="text-[10px] text-gray-300">&middot;</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(a.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-gray-300 text-sm">No recent activity</div>
          )}
        </div>
      </div>

      {/* App Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 animate-fade-in-up" style={{ animationDelay: "380ms" }}>
        {/* Activity by App */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Activity by App</h2>
          <p className="text-xs text-gray-400 mb-4">
            {isSuperAdmin ? "Tickets & feedbacks across all applications" : "Tickets & feedbacks for your assigned apps"}
          </p>
          {appData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={appData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: "13px" }}
                />
                <Bar dataKey="tickets" name="Tickets" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="feedbacks" name="Feedbacks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
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
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-fade-in-up" style={{ animationDelay: "440ms" }}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Recent Tickets</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isSuperAdmin ? "Latest support tickets across all apps" : "Latest tickets from your assigned apps"}
            </p>
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

      {/* Recent Feedbacks */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-fade-in-up" style={{ animationDelay: "500ms" }}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Recent Feedbacks</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isSuperAdmin ? "Latest user feedback across all apps" : "Latest feedback from your assigned apps"}
            </p>
          </div>
          <Link to="/feedbacks"
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
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Rating</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Comment</th>
                <th className="px-6 py-3">App</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentFeedbacks.map((f) => (
                <tr key={f.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-[10px] font-bold text-white">
                        {f.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-600">{f.user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Stars rating={f.rating} size="w-3.5 h-3.5" />
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-violet-50 text-xs font-medium text-violet-600 ring-1 ring-violet-100">
                      {categoryLabels[f.category] || f.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <Link to={`/feedbacks/${f.id}`} className="text-gray-600 group-hover:text-blue-600 transition-colors truncate block">
                      {f.comment || <span className="text-gray-300 italic">No comment</span>}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-600">{f.app.name}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{new Date(f.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {recentFeedbacks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-gray-400 text-sm">No feedbacks yet</p>
                    <p className="text-gray-300 text-xs mt-1">User feedback will appear here</p>
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
