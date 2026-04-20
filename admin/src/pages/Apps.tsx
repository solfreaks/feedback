import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import type { App } from "../types";
import Avatar from "../components/Avatar";
import { SearchInput } from "../components/filters/FilterBar";

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

const smtpPresets = [
  { label: "Custom", host: "", port: "", user: "" },
  { label: "Gmail", host: "smtp.gmail.com", port: "587", user: "" },
  { label: "Outlook", host: "smtp-mail.outlook.com", port: "587", user: "" },
  { label: "Yahoo", host: "smtp.mail.yahoo.com", port: "587", user: "" },
  { label: "SendGrid", host: "smtp.sendgrid.net", port: "587", user: "apikey" },
  { label: "Mailgun", host: "smtp.mailgun.org", port: "587", user: "" },
];

const emptyForm = { name: "", description: "", platform: "", bundleId: "", googleClientId: "", emailFrom: "", emailName: "", smtpHost: "", smtpPort: "", smtpUser: "", smtpPass: "", firebaseProjectId: "", firebaseClientEmail: "", firebasePrivateKey: "" };

type AppForm = typeof emptyForm;

// Setup completeness score
function getSetupScore(app: App) {
  const checks = [
    { key: "basics", label: "Basics", done: !!app.name },
    { key: "auth", label: "Auth", done: !!app.googleClientId },
    { key: "email", label: "Email", done: !!(app.emailFrom || app.smtpHost) },
    { key: "fcm", label: "FCM", done: !!(app.firebaseProjectId && app.firebaseClientEmail && app.firebasePrivateKey) },
    { key: "admins", label: "Admins", done: !!(app.admins && app.admins.length > 0) },
  ];
  const done = checks.filter((c) => c.done).length;
  return { checks, done, total: checks.length, pct: Math.round((done / checks.length) * 100) };
}

// Validate Google Client ID format
function validateGoogleClientId(id: string): string | null {
  if (!id) return null;
  if (!id.endsWith(".apps.googleusercontent.com")) return "Must end with .apps.googleusercontent.com";
  if (id.split(".").length < 3) return "Invalid format";
  return null;
}

// Platform code snippets for onboarding
function getCodeSnippet(platform: string, apiKey: string) {
  switch (platform) {
    case "flutter":
      return `// pubspec.yaml\ndependencies:\n  http: ^1.2.0\n  google_sign_in: ^6.2.1\n\n// lib/api.dart\nconst baseUrl = 'https://your-server.com';\nconst apiKey = '${apiKey}';\n\n// Add to all requests:\n// headers: {\n//   'x-api-key': apiKey,\n//   'Authorization': 'Bearer \$jwtToken',\n// }`;
    case "android":
      return `// build.gradle (app)\nimplementation 'com.squareup.okhttp3:okhttp:4.12.0'\nimplementation 'com.google.code.gson:gson:2.11.0'\nimplementation 'com.google.android.gms:play-services-auth:21.3.0'\n\n// FeedbackApi.kt\nconst val BASE_URL = "https://your-server.com"\nprivate const val API_KEY = "${apiKey}"\n\n// Add to OkHttp interceptor:\n// .addHeader("x-api-key", API_KEY)`;
    case "ios":
      return `// Podfile\npod 'Alamofire', '~> 5.9'\npod 'GoogleSignIn', '~> 7.1'\n\n// FeedbackAPI.swift\nlet baseURL = "https://your-server.com"\nlet apiKey = "${apiKey}"\n\n// Add to all requests:\n// request.setValue(apiKey, forHTTPHeaderField: "x-api-key")`;
    case "react_native":
      return `// package.json\n"dependencies": {\n  "axios": "^1.7.0",\n  "@react-native-google-signin/google-signin": "^12.0.0"\n}\n\n// api.js\nconst api = axios.create({\n  baseURL: 'https://your-server.com',\n  headers: { 'x-api-key': '${apiKey}' }\n});`;
    default:
      return `// API Configuration\nconst BASE_URL = "https://your-server.com";\nconst API_KEY = "${apiKey}";\n\n// Add to all requests:\n// Header: x-api-key: ${apiKey}\n// Header: Authorization: Bearer <jwt_token>`;
  }
}

