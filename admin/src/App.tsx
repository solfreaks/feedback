import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TicketList from "./pages/TicketList";
import TicketDetail from "./pages/TicketDetail";
import FeedbackList from "./pages/FeedbackList";
import FeedbackDetail from "./pages/FeedbackDetail";
import Apps from "./pages/Apps";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotificationDropdown from "./components/NotificationDropdown";
import Avatar from "./components/Avatar";
import api from "./api";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

interface NavCounts {
  openTickets: number;
  newFeedbacks: number;
  totalUsers: number;
  totalApps: number;
}

const mainNav = [
  { to: "/", label: "Dashboard", section: "main", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )},
];

const supportNav = [
  { to: "/tickets", label: "Tickets", section: "support", badgeKey: "openTickets" as const, badgeColor: "bg-blue-500", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
    </svg>
  )},
  { to: "/feedbacks", label: "Feedbacks", section: "support", badgeKey: "newFeedbacks" as const, badgeColor: "bg-amber-500", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  )},
];

const manageNav = [
  { to: "/users", label: "Users", section: "manage", badgeKey: "totalUsers" as const, icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )},
  { to: "/apps", label: "Apps", section: "manage", badgeKey: "totalApps" as const, icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75l-5.571-3m11.142 0l4.179 2.25L12 17.25l-9.75-5.25 4.179-2.25m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" />
    </svg>
  )},
  { to: "/settings", label: "Settings", section: "manage", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/tickets": "Tickets",
  "/feedbacks": "Feedbacks",
  "/users": "Users",
  "/apps": "Applications",
  "/settings": "Settings",
};

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<NavCounts>({ openTickets: 0, newFeedbacks: 0, totalUsers: 0, totalApps: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Fetch nav counts
  useEffect(() => {
    Promise.all([
      api.get("/admin/analytics").catch(() => ({ data: { overview: { openTickets: 0 } } })),
      api.get("/admin/feedback-stats").catch(() => ({ data: { totalFeedbacks: 0 } })),
      api.get("/admin/apps").catch(() => ({ data: [] })),
    ]).then(([analyticsRes, feedbackRes, appsRes]) => {
      setCounts({
        openTickets: analyticsRes.data.overview?.openTickets || 0,
        newFeedbacks: feedbackRes.data.totalFeedbacks || 0,
        totalUsers: 0,
        totalApps: Array.isArray(appsRes.data) ? appsRes.data.length : 0,
      });
    });
  }, [location.pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  // Search handler
  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // Simple search routing
      if (q.includes("ticket")) navigate("/tickets");
      else if (q.includes("feedback")) navigate("/feedbacks");
      else if (q.includes("user")) navigate("/users");
      else if (q.includes("app")) navigate("/apps");
      else if (q.includes("setting")) navigate("/settings");
      else navigate(`/tickets?search=${encodeURIComponent(q)}`);
      setSearchQuery("");
    }
  };

  // Get breadcrumb
  const getBreadcrumb = () => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const crumbs: { label: string; to?: string }[] = [];
    if (parts[0] === "tickets") {
      crumbs.push({ label: "Tickets", to: "/tickets" });
      if (parts[1]) crumbs.push({ label: `#${parts[1].slice(0, 8)}` });
    } else if (parts[0] === "feedbacks") {
      crumbs.push({ label: "Feedbacks", to: "/feedbacks" });
      if (parts[1]) crumbs.push({ label: `#${parts[1].slice(0, 8)}` });
    } else {
      const title = pageTitles[`/${parts[0]}`] || parts[0];
      crumbs.push({ label: title });
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumb();

  const sidebarW = collapsed ? "w-[68px]" : "w-[250px]";

  const renderNavItem = (item: typeof mainNav[0] & { badgeKey?: keyof NavCounts; badgeColor?: string }) => {
    const active = isActive(item.to);
    const count = item.badgeKey ? counts[item.badgeKey] : 0;
    return (
      <Link key={item.to} to={item.to} title={collapsed ? item.label : undefined}
        onClick={() => setMobileOpen(false)}
        className={`group flex items-center gap-3 rounded-xl transition-all duration-150 ${
          collapsed ? "justify-center px-0 py-2.5 mx-auto w-11 h-11" : "px-3 py-2"
        } ${
          active
            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/20"
            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        }`}>
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && (
          <>
            <span className={`text-[13px] flex-1 ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
            {count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                active ? "bg-white/25 text-white" : `${item.badgeColor || "bg-gray-200"} text-white`
              }`}>
                {count > 999 ? "999+" : count}
              </span>
            )}
          </>
        )}
        {collapsed && count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white" />
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`h-16 flex items-center border-b border-gray-100 flex-shrink-0 ${collapsed ? "justify-center px-0" : "px-5"}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="ml-3">
            <h1 className="text-[15px] font-bold text-gray-900 leading-tight">Feedback Hub</h1>
            <p className="text-[10px] text-gray-400 font-medium tracking-wide">ADMIN PANEL</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-4 ${collapsed ? "px-2" : "px-3"} overflow-y-auto`}>
        {/* Main */}
        <div className="space-y-1">
          {mainNav.map(renderNavItem)}
        </div>

        {/* Support section */}
        {!collapsed && (
          <div className="mt-6 mb-2 px-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Support</p>
          </div>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-gray-100" />}
        <div className="space-y-1">
          {supportNav.map(renderNavItem)}
        </div>

        {/* Manage section */}
        {!collapsed && (
          <div className="mt-6 mb-2 px-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manage</p>
          </div>
        )}
        {collapsed && <div className="my-3 mx-2 border-t border-gray-100" />}
        <div className="space-y-1">
          {manageNav.map(renderNavItem)}
        </div>
      </nav>

      {/* Collapse toggle */}
      <button onClick={toggleCollapsed}
        className="mx-auto mb-2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
        <svg className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      {/* User section */}
      <div className={`border-t border-gray-100 flex-shrink-0 ${collapsed ? "p-2" : "p-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Link to="/settings" title={user.name}>
              <Avatar name={user.name || "Admin"} avatarUrl={user.avatarUrl} size={32} />
            </Link>
            <button onClick={logout} title="Sign out"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            <Link to="/settings">
              <Avatar name={user.name || "Admin"} avatarUrl={user.avatarUrl} size={36} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{user.name || "Admin"}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.role === "super_admin" ? "Super Admin" : "Admin"}</p>
            </div>
            <button onClick={logout} title="Sign out"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#f5f6fa]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - Desktop */}
      <aside className={`${sidebarW} bg-white border-r border-gray-200/80 hidden lg:flex flex-col fixed h-full z-30 transition-all duration-300`}>
        {sidebarContent}
      </aside>

      {/* Sidebar - Mobile */}
      <aside className={`w-[250px] bg-white border-r border-gray-200/80 flex flex-col fixed h-full z-50 transition-transform duration-300 lg:hidden ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? "lg:ml-[68px]" : "lg:ml-[250px]"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 h-16 flex items-center">
          <div className="flex items-center justify-between w-full px-4 sm:px-6 lg:px-8">
            {/* Left: mobile menu + breadcrumb */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Mobile hamburger */}
              <button onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>

              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
                <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </Link>
                {breadcrumbs?.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5 min-w-0">
                    <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    {crumb.to ? (
                      <Link to={crumb.to} className="text-gray-500 hover:text-gray-700 font-medium transition-colors truncate">{crumb.label}</Link>
                    ) : (
                      <span className="text-gray-900 font-semibold truncate">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </div>

              {/* Mobile title */}
              <span className="sm:hidden text-sm font-semibold text-gray-900 truncate">
                {pageTitles[`/${location.pathname.split("/")[1]}`] || "Feedback Hub"}
              </span>
            </div>

            {/* Center: Search */}
            <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
              <div className={`relative w-full transition-all ${searchFocused ? "scale-[1.02]" : ""}`}>
                <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Search tickets, feedbacks, users..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                  onKeyDown={handleSearch}
                  className={`w-full border rounded-xl pl-10 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none transition-all ${
                    searchFocused
                      ? "bg-white border-blue-300 ring-2 ring-blue-500/20 shadow-sm"
                      : "bg-gray-50 border-gray-200 hover:border-gray-300"
                  }`} />
                {!searchFocused && !searchQuery && (
                  <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-400 font-mono">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Mobile search toggle */}
              <button className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </button>

              <NotificationDropdown />

              <div className="w-px h-8 bg-gray-200 hidden sm:block" />

              <Link to="/settings" className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-2 py-1.5 transition-colors">
                <Avatar name={user.name || "Admin"} avatarUrl={user.avatarUrl} size={32} />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-700 leading-tight">{user.name || "Admin"}</p>
                  <p className="text-[11px] text-gray-400 leading-tight">{user.role === "super_admin" ? "Super Admin" : "Admin"}</p>
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export { Avatar };

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/tickets" element={<ProtectedRoute><Layout><TicketList /></Layout></ProtectedRoute>} />
        <Route path="/tickets/:id" element={<ProtectedRoute><Layout><TicketDetail /></Layout></ProtectedRoute>} />
        <Route path="/feedbacks" element={<ProtectedRoute><Layout><FeedbackList /></Layout></ProtectedRoute>} />
        <Route path="/feedbacks/:id" element={<ProtectedRoute><Layout><FeedbackDetail /></Layout></ProtectedRoute>} />
        <Route path="/apps" element={<ProtectedRoute><Layout><Apps /></Layout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Layout><Users /></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
