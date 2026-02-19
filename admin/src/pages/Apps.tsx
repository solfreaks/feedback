import { useState, useEffect, type FormEvent } from "react";
import api from "../api";
import type { App } from "../types";

const platformOptions = [
  { value: "", label: "Not specified" },
  { value: "flutter", label: "Flutter" },
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
  { value: "web", label: "Web" },
  { value: "react_native", label: "React Native" },
];

const platformIcon: Record<string, string> = {
  flutter: "F",
  android: "A",
  ios: "i",
  web: "W",
  react_native: "R",
};

const platformColor: Record<string, string> = {
  flutter: "from-sky-400 to-blue-600",
  android: "from-green-400 to-emerald-600",
  ios: "from-gray-400 to-gray-600",
  web: "from-orange-400 to-red-500",
  react_native: "from-cyan-400 to-blue-500",
};

export default function Apps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newApp, setNewApp] = useState({ name: "", description: "", platform: "", bundleId: "", emailFrom: "", emailName: "", smtpHost: "", smtpPort: "", smtpUser: "", smtpPass: "" });

  // Edit modal
  const [editApp, setEditApp] = useState<App | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", platform: "", bundleId: "", emailFrom: "", emailName: "", smtpHost: "", smtpPort: "", smtpUser: "", smtpPass: "" });

  // Delete confirm
  const [deleteApp, setDeleteApp] = useState<App | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchApps = () => {
    api.get("/admin/apps").then((r) => { setApps(r.data); setLoading(false); });
  };

  useEffect(() => { fetchApps(); }, []);

  const createApp = async (e: FormEvent) => {
    e.preventDefault();
    if (!newApp.name.trim()) return;
    setCreating(true);
    await api.post("/admin/apps", { ...newApp, smtpPort: newApp.smtpPort ? parseInt(newApp.smtpPort) : undefined });
    setNewApp({ name: "", description: "", platform: "", bundleId: "", emailFrom: "", emailName: "", smtpHost: "", smtpPort: "", smtpUser: "", smtpPass: "" });
    setShowCreate(false);
    setCreating(false);
    fetchApps();
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editApp) return;
    setSaving(true);
    await api.patch(`/admin/apps/${editApp.id}`, { ...editForm, smtpPort: editForm.smtpPort ? parseInt(editForm.smtpPort) : undefined });
    setSaving(false);
    setEditApp(null);
    fetchApps();
  };

  const openEdit = (app: App) => {
    setEditForm({ name: app.name, description: app.description || "", platform: app.platform || "", bundleId: app.bundleId || "", emailFrom: app.emailFrom || "", emailName: app.emailName || "", smtpHost: app.smtpHost || "", smtpPort: app.smtpPort ? String(app.smtpPort) : "", smtpUser: app.smtpUser || "", smtpPass: app.smtpPass || "" });
    setEditApp(app);
  };

  const uploadIcon = async (appId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/admin/apps/${appId}/icon`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    fetchApps();
  };

  const regenerateKey = async (appId: string) => {
    await api.post(`/admin/apps/${appId}/regenerate-key`);
    fetchApps();
  };

  const toggleActive = async (app: App) => {
    await api.patch(`/admin/apps/${app.id}`, { isActive: !app.isActive });
    fetchApps();
  };

  const confirmDelete = async () => {
    if (!deleteApp) return;
    setDeleting(true);
    await api.delete(`/admin/apps/${deleteApp.id}`);
    setDeleting(false);
    setDeleteApp(null);
    fetchApps();
  };

  const copyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const AppIcon = ({ app, size = 40 }: { app: App; size?: number }) => {
    if (app.iconUrl) {
      return <img src={`/api${app.iconUrl}`} alt={app.name} className="rounded-xl object-cover" style={{ width: size, height: size }} />;
    }
    const grad = platformColor[app.platform || ""] || "from-blue-500 to-violet-600";
    const letter = platformIcon[app.platform || ""] || app.name.charAt(0).toUpperCase();
    const textSize = size <= 32 ? "text-xs" : size <= 40 ? "text-sm" : "text-base";
    return (
      <div className={`rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold ${textSize}`}
        style={{ width: size, height: size }}>
        {letter}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apps</h1>
          <p className="text-sm text-gray-500 mt-1">{apps.length} registered application{apps.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Register App
        </button>
      </div>

      {/* Apps Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {apps.map((app) => (
          <div key={app.id} className={`bg-white rounded-xl border transition-all ${app.isActive ? "border-gray-200 hover:border-gray-300 hover:shadow-sm" : "border-gray-200 opacity-60"}`}>
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative group">
                  <AppIcon app={app} size={44} />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadIcon(app.id, e.target.files[0]); e.target.value = ""; }} />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{app.name}</h3>
                    {!app.isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{app.description || "No description"}</p>
                </div>
                <button onClick={() => openEdit(app)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              </div>

              {/* Meta pills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {app.platform && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                    {platformOptions.find((p) => p.value === app.platform)?.label || app.platform}
                  </span>
                )}
                {app.bundleId && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 font-mono">
                    {app.bundleId}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700">
                  {app._count?.tickets || 0} tickets
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                  {app._count?.feedbacks || 0} feedbacks
                </span>
              </div>

              {/* API Key */}
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">API Key</label>
                <div className="flex items-center gap-1.5">
                  <code className="bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg text-[11px] flex-1 overflow-x-auto font-mono text-gray-600 select-all">
                    {app.apiKey}
                  </code>
                  <button onClick={() => copyKey(app.id, app.apiKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex-shrink-0 ${
                      copiedId === app.id ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}>
                    {copiedId === app.id ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <span className="text-[11px] text-gray-400">
                Created {new Date(app.createdAt).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleActive(app)} title={app.isActive ? "Deactivate" : "Activate"}
                  className={`p-1.5 rounded-lg text-xs transition-colors ${app.isActive ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-100"}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    {app.isActive ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    )}
                  </svg>
                </button>
                <button onClick={() => regenerateKey(app.id)} title="Regenerate API key"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </button>
                <button onClick={() => setDeleteApp(app)} title="Delete app"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}

        {apps.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75l-5.571-3m11.142 0l4.179 2.25L12 17.25l-9.75-5.25 4.179-2.25m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" />
            </svg>
            <p className="text-gray-500 font-medium">No apps registered yet</p>
            <p className="text-sm text-gray-400 mt-1">Register your first app to get started</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Register New App</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={createApp} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">App Name *</label>
                <input type="text" value={newApp.name} onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                  required placeholder="e.g., ShopEase" autoFocus
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={newApp.description} onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                  placeholder="Brief description of the app" rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform</label>
                  <select value={newApp.platform} onChange={(e) => setNewApp({ ...newApp, platform: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">
                    {platformOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bundle ID</label>
                  <input type="text" value={newApp.bundleId} onChange={(e) => setNewApp({ ...newApp, bundleId: e.target.value })}
                    placeholder="com.example.app"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Email</label>
                  <input type="email" value={newApp.emailFrom} onChange={(e) => setNewApp({ ...newApp, emailFrom: e.target.value })}
                    placeholder="support@yourapp.com"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Name</label>
                  <input type="text" value={newApp.emailName} onChange={(e) => setNewApp({ ...newApp, emailName: e.target.value })}
                    placeholder="ShopEase Support"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">SMTP Settings (optional — uses global if empty)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Host</label>
                    <input type="text" value={newApp.smtpHost} onChange={(e) => setNewApp({ ...newApp, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Port</label>
                    <input type="number" value={newApp.smtpPort} onChange={(e) => setNewApp({ ...newApp, smtpPort: e.target.value })}
                      placeholder="587"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP User</label>
                    <input type="text" value={newApp.smtpUser} onChange={(e) => setNewApp({ ...newApp, smtpUser: e.target.value })}
                      placeholder="user@gmail.com"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Password</label>
                    <input type="password" value={newApp.smtpPass} onChange={(e) => setNewApp({ ...newApp, smtpPass: e.target.value })}
                      placeholder="app-password"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button type="submit" disabled={creating || !newApp.name.trim()}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                  {creating ? "Creating..." : "Register App"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditApp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit App</h2>
              <button onClick={() => setEditApp(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">App Name *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required autoFocus
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Brief description" rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform</label>
                  <select value={editForm.platform} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white">
                    {platformOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bundle ID</label>
                  <input type="text" value={editForm.bundleId} onChange={(e) => setEditForm({ ...editForm, bundleId: e.target.value })}
                    placeholder="com.example.app"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Email</label>
                  <input type="email" value={editForm.emailFrom} onChange={(e) => setEditForm({ ...editForm, emailFrom: e.target.value })}
                    placeholder="support@yourapp.com"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Name</label>
                  <input type="text" value={editForm.emailName} onChange={(e) => setEditForm({ ...editForm, emailName: e.target.value })}
                    placeholder="ShopEase Support"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">SMTP Settings (optional — uses global if empty)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Host</label>
                    <input type="text" value={editForm.smtpHost} onChange={(e) => setEditForm({ ...editForm, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Port</label>
                    <input type="number" value={editForm.smtpPort} onChange={(e) => setEditForm({ ...editForm, smtpPort: e.target.value })}
                      placeholder="587"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP User</label>
                    <input type="text" value={editForm.smtpUser} onChange={(e) => setEditForm({ ...editForm, smtpUser: e.target.value })}
                      placeholder="user@gmail.com"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Password</label>
                    <input type="password" value={editForm.smtpPass} onChange={(e) => setEditForm({ ...editForm, smtpPass: e.target.value })}
                      placeholder="app-password"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditApp(null)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                <button type="submit" disabled={saving || !editForm.name.trim()}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setDeleteApp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete {deleteApp.name}?</h3>
                <p className="text-sm text-gray-500 mt-0.5">This will permanently delete the app and all its data including tickets and feedbacks.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteApp(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? "Deleting..." : "Delete App"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
