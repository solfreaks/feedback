import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import type { UserDetail } from "../types";
import Avatar from "../components/Avatar";

const roleDot: Record<string, string> = {
  super_admin: "bg-purple-500",
  admin: "bg-blue-500",
  user: "bg-gray-400",
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

export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [searchTrigger, setSearchTrigger] = useState(0);

  const fetchUsers = () => {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    api.get("/admin/users", { params }).then((r) => {
      setUsers(r.data.users);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
      setLoading(false);
    });
  };

  useEffect(() => { fetchUsers(); }, [page, roleFilter, searchTrigger]);

  // Auto-open user detail from query param
  useEffect(() => {
    const userId = searchParams.get("id");
    if (userId) {
      viewUser(userId);
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleSearch = () => { setPage(1); setSearchTrigger((t) => t + 1); };

  const viewUser = (id: string) => {
    setDetailLoading(true);
    api.get(`/admin/users/${id}`).then((r) => {
      setSelectedUser(r.data);
      setDetailLoading(false);
    });
  };

  const updateRole = async (userId: string, role: string) => {
    await api.patch(`/admin/users/${userId}/role`, { role });
    fetchUsers();
    if (selectedUser?.id === userId) viewUser(userId);
  };

  const toggleBan = async (userId: string, isBanned: boolean) => {
    await api.patch(`/admin/users/${userId}/ban`, { isBanned });
    fetchUsers();
    if (selectedUser?.id === userId) viewUser(userId);
  };

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
      admin: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
      user: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${styles[role] || styles.user}`}>{role.replace("_", " ")}</span>;
  };

  const timeAgo = (date?: string) => {
    if (!date) return "Never";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const statusBadge: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    in_progress: "bg-violet-100 text-violet-700",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-gray-100 text-gray-600",
  };
  const priorityBadge: Record<string, string> = {
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="flex gap-6">
      {/* Users list */}
      <div className={selectedUser ? "flex-1 min-w-0" : "w-full"}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total users</p>
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name or email..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-300 transition-all" />
          </div>

          {/* Role pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-10 flex-shrink-0">Role</span>
            {(["user", "admin", "super_admin"] as const).map((r) => (
              <FilterPill key={r} label={r.replace("_", " ")} active={roleFilter === r}
                onClick={() => { setRoleFilter(roleFilter === r ? "" : r); setPage(1); }}
                dot={roleDot[r]} />
            ))}
          </div>

          {(roleFilter || search) && (
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-500">Filters active</span>
              <button onClick={() => { setRoleFilter(""); setSearch(""); setPage(1); setSearchTrigger((t) => t + 1); }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Activity</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${selectedUser?.id === u.id ? "bg-blue-50" : ""}`}
                    onClick={() => viewUser(u.id)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar name={u.name} avatarUrl={u.avatarUrl} size={36} />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.isBanned ? "bg-red-500" : "bg-emerald-500"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{roleBadge(u.role)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {u._count.tickets}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {u._count.feedbacks}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.isBanned ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700 ring-1 ring-red-200">Banned</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">Active</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{timeAgo(u.lastActiveAt)}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No users found</td></tr>
                )}
              </tbody>
            </table>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
              <span className="text-xs text-gray-500">Page {page} of {totalPages} ({total} users)</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40">
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
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        p === page ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                      }`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-300 disabled:opacity-40">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User detail panel */}
      {selectedUser && (
        <div className="w-[380px] flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 sticky top-20">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="p-5 space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto">
                {/* Profile */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar name={selectedUser.name} avatarUrl={selectedUser.avatarUrl} size={56} />
                    <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${selectedUser.isBanned ? "bg-red-500" : "bg-emerald-500"}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{selectedUser.name}</p>
                    <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{selectedUser._count.tickets}</p>
                    <p className="text-[10px] text-blue-600/70 font-medium">Tickets</p>
                  </div>
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-violet-700">{selectedUser._count.feedbacks}</p>
                    <p className="text-[10px] text-violet-600/70 font-medium">Feedbacks</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-amber-700">{selectedUser._count.comments || 0}</p>
                    <p className="text-[10px] text-amber-600/70 font-medium">Comments</p>
                  </div>
                </div>

                {/* Info */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Role</span>
                    <select value={selectedUser.role} onChange={(e) => updateRole(selectedUser.id, e.target.value)}
                      className="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-blue-500/20 outline-none">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Status</span>
                    {selectedUser.isBanned ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">Banned</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">Active</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Last Active</span>
                    <span className="text-gray-700 font-medium">{timeAgo(selectedUser.lastActiveAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Auth Method</span>
                    <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                      {selectedUser.googleId ? (
                        <>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                          Google
                        </>
                      ) : "Email"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Joined</span>
                    <span className="text-gray-700 font-medium">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <button onClick={() => toggleBan(selectedUser.id, !selectedUser.isBanned)}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedUser.isBanned
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                      : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                  }`}>
                  {selectedUser.isBanned ? "Unban User" : "Ban User"}
                </button>

                {/* Recent tickets */}
                {selectedUser.recentTickets && selectedUser.recentTickets.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Tickets</p>
                    <div className="space-y-1.5">
                      {selectedUser.recentTickets.map((t) => (
                        <Link key={t.id} to={`/tickets/${t.id}`} className="block bg-gray-50 rounded-lg p-3 text-xs hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition-all cursor-pointer">
                          <p className="font-medium text-gray-900 truncate">{t.title}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge[t.status] || "bg-gray-100"}`}>{t.status}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityBadge[t.priority] || "bg-gray-100"}`}>{t.priority}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent feedbacks */}
                {selectedUser.recentFeedbacks && selectedUser.recentFeedbacks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Feedbacks</p>
                    <div className="space-y-1.5">
                      {selectedUser.recentFeedbacks.map((f) => (
                        <Link key={f.id} to={`/feedbacks/${f.id}`} className="block bg-gray-50 rounded-lg p-3 text-xs hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition-all cursor-pointer">
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <svg key={s} className={`w-3 h-3 ${s <= f.rating ? "text-yellow-400" : "text-gray-200"}`}
                                fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                            <span className="text-gray-400 ml-1">{f.category}</span>
                          </div>
                          {f.comment && <p className="text-gray-500 mt-1 truncate">{f.comment}</p>}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
