import { useState, useEffect, type FormEvent } from "react";
import api from "../api";
import Avatar from "../components/Avatar";

type TabKey = "profile" | "security" | "email" | "notifications" | "admins" | "categories" | "system";
type AdminItem = { id: string; name: string; email: string; avatarUrl?: string; role: string };
type CategoryItem = { id: string; appId: string; name: string; description?: string };
type NotifPref = { type: string; inApp: boolean; email: boolean };
type SystemInfo = {
  counts: { totalApps: number; totalAdmins: number; totalUsers: number; totalTickets: number; totalFeedbacks: number; totalCategories: number };
  smtp: { appsWithSmtp: number; globalConfigured: boolean };
  lastActivity: { lastTicket?: string; lastFeedback?: string };
  server: { nodeVersion: string; uptime: number; platform: string };
};

const notifTypeLabels: Record<string, { label: string; desc: string }> = {
  new_ticket: { label: "New Ticket", desc: "When a user submits a new support ticket" },
  ticket_update: { label: "Ticket Update", desc: "When a ticket status or priority changes" },
  new_feedback: { label: "New Feedback", desc: "When a user submits new feedback" },
  new_comment: { label: "New Comment", desc: "When someone comments on a ticket" },
  feedback_reply: { label: "Feedback Reply", desc: "When someone replies to feedback" },
};