export default function Apps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newApp, setNewApp] = useState<AppForm>({ ...emptyForm });
  const [wizardAdminIds, setWizardAdminIds] = useState<string[]>([]);
  const [allAdmins, setAllAdmins] = useState<{ id: string; name: string; avatarUrl?: string | null }[]>([]);
  const [cloneSource, setCloneSource] = useState<string>("");
  const [createdApp, setCreatedApp] = useState<App | null>(null); // For post-creation onboarding
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Validation
  const [googleIdError, setGoogleIdError] = useState<string | null>(null);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [firebaseValidating, setFirebaseValidating] = useState(false);
  const [firebaseResult, setFirebaseResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // Test-push state lives only in the edit modal since it requires a saved appId.
  const [testPushSending, setTestPushSending] = useState(false);
  const [testPushResult, setTestPushResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // Announcement composer now lives on the per-app detail page
  // (/apps/:id). The list card only links to it.

  // Edit modal
  const [editApp, setEditApp] = useState<App | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<AppForm>({ ...emptyForm });
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);

  // Delete confirm
  const [deleteApp, setDeleteApp] = useState<App | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Setup guide
  const [showGuide, setShowGuide] = useState(false);

  // Regen key
  const [regenConfirm, setRegenConfirm] = useState<string | null>(null);

  // Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  const fetchApps = useCallback(() => {
    api.get("/admin/apps").then((r) => { setApps(r.data); setLoading(false); });
  }, []);

  const fetchAdmins = useCallback(() => {
    api.get("/admin/admins").then((r) => setAllAdmins(r.data));
  }, []);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  // Wizard steps
  const WIZARD_STEPS = [
    { label: "Basics", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
    { label: "Auth", icon: "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" },
    { label: "Email", icon: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" },
    { label: "FCM", icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" },
    { label: "Admins", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  ];

  const openWizard = (cloneFromId?: string) => {
    if (cloneFromId) {
      const src = apps.find((a) => a.id === cloneFromId);
      if (src) {
        setNewApp({
          name: "", description: src.description || "", platform: src.platform || "", bundleId: "",
          googleClientId: src.googleClientId || "", emailFrom: src.emailFrom || "", emailName: src.emailName || "",
          smtpHost: src.smtpHost || "", smtpPort: src.smtpPort ? String(src.smtpPort) : "", smtpUser: src.smtpUser || "", smtpPass: src.smtpPass || "",
          firebaseProjectId: src.firebaseProjectId || "", firebaseClientEmail: src.firebaseClientEmail || "", firebasePrivateKey: src.firebasePrivateKey || "",
        });
        setWizardAdminIds((src.admins || []).map((a) => a.id));
        setCloneSource(src.name);
      }
    } else {
      setNewApp({ ...emptyForm });
      setWizardAdminIds([]);
      setCloneSource("");
    }
    setWizardStep(0);
    setCreatedApp(null);
    setGoogleIdError(null);
    setSmtpTestResult(null);
    setFirebaseResult(null);
    setWizardOpen(true);
    fetchAdmins();
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setCreatedApp(null);
    setCloneSource("");
  };

  const createApp = async () => {
    if (!newApp.name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post("/admin/apps", { ...newApp, smtpPort: newApp.smtpPort ? parseInt(newApp.smtpPort) : undefined });
      const created = res.data;
      // Assign admins if any selected
      if (wizardAdminIds.length > 0) {
        await api.put(`/admin/apps/${created.id}/admins`, { adminIds: wizardAdminIds });
      }
      // Refetch to get the full app with counts
      const detail = await api.get(`/admin/apps/${created.id}`);
      setCreatedApp(detail.data);
      setWizardStep(5); // Done step
      fetchApps();
    } catch {
      // stay on current step
    }
    setCreating(false);
  };

  // Firebase JSON upload
  const handleFirebaseJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setNewApp((prev) => ({
          ...prev,
          firebaseProjectId: json.project_id || prev.firebaseProjectId,
          firebaseClientEmail: json.client_email || prev.firebaseClientEmail,
          firebasePrivateKey: json.private_key || prev.firebasePrivateKey,
        }));
        setFirebaseResult({ ok: true, msg: "Fields auto-filled from JSON" });
      } catch {
        setFirebaseResult({ ok: false, msg: "Invalid JSON file" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // For edit modal too
  const handleFirebaseJsonUploadEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setEditForm((prev) => ({
          ...prev,
          firebaseProjectId: json.project_id || prev.firebaseProjectId,
          firebaseClientEmail: json.client_email || prev.firebaseClientEmail,
          firebasePrivateKey: json.private_key || prev.firebasePrivateKey,
        }));
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const sendTestPush = async (appId: string) => {
    setTestPushSending(true);
    setTestPushResult(null);
    try {
      const res = await api.post(`/admin/apps/${appId}/test-push`);
      setTestPushResult({ ok: true, msg: `Sent to ${res.data.sent} device${res.data.sent === 1 ? "" : "s"}.` });
    } catch (err: any) {
      setTestPushResult({ ok: false, msg: err.response?.data?.error || "Send failed" });
    }
    setTestPushSending(false);
  };

  const validateFirebase = async (form: AppForm) => {
    setFirebaseValidating(true);
    try {
      const res = await api.post("/admin/apps/validate-firebase", {
        firebaseProjectId: form.firebaseProjectId,
        firebaseClientEmail: form.firebaseClientEmail,
        firebasePrivateKey: form.firebasePrivateKey,
      });
      setFirebaseResult({ ok: res.data.valid, msg: res.data.message });
    } catch (err: any) {
      setFirebaseResult({ ok: false, msg: err.response?.data?.error || "Validation failed" });
    }
    setFirebaseValidating(false);
  };

  const testSmtp = async (form: AppForm) => {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      // We can only test after app is created. For wizard, show format validation
      if (!form.smtpHost || !form.smtpPort) {
        setSmtpTestResult({ ok: false, msg: "SMTP host and port are required" });
        setSmtpTesting(false);
        return;
      }
      setSmtpTestResult({ ok: true, msg: "SMTP settings look valid. You can send a test email after creating the app." });
    } catch {
      setSmtpTestResult({ ok: false, msg: "Validation failed" });
    }
    setSmtpTesting(false);
  };

  const applySmtpPreset = (presetLabel: string, setter: (fn: (prev: AppForm) => AppForm) => void) => {
    const preset = smtpPresets.find((p) => p.label === presetLabel);
    if (preset) {
      setter((prev) => ({ ...prev, smtpHost: preset.host, smtpPort: preset.port, smtpUser: preset.user || prev.smtpUser }));
    }
  };

  // Edit modal
  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editApp) return;
    setSaving(true);
    await Promise.all([
      api.patch(`/admin/apps/${editApp.id}`, { ...editForm, smtpPort: editForm.smtpPort ? parseInt(editForm.smtpPort) : undefined }),
      api.put(`/admin/apps/${editApp.id}/admins`, { adminIds: selectedAdminIds }),
    ]);
    setSaving(false);
    setEditApp(null);
    fetchApps();
  };

  // Settings editing moved to the per-app detail page (/apps/:id). The
  // modal JSX below is still mounted but unreachable — editApp stays null.
  // Kept as a quick-rollback escape hatch; safe to delete in a future pass.

  const uploadIcon = async (appId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/admin/apps/${appId}/icon`, formData, { headers: { "Content-Type": "multipart/form-data" } });
    fetchApps();
  };

  const regenerateKey = async (appId: string) => {
    setRegenerating(true);
    await api.post(`/admin/apps/${appId}/regenerate-key`);
    setRegenerating(false);
    setRegenConfirm(null);
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

  // Setup progress badge with tooltip
  const SetupRing = ({ app }: { app: App }) => {
    const { checks, pct, done, total } = getSetupScore(app);
    const color = pct === 100 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-500";
    const bg = pct === 100 ? "bg-emerald-50 ring-emerald-200" : pct >= 60 ? "bg-amber-50 ring-amber-200" : "bg-red-50 ring-red-200";
    const barColor = pct === 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
    const tipBg = pct === 100 ? "bg-emerald-50 border-emerald-200" : pct >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
    return (
      <div className="group relative cursor-pointer">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ring-1 ${bg}`}>
          {pct === 100
            ? <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            : <div className="w-8 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
              </div>}
          <span className={`text-[11px] font-semibold ${color}`}>{done}/{total}</span>
        </div>
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
          <div className={`rounded-xl border px-4 py-3 shadow-lg min-w-[200px] ${tipBg}`}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold text-gray-800">Setup Progress</p>
              <span className={`text-[11px] font-bold ${color}`}>{pct}%</span>
            </div>
            <div className="space-y-1.5">
              {checks.map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  {c.done
                    ? <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      </div>
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                  <span className={`text-xs ${c.done ? "text-gray-700 font-medium" : "text-gray-400"}`}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Input class helper
  const inputCls = "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";

  // Render wizard step content
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 0: // Basics
        return (
          <div className="space-y-4">
            {cloneSource && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                Cloned from <strong>{cloneSource}</strong> — shared settings pre-filled. Update name and bundle ID.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">App Name *</label>
              <input type="text" value={newApp.name} onChange={(e) => setNewApp({ ...newApp, name: e.target.value })}
                required placeholder="e.g., ShopEase" autoFocus className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={newApp.description} onChange={(e) => setNewApp({ ...newApp, description: e.target.value })}
                placeholder="Brief description of the app" rows={2} className={`${inputCls} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform</label>
                <select value={newApp.platform} onChange={(e) => setNewApp({ ...newApp, platform: e.target.value })}
                  className={`${inputCls} bg-white`}>
                  {platformOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bundle ID</label>
                <input type="text" value={newApp.bundleId} onChange={(e) => setNewApp({ ...newApp, bundleId: e.target.value })}
                  placeholder="com.example.app" className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>
        );

      case 1: // Auth
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <strong>Tip:</strong> Use the <strong>Web</strong> Client ID here, not the Android/iOS one. In your mobile app, pass this as the <code className="bg-blue-100 px-1 rounded">serverClientId</code>. The server verifies tokens against this ID.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Google Client ID <span className="font-normal text-gray-400">(Web type)</span></label>
              <input type="text" value={newApp.googleClientId}
                onChange={(e) => {
                  setNewApp({ ...newApp, googleClientId: e.target.value });
                  setGoogleIdError(validateGoogleClientId(e.target.value));
                }}
                placeholder="your-client-id.apps.googleusercontent.com"
                className={`${inputCls} font-mono ${googleIdError ? "border-red-300 focus:ring-red-500/20 focus:border-red-400" : ""}`} />
              {googleIdError && <p className="text-xs text-red-500 mt-1">{googleIdError}</p>}
              {newApp.googleClientId && !googleIdError && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Valid format
                </p>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Don't have a Client ID? <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Create one in Google Cloud Console</a></p>
              <p>1. Go to Credentials &rarr; Create Credentials &rarr; OAuth client ID</p>
              <p>2. Select <strong>Web application</strong> type</p>
              <p>3. Copy the Client ID</p>
            </div>
          </div>
        );

      case 2: // Email
        return (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
              Optional — configure a sender email so notifications come from the right address. SMTP settings override the global defaults.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Email</label>
                <input type="email" value={newApp.emailFrom} onChange={(e) => setNewApp({ ...newApp, emailFrom: e.target.value })}
                  placeholder="support@yourapp.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Name</label>
                <input type="text" value={newApp.emailName} onChange={(e) => setNewApp({ ...newApp, emailName: e.target.value })}
                  placeholder="ShopEase Support" className={inputCls} />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">SMTP Settings</p>
                <select
                  onChange={(e) => applySmtpPreset(e.target.value, setNewApp)}
                  className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none"
                  defaultValue="">
                  <option value="" disabled>Quick fill...</option>
                  {smtpPresets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Host</label>
                  <input type="text" value={newApp.smtpHost} onChange={(e) => setNewApp({ ...newApp, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Port</label>
                  <input type="number" value={newApp.smtpPort} onChange={(e) => setNewApp({ ...newApp, smtpPort: e.target.value })}
                    placeholder="587" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP User</label>
                  <input type="text" value={newApp.smtpUser} onChange={(e) => setNewApp({ ...newApp, smtpUser: e.target.value })}
                    placeholder="user@gmail.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Password</label>
                  <input type="password" value={newApp.smtpPass} onChange={(e) => setNewApp({ ...newApp, smtpPass: e.target.value })}
                    placeholder="app-password" className={inputCls} />
                </div>
              </div>
              {(newApp.smtpHost || newApp.smtpPort) && (
                <button type="button" onClick={() => testSmtp(newApp)} disabled={smtpTesting}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
                  {smtpTesting ? "Checking..." : "Validate SMTP settings"}
                </button>
              )}
              {smtpTestResult && (
                <p className={`text-xs mt-1 ${smtpTestResult.ok ? "text-emerald-600" : "text-red-500"}`}>{smtpTestResult.msg}</p>
              )}
            </div>
          </div>
        );

      case 3: // Firebase / FCM
        return (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
              Optional — configure Firebase for push notifications. Upload the service account JSON or fill fields manually.
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload JSON
                <input type="file" accept=".json" className="hidden" onChange={handleFirebaseJsonUpload} />
              </label>
              <span className="text-xs text-gray-400">or fill manually below</span>
            </div>
            {firebaseResult && (
              <p className={`text-xs ${firebaseResult.ok ? "text-emerald-600" : "text-red-500"} flex items-center gap-1`}>
                {firebaseResult.ok
                  ? <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
                {firebaseResult.msg}
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Firebase Project ID</label>
                <input type="text" value={newApp.firebaseProjectId} onChange={(e) => setNewApp({ ...newApp, firebaseProjectId: e.target.value })}
                  placeholder="my-app-12345" className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Firebase Client Email</label>
                <input type="text" value={newApp.firebaseClientEmail} onChange={(e) => setNewApp({ ...newApp, firebaseClientEmail: e.target.value })}
                  placeholder="firebase-adminsdk-xxx@my-app.iam.gserviceaccount.com"
                  className={`${inputCls} font-mono text-xs`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Firebase Private Key</label>
                <textarea value={newApp.firebasePrivateKey} onChange={(e) => setNewApp({ ...newApp, firebasePrivateKey: e.target.value })}
                  placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                  rows={3} className={`${inputCls} font-mono text-xs resize-none`} />
              </div>
            </div>
            {newApp.firebaseProjectId && newApp.firebaseClientEmail && newApp.firebasePrivateKey && (
              <button type="button" onClick={() => validateFirebase(newApp)} disabled={firebaseValidating}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">
                {firebaseValidating ? "Validating..." : "Validate credentials"}
              </button>
            )}
          </div>
        );

      case 4: // Admins
        return (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
              Assign admins who will be responsible for tickets and feedback from this app. Regular admins only see apps they're assigned to.
            </div>
            {allAdmins.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Loading admins...</p>
            ) : (
              <div className="space-y-2">
                {allAdmins.map((admin) => {
                  const selected = wizardAdminIds.includes(admin.id);
                  return (
                    <button key={admin.id} type="button"
                      onClick={() => setWizardAdminIds(selected ? wizardAdminIds.filter((id) => id !== admin.id) : [...wizardAdminIds, admin.id])}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${selected ? "bg-blue-50 border-blue-300 ring-1 ring-blue-200" : "bg-white border-gray-200 hover:border-gray-300"}`}>
                      <Avatar name={admin.name} avatarUrl={admin.avatarUrl} size={32} />
                      <span className="text-sm font-medium text-gray-900 flex-1">{admin.name}</span>
                      {selected && (
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 5: // Done / Post-creation onboarding
        if (!createdApp) return null;
        return (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{createdApp.name} is ready!</h3>
              <p className="text-sm text-gray-500 mt-1">Use the API key below in your {platformOptions.find((p) => p.value === (createdApp.platform || ""))?.label || "app"} to connect.</p>
            </div>

            {/* API Key */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">API Key</label>
              <div className="flex items-center gap-2">
                <code className="bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm flex-1 font-mono text-gray-700 select-all overflow-x-auto">
                  {createdApp.apiKey}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(createdApp.apiKey); setCopiedSnippet(true); setTimeout(() => setCopiedSnippet(false), 2000); }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${copiedSnippet ? "bg-emerald-100 text-emerald-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                  {copiedSnippet ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Code Snippet */}
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Quick Start</label>
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {getCodeSnippet(createdApp.platform || "", createdApp.apiKey)}
              </pre>
            </div>

            {/* Setup checklist */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
              <p className="font-semibold mb-2">Next steps:</p>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <span>{createdApp.googleClientId ? "✓" : "○"}</span>
                  <span className={createdApp.googleClientId ? "line-through opacity-60" : ""}>Configure Google Client ID for authentication</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>{createdApp.firebaseProjectId ? "✓" : "○"}</span>
                  <span className={createdApp.firebaseProjectId ? "line-through opacity-60" : ""}>Set up Firebase for push notifications</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>○</span>
                  <span>Add <code className="bg-amber-100 px-1 rounded">google-services.json</code> to your app</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>○</span>
                  <span>Test: Sign in → Create ticket → Submit feedback</span>
                </li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
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
        <div className="flex items-center gap-2">
          {apps.length > 0 && (
            <div className="relative group">
              <button className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                Clone
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 hidden group-hover:block z-20 min-w-[180px]">
                {apps.map((a) => (
                  <button key={a.id} onClick={() => openWizard(a.id)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <AppIcon app={a} size={20} />
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => openWizard()}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Register App
          </button>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="mb-6">
        <button onClick={() => setShowGuide(!showGuide)}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
          <svg className={`w-4 h-4 transition-transform ${showGuide ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          How to configure app settings
        </button>
        {showGuide && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-gray-700 space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Google Client ID (Web type)</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console &rarr; Credentials</a></li>
                <li>Select the project for your app (or create one)</li>
                <li>Under <strong>OAuth 2.0 Client IDs</strong>, find the <strong>Web application</strong> type client</li>
                <li>If you don't have one, click <strong>Create Credentials &rarr; OAuth client ID &rarr; Web application</strong></li>
                <li>Copy the <strong>Client ID</strong> (ends with <code className="bg-blue-100 px-1 rounded">.apps.googleusercontent.com</code>)</li>
              </ol>
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Important:</strong> Use the <strong>Web</strong> client ID here, not the Android/iOS one. In your mobile app, pass this as the <code className="bg-amber-100 px-1 rounded">serverClientId</code> (Flutter: <code className="bg-amber-100 px-1 rounded">GoogleSignIn(serverClientId: '...')</code>). The Android/iOS client IDs are only used by the mobile app locally — the server verifies tokens against the Web client ID.
              </div>
              <p className="mt-1 text-gray-500">Each app published under a different Google account needs its own Web Client ID.</p>
            </div>
            <div className="border-t border-blue-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">Bundle ID / Package Name</h4>
              <p className="text-gray-600">
                <strong>Android:</strong> Find in <code className="bg-blue-100 px-1 rounded">android/app/build.gradle</code> &rarr; <code className="bg-blue-100 px-1 rounded">applicationId</code> (e.g. <code className="bg-blue-100 px-1 rounded">com.example.myapp</code>)<br />
                <strong>iOS:</strong> Find in Xcode &rarr; Target &rarr; General &rarr; <strong>Bundle Identifier</strong><br />
                <strong>Flutter:</strong> Same as Android <code className="bg-blue-100 px-1 rounded">applicationId</code>, or check <code className="bg-blue-100 px-1 rounded">pubspec.yaml</code>
              </p>
            </div>
            <div className="border-t border-blue-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">API Key</h4>
              <p className="text-gray-600">
                Auto-generated when you register an app. Use this key in your mobile app's <code className="bg-blue-100 px-1 rounded">x-api-key</code> header for all API requests.
                You can regenerate it anytime (the old key will stop working immediately).
              </p>
            </div>
            <div className="border-t border-blue-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">Email Settings (optional)</h4>
              <p className="text-gray-600 mb-2">
                Configure per-app sender email so notifications come from the right address (e.g. <code className="bg-blue-100 px-1 rounded">support@shopease.com</code> instead of a generic address).
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li><strong>Sender Email / Name:</strong> The "From" address and display name for outgoing emails</li>
                <li><strong>SMTP Settings:</strong> Only needed if this app uses a different mail server than the global default</li>
              </ul>
            </div>
            <div className="border-t border-blue-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">SMTP Settings (optional)</h4>
              <p className="text-gray-600 mb-2">
                If left empty, the global SMTP server is used. To use a separate mail server for this app:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li><strong>Gmail:</strong> Host: <code className="bg-blue-100 px-1 rounded">smtp.gmail.com</code>, Port: <code className="bg-blue-100 px-1 rounded">587</code>, use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">App Password</a></li>
                <li><strong>Outlook:</strong> Host: <code className="bg-blue-100 px-1 rounded">smtp-mail.outlook.com</code>, Port: <code className="bg-blue-100 px-1 rounded">587</code></li>
                <li><strong>Custom domain:</strong> Host: <code className="bg-blue-100 px-1 rounded">mail.yourdomain.com</code>, Port: <code className="bg-blue-100 px-1 rounded">587</code> (TLS) or <code className="bg-blue-100 px-1 rounded">465</code> (SSL)</li>
              </ul>
            </div>
            <div className="border-t border-blue-200 pt-4">
              <h4 className="font-semibold text-gray-900 mb-1">Firebase / FCM (Push Notifications)</h4>
              <p className="text-gray-600 mb-2">To send push notifications to app users, configure Firebase for each app:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase Console</a> and select your project</li>
                <li>Go to <strong>Project Settings &rarr; Service accounts</strong></li>
                <li>Click <strong>Generate new private key</strong> to download the JSON file</li>
                <li>From the JSON file, copy: <code className="bg-blue-100 px-1 rounded">project_id</code>, <code className="bg-blue-100 px-1 rounded">client_email</code>, and <code className="bg-blue-100 px-1 rounded">private_key</code></li>
                <li>Paste them into the Firebase fields when editing the app</li>
              </ol>
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Important:</strong> Keep the private key secret. Each app on a different Firebase project needs its own service account credentials.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search — only surfaced once the user has enough apps that scanning
          the list gets cumbersome. */}
      {apps.length > 3 && (
        <div className="mb-4">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search apps by name, description, or bundle ID…"
          />
        </div>
      )}

      {/* Apps Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {apps
          .filter((app) => {
            // Case-insensitive match against name, description, and bundle ID.
            // Using a short-circuit so empty query returns everything without
            // allocating a lowercase string per row.
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              app.name.toLowerCase().includes(q) ||
              (app.description?.toLowerCase().includes(q) ?? false) ||
              (app.bundleId?.toLowerCase().includes(q) ?? false)
            );
          })
          .map((app) => (
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
                    <Link
                      to={`/apps/${app.id}`}
                      className="font-semibold text-gray-900 hover:text-blue-600 truncate"
                    >
                      {app.name}
                    </Link>
                    {!app.isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{app.description || "No description"}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <SetupRing app={app} />
                  <Link
                    to={`/apps/${app.id}`}
                    title="Open details"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
                    </svg>
                  </Link>
                </div>
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

              {/* Assigned Admins */}
              {app.admins && app.admins.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assignees</span>
                  <div className="flex items-center">
                    {app.admins.slice(0, 5).map((admin, i) => (
                      <div key={admin.id} className="ring-2 ring-white rounded-full" style={{ marginLeft: i === 0 ? 0 : -6 }}>
                        <Avatar name={admin.name} avatarUrl={admin.avatarUrl} size={22} />
                      </div>
                    ))}
                    {app.admins.length > 5 && (
                      <div className="w-[22px] h-[22px] rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-600 ring-2 ring-white" style={{ marginLeft: -6 }}>
                        +{app.admins.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                <Link
                  to={`/apps/${app.id}`}
                  className="px-3 py-1 rounded-lg text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  View details →
                </Link>
                <button onClick={() => openWizard(app.id)} title="Clone app"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                </button>
                <button onClick={() => setRegenConfirm(app.id)} title="Regenerate API key"
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

        {apps.length > 0 && searchQuery.trim() && apps.filter((a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (a.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
          (a.bundleId?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
        ).length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">No apps match <span className="font-medium text-gray-700">"{searchQuery}"</span>.</p>
            <button onClick={() => setSearchQuery("")} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">Clear search</button>
          </div>
        )}

        {apps.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75l-5.571-3m11.142 0l4.179 2.25L12 17.25l-9.75-5.25 4.179-2.25m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" />
            </svg>
            <p className="text-gray-500 font-medium">No apps registered yet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">Register your first app to get started</p>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Register your first app
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/*  CREATE WIZARD MODAL                           */}
      {/* ═══════════════════════════════════════════════ */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closeWizard}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {wizardStep === 5 ? "App Created" : cloneSource ? `Clone from ${cloneSource}` : "Register New App"}
              </h2>
              <button onClick={closeWizard} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Stepper bar */}
            {wizardStep < 5 && (
              <div className="px-6 pt-4 pb-2 flex-shrink-0">
                <div className="flex items-center gap-1">
                  {WIZARD_STEPS.map((step, i) => (
                    <div key={i} className="flex items-center flex-1">
                      <button
                        type="button"
                        onClick={() => { if (i < wizardStep) setWizardStep(i); }}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          i === wizardStep ? "text-blue-600" : i < wizardStep ? "text-emerald-600 cursor-pointer hover:text-emerald-700" : "text-gray-400"
                        }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                          i === wizardStep ? "border-blue-600 bg-blue-600 text-white"
                          : i < wizardStep ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300 text-gray-400"
                        }`}>
                          {i < wizardStep ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : i + 1}
                        </div>
                        <span className="hidden sm:inline">{step.label}</span>
                      </button>
                      {i < WIZARD_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-2 rounded ${i < wizardStep ? "bg-emerald-400" : "bg-gray-200"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step content */}
            <div className="p-6 overflow-y-auto flex-1">
              {renderWizardStep()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
              {wizardStep === 5 ? (
                <div className="flex justify-end w-full">
                  <button onClick={closeWizard}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    {wizardStep > 0 && (
                      <button type="button" onClick={() => setWizardStep(wizardStep - 1)}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                        Back
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {wizardStep > 0 && wizardStep < 4 && (
                      <button type="button" onClick={() => setWizardStep(wizardStep + 1)}
                        className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                        Skip
                      </button>
                    )}
                    {wizardStep < 4 ? (
                      <button type="button"
                        onClick={() => setWizardStep(wizardStep + 1)}
                        disabled={wizardStep === 0 && !newApp.name.trim()}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                        Next
                      </button>
                    ) : (
                      <button type="button" onClick={createApp} disabled={creating || !newApp.name.trim()}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                        {creating ? "Creating..." : "Register App"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/*  EDIT MODAL                                    */}
      {/* ═══════════════════════════════════════════════ */}
      {editApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditApp(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Edit App</h2>
              <button onClick={() => setEditApp(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">App Name *</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required autoFocus className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Brief description" rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform</label>
                  <select value={editForm.platform} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })}
                    className={`${inputCls} bg-white`}>
                    {platformOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bundle ID</label>
                  <input type="text" value={editForm.bundleId} onChange={(e) => setEditForm({ ...editForm, bundleId: e.target.value })}
                    placeholder="com.example.app" className={`${inputCls} font-mono`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Google Client ID <span className="font-normal text-gray-400">(Web type)</span></label>
                <input type="text" value={editForm.googleClientId} onChange={(e) => setEditForm({ ...editForm, googleClientId: e.target.value })}
                  placeholder="your-client-id.apps.googleusercontent.com" className={`${inputCls} font-mono`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Email</label>
                  <input type="email" value={editForm.emailFrom} onChange={(e) => setEditForm({ ...editForm, emailFrom: e.target.value })}
                    placeholder="support@yourapp.com" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender Name</label>
                  <input type="text" value={editForm.emailName} onChange={(e) => setEditForm({ ...editForm, emailName: e.target.value })}
                    placeholder="ShopEase Support" className={inputCls} />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">SMTP Settings (optional)</p>
                  <select
                    onChange={(e) => applySmtpPreset(e.target.value, setEditForm)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none"
                    defaultValue="">
                    <option value="" disabled>Quick fill...</option>
                    {smtpPresets.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Host</label>
                    <input type="text" value={editForm.smtpHost} onChange={(e) => setEditForm({ ...editForm, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Port</label>
                    <input type="number" value={editForm.smtpPort} onChange={(e) => setEditForm({ ...editForm, smtpPort: e.target.value })}
                      placeholder="587" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP User</label>
                    <input type="text" value={editForm.smtpUser} onChange={(e) => setEditForm({ ...editForm, smtpUser: e.target.value })}
                      placeholder="user@gmail.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">SMTP Password</label>
                    <input type="password" value={editForm.smtpPass} onChange={(e) => setEditForm({ ...editForm, smtpPass: e.target.value })}
                      placeholder="app-password" className={inputCls} />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Firebase / FCM (optional)</p>
                  <label className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Upload JSON
                    <input type="file" accept=".json" className="hidden" onChange={handleFirebaseJsonUploadEdit} />
                  </label>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Firebase Project ID</label>
                    <input type="text" value={editForm.firebaseProjectId} onChange={(e) => setEditForm({ ...editForm, firebaseProjectId: e.target.value })}
                      placeholder="my-app-12345" className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Firebase Client Email</label>
                    <input type="text" value={editForm.firebaseClientEmail} onChange={(e) => setEditForm({ ...editForm, firebaseClientEmail: e.target.value })}
                      placeholder="firebase-adminsdk-xxx@my-app.iam.gserviceaccount.com"
                      className={`${inputCls} font-mono text-xs`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Firebase Private Key</label>
                    <textarea value={editForm.firebasePrivateKey} onChange={(e) => setEditForm({ ...editForm, firebasePrivateKey: e.target.value })}
                      placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                      rows={3} className={`${inputCls} font-mono text-xs resize-none`} />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => editApp && sendTestPush(editApp.id)}
                      disabled={testPushSending || !editApp}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {testPushSending ? "Sending…" : "Send test push to my device"}
                    </button>
                    {testPushResult && (
                      <span className={`text-xs ${testPushResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                        {testPushResult.msg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Assigned Admins <span className="font-normal normal-case text-gray-400">— responsible for tickets from this app</span></p>
                {allAdmins.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Loading admins...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allAdmins.map((admin) => {
                      const selected = selectedAdminIds.includes(admin.id);
                      return (
                        <button key={admin.id} type="button"
                          onClick={() => setSelectedAdminIds(selected ? selectedAdminIds.filter((id) => id !== admin.id) : [...selectedAdminIds, admin.id])}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>
                          <Avatar name={admin.name} avatarUrl={admin.avatarUrl} size={18} />
                          {admin.name}
                          {selected && (
                            <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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

      {/* Regenerate Key Confirmation */}
      {regenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setRegenConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Regenerate API Key?</h3>
                <p className="text-sm text-gray-500 mt-0.5">The current API key will stop working immediately. All mobile apps using the old key will need to be updated.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRegenConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
              <button onClick={() => regenerateKey(regenConfirm)} disabled={regenerating}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
                {regenerating ? "Regenerating..." : "Regenerate Key"}
              </button>
            </div>
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