export default function Settings() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // Profile state
  const [name, setName] = useState(user.name || "");
  const [email] = useState(user.email || "");
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text: "", type: "" });

  // Admin management state
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regMsg, setRegMsg] = useState({ text: "", type: "" });
  const [adminList, setAdminList] = useState<AdminItem[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Test email state
  const [testEmailTo, setTestEmailTo] = useState(user.email || "");
  const [testEmailAppId, setTestEmailAppId] = useState("");
  const [testEmailApps, setTestEmailApps] = useState<{ id: string; name: string; smtpHost?: string; smtpPort?: number; smtpUser?: string; emailFrom?: string; emailName?: string }[]>([]);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState({ text: "", type: "" });
  const [testEmailHistory, setTestEmailHistory] = useState<{ to: string; source: string; time: string; ok: boolean; error?: string }[]>([]);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotifPref[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");

  // Categories state
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catAppId, setCatAppId] = useState("");
  const [catApps, setCatApps] = useState<{ id: string; name: string }[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [editCat, setEditCat] = useState<CategoryItem | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatDesc, setEditCatDesc] = useState("");

  // System info state
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [sysLoading, setSysLoading] = useState(false);

  // Avatar upload
  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/profile/avatar", fd);
      setAvatarUrl(data.avatarUrl);
      localStorage.setItem("user", JSON.stringify({ ...user, avatarUrl: data.avatarUrl }));
    } catch {
      setProfileMsg("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg("");
    try {
      const { data } = await api.patch("/admin/profile", { name });
      localStorage.setItem("user", JSON.stringify({ ...user, name: data.name }));
      setProfileMsg("Profile updated successfully");
      setTimeout(() => setProfileMsg(""), 3000);
    } catch {
      setProfileMsg("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setPwMsg({ text: "Passwords do not match", type: "error" }); return; }
    if (newPassword.length < 6) { setPwMsg({ text: "Password must be at least 6 characters", type: "error" }); return; }
    setPwSaving(true);
    setPwMsg({ text: "", type: "" });
    try {
      await api.patch("/auth/admin/password", { currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setPwMsg({ text: "Password changed successfully", type: "success" });
      setTimeout(() => setPwMsg({ text: "", type: "" }), 3000);
    } catch (err: any) {
      setPwMsg({ text: err.response?.data?.error || "Failed to change password", type: "error" });
    } finally {
      setPwSaving(false);
    }
  };

  // Admin management
  const fetchAdmins = () => {
    setAdminLoading(true);
    api.get("/admin/admins").then((r) => setAdminList(r.data)).finally(() => setAdminLoading(false));
  };

  const registerAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminName || !adminEmail || !adminPassword) return;
    setRegistering(true);
    setRegMsg({ text: "", type: "" });
    try {
      await api.post("/auth/admin/register", { name: adminName, email: adminEmail, password: adminPassword });
      setAdminName(""); setAdminEmail(""); setAdminPassword("");
      setRegMsg({ text: "Admin registered successfully!", type: "success" });
      setShowRegForm(false);
      fetchAdmins();
      setTimeout(() => setRegMsg({ text: "", type: "" }), 3000);
    } catch (err: any) {
      setRegMsg({ text: err.response?.data?.error || "Registration failed", type: "error" });
    } finally {
      setRegistering(false);
    }
  };

  const changeAdminRole = async (id: string, role: string) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      setAdminList((prev) => prev.map((a) => a.id === id ? { ...a, role } : a));
    } catch {}
  };

  const deleteAdmin = async (id: string) => {
    try {
      await api.delete(`/admin/users/${id}`);
      setAdminList((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
    } catch {}
  };

  // Test email
  useEffect(() => {
    api.get("/admin/apps").then((r) => setTestEmailApps(r.data));
  }, []);

  const sendTestEmail = async (e: FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setTestEmailMsg({ text: "", type: "" });
    const time = new Date().toLocaleTimeString();
    try {
      const { data } = await api.post("/admin/test-email", { to: testEmailTo, ...(testEmailAppId ? { appId: testEmailAppId } : {}) });
      const source = data.source === "app" ? "per-app SMTP" : "global SMTP";
      const smtpInfo = data.smtp ? `\nSMTP: ${data.smtp.response || "OK"}\nMessage ID: ${data.smtp.messageId || "N/A"}${data.smtp.rejected?.length ? `\nRejected: ${data.smtp.rejected.join(", ")}` : ""}` : "";
      setTestEmailMsg({ text: `Test email sent to ${data.to} via ${source}${smtpInfo}`, type: "success" });
      setTestEmailHistory((prev) => [{ to: data.to, source, time, ok: true }, ...prev].slice(0, 10));
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to send test email";
      setTestEmailMsg({ text: errorMsg, type: "error" });
      const selectedApp = testEmailApps.find((a) => a.id === testEmailAppId);
      setTestEmailHistory((prev) => [{ to: testEmailTo, source: selectedApp ? selectedApp.name : "global SMTP", time, ok: false, error: errorMsg }, ...prev].slice(0, 10));
    } finally {
      setSendingTest(false);
    }
  };

  const getSelectedSmtpInfo = () => {
    if (!testEmailAppId) return { type: "global", host: "From server .env", port: "", user: "", from: "" };
    const app = testEmailApps.find((a) => a.id === testEmailAppId);
    if (!app) return { type: "global", host: "From server .env", port: "", user: "", from: "" };
    if (app.smtpHost) return { type: "app", host: app.smtpHost, port: String(app.smtpPort || ""), user: app.smtpUser || "", from: app.emailFrom || "" };
    return { type: "app-fallback", host: "Not configured — will use global", port: "", user: "", from: app.emailFrom || "" };
  };

  // Notification preferences
  const fetchNotifPrefs = () => {
    setNotifLoading(true);
    api.get("/admin/notification-preferences").then((r) => setNotifPrefs(r.data)).finally(() => setNotifLoading(false));
  };

  const saveNotifPrefs = async () => {
    setNotifSaving(true);
    try {
      await api.put("/admin/notification-preferences", { preferences: notifPrefs });
      setNotifMsg("Preferences saved");
      setTimeout(() => setNotifMsg(""), 3000);
    } catch {
      setNotifMsg("Failed to save");
    } finally {
      setNotifSaving(false);
    }
  };

  const togglePref = (type: string, field: "inApp" | "email") => {
    setNotifPrefs((prev) => prev.map((p) => p.type === type ? { ...p, [field]: !p[field] } : p));
  };

  // Categories
  const fetchCategories = (appId: string) => {
    if (!appId) { setCategories([]); return; }
    setCatLoading(true);
    api.get("/admin/categories", { params: { appId } }).then((r) => setCategories(r.data)).finally(() => setCatLoading(false));
  };

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catAppId || !newCatName.trim()) return;
    setAddingCat(true);
    try {
      const { data } = await api.post("/admin/categories", { appId: catAppId, name: newCatName.trim(), description: newCatDesc.trim() || undefined });
      setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCatName(""); setNewCatDesc("");
    } catch {}
    setAddingCat(false);
  };

  const saveEditCat = async () => {
    if (!editCat) return;
    try {
      const { data } = await api.patch(`/admin/categories/${editCat.id}`, { name: editCatName.trim(), description: editCatDesc.trim() || null });
      setCategories((prev) => prev.map((c) => c.id === editCat.id ? data : c));
      setEditCat(null);
    } catch {}
  };

  const deleteCat = async (id: string) => {
    try {
      await api.delete(`/admin/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {}
  };

  // System info
  const fetchSysInfo = () => {
    setSysLoading(true);
    api.get("/admin/system-info").then((r) => setSysInfo(r.data)).catch(() => {}).finally(() => setSysLoading(false));
  };

  // Tab change handlers
  useEffect(() => {
    if (activeTab === "admins" && user.role === "super_admin") fetchAdmins();
    if (activeTab === "notifications") fetchNotifPrefs();
    if (activeTab === "categories") { setCatApps(testEmailApps); if (testEmailApps.length > 0 && !catAppId) { setCatAppId(testEmailApps[0].id); fetchCategories(testEmailApps[0].id); } }
    if (activeTab === "system" && user.role === "super_admin") fetchSysInfo();
  }, [activeTab]);

  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors";
  const btnPrimary = "bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors";

  const MsgBox = ({ text, type }: { text: string; type: string }) => (
    <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
      {type === "error" ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
      )}
      {text}
    </div>
  );

  const SectionHeader = ({ title, desc }: { title: string; desc: string }) => (
    <div className="px-6 py-4 border-b border-gray-100">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
    </div>
  );

  const tabs: { key: TabKey; label: string; icon: string; superOnly?: boolean }[] = [
    { key: "profile", label: "Profile", icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" },
    { key: "security", label: "Security", icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" },
    { key: "notifications", label: "Notifications", icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" },
    { key: "email", label: "Test Email", icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" },
    { key: "categories", label: "Categories", icon: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z" },
    { key: "admins", label: "Manage Admins", icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z", superOnly: true },
    { key: "system", label: "System Info", icon: "M11.42 15.17l-5.1-3.07a2.25 2.25 0 01-1.07-1.916V6.75m0 0l5.1-3.07a2.25 2.25 0 012.14 0l5.1 3.07M3.25 6.75l8.75 5.25m0 0l8.75-5.25M12 12v9.75m-4.13-4.92l-3.62-2.17a2.25 2.25 0 01-1.07-1.916V6.75", superOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.superOnly || user.role === "super_admin");

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {visibleTabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-gray-100 last:border-b-0 ${
                  activeTab === tab.key ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader title="Profile Information" desc="Update your personal details" />
              <form onSubmit={saveProfile} className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <label className="relative w-16 h-16 rounded-full cursor-pointer group">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }} />
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xl font-bold text-white overflow-hidden">
                      {avatarUrl ? <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full object-cover" /> : name.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {uploadingAvatar ? (
                        <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                      )}
                    </div>
                  </label>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{user.role === "super_admin" ? "Super Admin" : "Admin"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Click photo to change</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input type="email" value={email} disabled className={`${inputCls} !bg-gray-50 !text-gray-500 cursor-not-allowed !border-gray-200`} />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    {user.role === "super_admin" ? "Super Admin" : "Admin"}
                  </div>
                </div>
                <div className="pt-2 flex items-center gap-3">
                  <button type="submit" disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save Changes"}</button>
                  {profileMsg && (
                    <span className="text-sm text-emerald-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      {profileMsg}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader title="Change Password" desc="Update your password to keep your account secure" />
              <form onSubmit={changePassword} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter current password" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Enter new password" minLength={6} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" minLength={6} className={inputCls} />
                </div>
                {pwMsg.text && <MsgBox text={pwMsg.text} type={pwMsg.type} />}
                <div className="pt-2">
                  <button type="submit" disabled={pwSaving} className={btnPrimary}>{pwSaving ? "Changing..." : "Change Password"}</button>
                </div>
              </form>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader title="Notification Preferences" desc="Choose which notifications you receive" />
              {notifLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifPrefs.map((pref) => {
                    const info = notifTypeLabels[pref.type];
                    return (
                      <div key={pref.type} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{info?.label || pref.type}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{info?.desc || ""}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-gray-500">In-App</span>
                            <button type="button" onClick={() => togglePref(pref.type, "inApp")}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${pref.inApp ? "bg-blue-600" : "bg-gray-200"}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${pref.inApp ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
                            </button>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-gray-500">Email</span>
                            <button type="button" onClick={() => togglePref(pref.type, "email")}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${pref.email ? "bg-blue-600" : "bg-gray-200"}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${pref.email ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
                            </button>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                  <div className="px-6 py-4 flex items-center gap-3">
                    <button onClick={saveNotifPrefs} disabled={notifSaving} className={btnPrimary}>{notifSaving ? "Saving..." : "Save Preferences"}</button>
                    {notifMsg && <span className="text-sm text-emerald-600">{notifMsg}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Email Tab */}
          {activeTab === "email" && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <SectionHeader title="Test Email Configuration" desc="Send a test email to verify your SMTP settings are working" />
                <form onSubmit={sendTestEmail} className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Send To</label>
                      <input type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} required placeholder="recipient@example.com" className={inputCls} />
                      <p className="text-xs text-gray-400 mt-1">Defaults to your account email</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Source</label>
                      <select value={testEmailAppId} onChange={(e) => setTestEmailAppId(e.target.value)} className={`${inputCls} bg-white`}>
                        <option value="">Global SMTP (.env)</option>
                        {testEmailApps.map((a) => <option key={a.id} value={a.id}>{a.name}{a.smtpHost ? "" : " (no SMTP)"}</option>)}
                      </select>
                    </div>
                  </div>
                  {(() => {
                    const info = getSelectedSmtpInfo();
                    return (
                      <div className={`rounded-lg border p-4 ${info.type === "app" ? "bg-emerald-50 border-emerald-200" : info.type === "app-fallback" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
                        <p className={`text-sm font-medium mb-2 ${info.type === "app" ? "text-emerald-800" : info.type === "app-fallback" ? "text-amber-800" : "text-gray-700"}`}>
                          {info.type === "app" ? "Per-App SMTP" : info.type === "app-fallback" ? "No SMTP — fallback to global" : "Global SMTP Server"}
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Host:</span><span className="font-mono text-gray-600">{info.host || "—"}</span></div>
                          {info.port && <div className="flex justify-between"><span className="text-gray-500">Port:</span><span className="font-mono text-gray-600">{info.port}</span></div>}
                          {info.user && <div className="flex justify-between"><span className="text-gray-500">User:</span><span className="font-mono text-gray-600">{info.user}</span></div>}
                          {info.from && <div className="flex justify-between"><span className="text-gray-500">From:</span><span className="font-mono text-gray-600">{info.from}</span></div>}
                        </div>
                      </div>
                    );
                  })()}
                  {testEmailMsg.text && (
                    <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-lg ${testEmailMsg.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                      <div>
                        <p className="whitespace-pre-line">{testEmailMsg.text}</p>
                        {testEmailMsg.type === "error" && <p className="text-xs mt-1 opacity-75">Check SMTP credentials. Common issues: wrong password, port blocked, 2FA requiring an app password.</p>}
                      </div>
                    </div>
                  )}
                  <div className="pt-2">
                    <button type="submit" disabled={sendingTest} className={`inline-flex items-center gap-2 ${btnPrimary}`}>
                      {sendingTest ? (<><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />Sending...</>) : "Send Test Email"}
                    </button>
                  </div>
                </form>
              </div>

              {testEmailHistory.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Test History</h2>
                    <button onClick={() => setTestEmailHistory([])} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {testEmailHistory.map((entry, i) => (
                      <div key={i} className="px-6 py-3 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${entry.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-900 truncate">{entry.to}</span>
                            <span className="text-gray-300">via</span>
                            <span className="text-gray-500">{entry.source}</span>
                          </div>
                          {entry.error && <p className="text-xs text-red-500 mt-0.5 truncate">{entry.error}</p>}
                        </div>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{entry.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Template Previews */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <SectionHeader title="Email Templates" desc="Preview all email templates sent to users and admins" />
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <label className="text-sm font-medium text-gray-700">Preview as:</label>
                    <select value={testEmailAppId} onChange={(e) => setTestEmailAppId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400">
                      <option value="">SupportDesk (default)</option>
                      {testEmailApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  {(() => {
                    const previewAppName = testEmailAppId ? (testEmailApps.find((a) => a.id === testEmailAppId)?.name || "SupportDesk") : "SupportDesk";
                    const hdr = (n: string) => `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;"><div style="background:linear-gradient(135deg,#059669,#0d9488);padding:20px;text-align:center;"><span style="color:#fff;font-size:16px;font-weight:700;">${n}</span></div>`;
                    const ftr = (n: string, note?: string) => `<div style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center;">${note ? `<p style="margin:0 0 8px;font-size:11px;color:#9ca3af;">${note}</p>` : ""}<p style="margin:0;font-size:11px;color:#9ca3af;">Sent by ${n}</p></div></div>`;
                    return [
                      { name: "Welcome Email", desc: "Sent when a new user signs up", preview: `${hdr(previewAppName)}<div style="padding:24px;">
<h2 style="margin:0 0 6px;font-size:18px;color:#111827;">Welcome, John!</h2>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Your account has been created successfully.</p>
<div style="padding:12px;background:#ecfdf5;border-radius:6px;border:1px solid #a7f3d0;margin-bottom:8px;"><span style="font-size:16px;">🎧</span> <span style="font-size:13px;color:#065f46;font-weight:600;">Submit Support Tickets</span><br/><span style="font-size:12px;color:#047857;">Get help from our team with any issues.</span></div>
<div style="padding:12px;background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;margin-bottom:8px;"><span style="font-size:16px;">⭐</span> <span style="font-size:13px;color:#1e40af;font-weight:600;">Share Feedback</span><br/><span style="font-size:12px;color:#1d4ed8;">Rate your experience and help us improve.</span></div>
<div style="padding:12px;background:#fefce8;border-radius:6px;border:1px solid #fde68a;"><span style="font-size:16px;">🔔</span> <span style="font-size:13px;color:#92400e;font-weight:600;">Stay Updated</span><br/><span style="font-size:12px;color:#a16207;">Receive notifications on your tickets.</span></div>
</div>${ftr(previewAppName, "Thank you for joining us!")}` },
                      { name: "Ticket Created", desc: "Sent when a user submits a new ticket", preview: `${hdr(previewAppName)}<div style="padding:24px;">
<h2 style="margin:0 0 6px;font-size:18px;color:#111827;">Ticket Created</h2>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Your support request has been received.</p>
<div style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;padding:16px;">
<table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;">Title</td><td style="color:#111827;font-weight:500;padding:4px 0;">App crashes on login</td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Ticket ID</td><td style="padding:4px 0;"><code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:12px;">a1b2c3d4</code></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Status</td><td style="padding:4px 0;"><span style="background:#3b82f6;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">Open</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Created</td><td style="color:#111827;font-weight:500;padding:4px 0;">March 8, 2026</td></tr></table>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">You'll receive updates when there's activity.</p>
</div>${ftr(previewAppName, "We'll get back to you as soon as possible.")}` },
                      { name: "Status Change", desc: "Sent when ticket status is updated", preview: `${hdr(previewAppName)}<div style="padding:24px;">
<h2 style="margin:0 0 6px;font-size:18px;color:#111827;">Ticket Updated</h2>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">The status of your support ticket has been updated.</p>
<div style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;padding:16px;">
<table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;">Title</td><td style="color:#111827;font-weight:500;padding:4px 0;">App crashes on login</td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Status</td><td style="padding:4px 0;"><span style="background:#e5e7eb;color:#374151;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">Open</span> <span style="color:#9ca3af;margin:0 4px;">→</span> <span style="background:#10b981;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">Resolved</span></td></tr></table>
</div>
<div style="margin-top:16px;padding:12px;background:#ecfdf5;border-radius:6px;border:1px solid #a7f3d0;"><p style="margin:0;font-size:13px;color:#065f46;">✓ Your ticket has been marked as resolved.</p></div>
</div>${ftr(previewAppName)}` },
                      { name: "New Comment", desc: "Sent when someone comments on a ticket", preview: `${hdr(previewAppName)}<div style="padding:24px;">
<h2 style="margin:0 0 6px;font-size:18px;color:#111827;">New Comment</h2>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Someone has commented on your support ticket.</p>
<div style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;padding:16px;">
<table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;">Ticket</td><td style="color:#111827;font-weight:500;padding:4px 0;">App crashes on login</td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Comment by</td><td style="padding:4px 0;"><span style="color:#059669;font-weight:600;">Admin User</span></td></tr></table>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Open your ticket to view the full comment.</p>
</div>${ftr(previewAppName)}` },
                      { name: "Feedback Reply", desc: "Sent when admin replies to user feedback", preview: `${hdr(previewAppName)}<div style="padding:24px;">
<h2 style="margin:0 0 6px;font-size:18px;color:#111827;">Feedback Reply</h2>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Your feedback has received a response from our team.</p>
<div style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;padding:16px;">
<table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;">Your Rating</td><td style="padding:4px 0;"><span style="font-size:16px;color:#f59e0b;letter-spacing:2px;">★★★★☆</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Reply by</td><td style="padding:4px 0;"><span style="color:#059669;font-weight:600;">Admin User</span></td></tr></table>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Open the app to view the full reply.</p>
</div>${ftr(previewAppName)}` },
                      { name: "Admin: New Ticket", desc: "Sent to app admins when a new ticket is submitted", preview: `${hdr(previewAppName)}<div style="padding:24px;">
<h2 style="margin:0 0 6px;font-size:18px;color:#111827;">New Ticket Submitted</h2>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">A new support ticket has been submitted and needs attention.</p>
<div style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;padding:16px;">
<table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;width:100px;">Title</td><td style="color:#111827;font-weight:600;padding:4px 0;">App crashes on login</td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Submitted by</td><td style="padding:4px 0;"><span style="color:#059669;font-weight:600;">John Doe</span> <span style="color:#9ca3af;font-size:11px;">(john@example.com)</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Ticket ID</td><td style="padding:4px 0;"><code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;font-size:12px;">a1b2c3d4</code></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Priority</td><td style="padding:4px 0;"><span style="background:#F59E0B;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">High</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Category</td><td style="padding:4px 0;"><span style="background:#6366F1;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">Bug Report</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Status</td><td style="padding:4px 0;"><span style="background:#3b82f6;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">Open</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Assigned to</td><td style="padding:4px 0;"><span style="color:#2563EB;font-weight:600;">Admin User</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">SLA Deadline</td><td style="padding:4px 0;"><span style="color:#DC2626;font-weight:500;">Mar 10, 02:30 PM</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Created</td><td style="color:#111827;font-weight:500;padding:4px 0;">March 9, 2026, 10:30 AM</td></tr></table>
</div>
<div style="margin-top:14px;padding:14px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
<p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Description</p>
<p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">The app crashes immediately after entering credentials and tapping the login button. Happens every time on Android 14...</p>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Log in to the admin panel to review and respond.</p>
</div>${ftr(previewAppName, "Please review this ticket promptly.")}` },
                      { name: "Admin: New Feedback", desc: "Sent to app admins when new feedback is received", preview: `${hdr(previewAppName)}<div style="padding:24px;">
<h2 style="margin:0 0 6px;font-size:18px;color:#111827;">New Feedback Received</h2>
<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">A user has submitted new feedback for your app.</p>
<div style="margin-bottom:14px;padding:14px;background:#FEF2F2;border-radius:6px;border:1px solid #FECACA;text-align:center;">
<p style="margin:0 0 2px;font-size:20px;color:#EF4444;letter-spacing:3px;">★★☆☆☆</p>
<p style="margin:0;font-size:12px;font-weight:600;color:#EF4444;">2/5 — Negative</p>
</div>
<div style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;padding:16px;">
<table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;padding:4px 0;width:100px;">From</td><td style="padding:4px 0;"><span style="color:#059669;font-weight:600;">John Doe</span> <span style="color:#9ca3af;font-size:11px;">(john@example.com)</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Category</td><td style="padding:4px 0;"><span style="background:#6366F1;color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;">Bug Report</span></td></tr>
<tr><td style="color:#6b7280;padding:4px 0;">Submitted</td><td style="color:#111827;font-weight:500;padding:4px 0;">March 9, 2026, 10:30 AM</td></tr></table>
</div>
<div style="margin-top:14px;padding:14px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
<p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">User Comment</p>
<p style="margin:0;font-size:13px;color:#374151;line-height:1.5;font-style:italic;">"The app keeps freezing when I try to upload photos. Very frustrating experience, please fix this issue."</p>
</div>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Log in to the admin panel to view and reply.</p>
</div>${ftr(previewAppName)}` },
                    ].map((tmpl, i) => (
                      <details key={i} className="group border border-gray-200 rounded-lg overflow-hidden">
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{tmpl.name}</h3>
                            <p className="text-xs text-gray-500">{tmpl.desc}</p>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                        </summary>
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                          <div className="flex justify-center" dangerouslySetInnerHTML={{ __html: tmpl.preview }} />
                        </div>
                      </details>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === "categories" && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <SectionHeader title="Manage Categories" desc="Organize tickets and feedback with app-specific categories" />
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Select App</label>
                    <select value={catAppId} onChange={(e) => { setCatAppId(e.target.value); fetchCategories(e.target.value); }} className={`${inputCls} bg-white`}>
                      <option value="">Choose an app...</option>
                      {catApps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>

                  {catAppId && (
                    <>
                      {catLoading ? (
                        <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
                      ) : categories.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No categories yet for this app</p>
                      ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          {categories.map((cat, i) => (
                            <div key={cat.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                              {editCat?.id === cat.id ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input type="text" value={editCatName} onChange={(e) => setEditCatName(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm flex-1" />
                                  <input type="text" value={editCatDesc} onChange={(e) => setEditCatDesc(e.target.value)} placeholder="Description" className="border border-gray-300 rounded px-2 py-1 text-sm flex-1" />
                                  <button onClick={saveEditCat} className="text-blue-600 text-xs font-medium hover:text-blue-800">Save</button>
                                  <button onClick={() => setEditCat(null)} className="text-gray-400 text-xs hover:text-gray-600">Cancel</button>
                                </div>
                              ) : (
                                <>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                                    {cat.description && <p className="text-xs text-gray-500">{cat.description}</p>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => { setEditCat(cat); setEditCatName(cat.name); setEditCatDesc(cat.description || ""); }}
                                      className="text-gray-400 hover:text-blue-600 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                                    </button>
                                    <button onClick={() => deleteCat(cat.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add category form */}
                      <form onSubmit={addCategory} className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                          <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required placeholder="e.g. Billing" className={inputCls} />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                          <input type="text" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Brief description" className={inputCls} />
                        </div>
                        <button type="submit" disabled={addingCat} className={`${btnPrimary} whitespace-nowrap`}>{addingCat ? "Adding..." : "Add"}</button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manage Admins Tab (super_admin only) */}
          {activeTab === "admins" && user.role === "super_admin" && (
            <div className="space-y-5">
              {/* Admin List */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Admin Team</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{adminList.length} admin{adminList.length !== 1 ? "s" : ""} registered</p>
                  </div>
                  <button onClick={() => setShowRegForm(!showRegForm)}
                    className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Add Admin
                  </button>
                </div>

                {adminLoading ? (
                  <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {adminList.map((admin) => (
                      <div key={admin.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar name={admin.name} avatarUrl={admin.avatarUrl} size={36} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{admin.name} {admin.id === user.id && <span className="text-xs text-gray-400">(you)</span>}</p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {admin.id === user.id ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                            </span>
                          ) : (
                            <select value={admin.role} onChange={(e) => changeAdminRole(admin.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          )}
                          {admin.id !== user.id && (
                            deleteConfirm === admin.id ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => deleteAdmin(admin.id)} className="text-xs text-red-600 font-medium hover:text-red-800">Confirm</button>
                                <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirm(admin.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Register New Admin (collapsible) */}
              {showRegForm && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <SectionHeader title="Register New Admin" desc="Create a new admin account for your team" />
                  <form onSubmit={registerAdmin} className="p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                        <input type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} required placeholder="Enter admin name" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                        <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required placeholder="admin@company.com" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                      <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required placeholder="Create a password" minLength={6} className={inputCls} />
                      <p className="text-xs text-gray-400 mt-1">Minimum 6 characters</p>
                    </div>
                    {regMsg.text && <MsgBox text={regMsg.text} type={regMsg.type} />}
                    <div className="pt-2 flex items-center gap-3">
                      <button type="submit" disabled={registering} className={btnPrimary}>{registering ? "Registering..." : "Register Admin"}</button>
                      <button type="button" onClick={() => setShowRegForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* System Info Tab (super_admin only) */}
          {activeTab === "system" && user.role === "super_admin" && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">System Overview</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Platform statistics and server information</p>
                  </div>
                  <button onClick={fetchSysInfo} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Refresh</button>
                </div>
                {sysLoading || !sysInfo ? (
                  <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Apps", value: sysInfo.counts.totalApps, color: "bg-blue-50 text-blue-700" },
                        { label: "Admins", value: sysInfo.counts.totalAdmins, color: "bg-violet-50 text-violet-700" },
                        { label: "Users", value: sysInfo.counts.totalUsers, color: "bg-emerald-50 text-emerald-700" },
                        { label: "Tickets", value: sysInfo.counts.totalTickets, color: "bg-amber-50 text-amber-700" },
                        { label: "Feedbacks", value: sysInfo.counts.totalFeedbacks, color: "bg-pink-50 text-pink-700" },
                        { label: "Categories", value: sysInfo.counts.totalCategories, color: "bg-gray-50 text-gray-700" },
                      ].map((s) => (
                        <div key={s.label} className={`rounded-lg p-4 ${s.color}`}>
                          <p className="text-2xl font-bold">{s.value}</p>
                          <p className="text-xs font-medium mt-0.5 opacity-75">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Server Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Server</h3>
                      <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
                        {[
                          { label: "Node.js", value: sysInfo.server.nodeVersion },
                          { label: "Platform", value: sysInfo.server.platform },
                          { label: "Uptime", value: formatUptime(sysInfo.server.uptime) },
                          { label: "Global SMTP", value: sysInfo.smtp.globalConfigured ? "Configured" : "Not configured" },
                          { label: "Apps with SMTP", value: `${sysInfo.smtp.appsWithSmtp} / ${sysInfo.counts.totalApps}` },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <span className="text-gray-500">{row.label}</span>
                            <span className="font-medium text-gray-900 font-mono text-xs">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Last Activity */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Last Activity</h3>
                      <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-gray-500">Last Ticket</span>
                          <span className="text-gray-900 text-xs">{sysInfo.lastActivity.lastTicket ? new Date(sysInfo.lastActivity.lastTicket).toLocaleString() : "None"}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-gray-500">Last Feedback</span>
                          <span className="text-gray-900 text-xs">{sysInfo.lastActivity.lastFeedback ? new Date(sysInfo.lastActivity.lastFeedback).toLocaleString() : "None"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
