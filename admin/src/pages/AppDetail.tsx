import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Avatar from "../components/Avatar";
import IntegrationGuide from "../components/IntegrationGuide";
import type { App } from "../types";

/**
 * Per-app detail page. Replaces the old edit modal on the Apps list; settings
 * are embedded here (last section). The flow is: admin clicks an app card on
 * /apps → lands here → sees health + metrics + announcements + settings on
 * one scrollable page.
 *
 * Heavy lifting lives on this page because it doubles as the edit surface —
 * keeping it self-contained avoids juggling state across the list + a modal.
 */

const inputCls =
  "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 " +
  "placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 " +
  "focus:bg-white focus:border-blue-300 transition-all";

type Announcement = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
};

type AppStats = {
  tickets: number;
  feedbacks: number;
  openTickets: number;
};

const platformIcon: Record<string, string> = {
  android: "📱",
  ios: "",
  flutter: "🦋",
  web: "🌐",
};

function appIconOrInitial(app: App, size = 64) {
  if (app.iconUrl) {
    return <img src={`/api${app.iconUrl}`} alt={app.name} className="rounded-xl object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {platformIcon[app.platform || ""] || app.name.charAt(0).toUpperCase()}
    </div>
  );
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Editable form state (mirrors the old modal's editForm).
  const [form, setForm] = useState({
    name: "", description: "", platform: "", bundleId: "",
    googleClientId: "", emailFrom: "", emailName: "",
    smtpHost: "", smtpPort: "", smtpUser: "", smtpPass: "",
    firebaseProjectId: "", firebaseClientEmail: "", firebasePrivateKey: "",
  });
  const [allAdmins, setAllAdmins] = useState<{ id: string; name: string; avatarUrl?: string | null }[]>([]);
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // Live-fetched secondary data.
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);

  // Firebase validate + test push.
  const [fbValidating, setFbValidating] = useState(false);
  const [fbResult, setFbResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testPushSending, setTestPushSending] = useState(false);
  const [testPushResult, setTestPushResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Announcement composer (inline at the top of its section).
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceLink, setAnnounceLink] = useState("");
  const [announcing, setAnnouncing] = useState(false);
  const [announceResult, setAnnounceResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Destructive confirmations.
  const [copiedKey, setCopiedKey] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Inline name edit — the header name becomes an input on click.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);

  useEffect(() => {
    if (!id) return;
    load();
    // The admins list and announcements are independent; fetch in parallel.
    api.get("/admin/admins").then((r) => setAllAdmins(r.data)).catch(() => {});
    refreshAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const [appRes, analyticsRes] = await Promise.all([
        api.get(`/admin/apps/${id}`),
        api.get("/admin/analytics").catch(() => ({ data: null })),
      ]);
      const a: App = appRes.data;
      setApp(a);
      setForm({
        name: a.name || "",
        description: a.description || "",
        platform: a.platform || "",
        bundleId: a.bundleId || "",
        googleClientId: a.googleClientId || "",
        emailFrom: a.emailFrom || "",
        emailName: a.emailName || "",
        smtpHost: a.smtpHost || "",
        smtpPort: a.smtpPort ? String(a.smtpPort) : "",
        smtpUser: a.smtpUser || "",
        smtpPass: a.smtpPass || "",
        firebaseProjectId: a.firebaseProjectId || "",
        firebaseClientEmail: a.firebaseClientEmail || "",
        firebasePrivateKey: a.firebasePrivateKey || "",
      });
      setSelectedAdminIds((a.admins || []).map((x) => x.id));

      // Derive per-app stats from the global analytics payload if present.
      // This is approximate — a dedicated /admin/apps/:id/stats route would be
      // cleaner but isn't needed for a first pass.
      if (analyticsRes.data && a._count) {
        const perApp = analyticsRes.data.ticketsByApp?.find((x: any) => x.appId === a.id);
        setStats({
          tickets: a._count.tickets,
          feedbacks: a._count.feedbacks,
          openTickets: perApp?.openCount ?? 0,
        });
      } else if (a._count) {
        setStats({ tickets: a._count.tickets, feedbacks: a._count.feedbacks, openTickets: 0 });
      }
    } catch (err: any) {
      if (err?.response?.status === 404) setNotFound(true);
    }
    setLoading(false);
  };

  const refreshAnnouncements = async () => {
    try {
      const r = await api.get(`/admin/apps/${id}/announcements`);
      setAnnouncements(r.data || []);
    } catch { /* non-fatal */ }
  };

  // ---- Setup checklist (five buckets, matching the list page) ----
  // Exposed as data so the sidebar can render both the score and a per-row
  // "missing" indicator.
  const setupRows = app ? [
    { key: "basics", label: "Basics", done: !!app.name },
    { key: "auth", label: "Google Sign-In", done: !!app.googleClientId },
    { key: "email", label: "Email sender", done: !!(app.emailFrom || app.smtpHost) },
    { key: "fcm", label: "Push (Firebase)", done: !!(app.firebaseProjectId && app.firebaseClientEmail && app.firebasePrivateKey) },
    { key: "admins", label: "Assigned admins", done: (app.admins?.length ?? 0) > 0 },
  ] : [];
  const setupDone = setupRows.filter((r) => r.done).length;
  const setupTotal = setupRows.length;
  const setupPct = setupTotal === 0 ? 0 : Math.round((setupDone / setupTotal) * 100);

  const firebaseOk = !!(app?.firebaseProjectId && app?.firebaseClientEmail && app?.firebasePrivateKey);

  // ---- Save / delete / regenerate ----
  const save = async () => {
    if (!id) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await Promise.all([
        api.patch(`/admin/apps/${id}`, {
          ...form,
          smtpPort: form.smtpPort ? parseInt(form.smtpPort) : undefined,
        }),
        api.put(`/admin/apps/${id}/admins`, { adminIds: selectedAdminIds }),
      ]);
      setSaveMsg({ ok: true, msg: "Saved" });
      await load();
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (err: any) {
      setSaveMsg({ ok: false, msg: err?.response?.data?.error || "Save failed" });
    }
    setSaving(false);
  };

  const regenerateKey = async () => {
    if (!id) return;
    try {
      await api.post(`/admin/apps/${id}/regenerate-key`);
      setRegenConfirm(false);
      await load();
    } catch { /* surface via toast if we had one */ }
  };

  const deleteApp = async () => {
    if (!id) return;
    try {
      await api.delete(`/admin/apps/${id}`);
      navigate("/apps");
    } catch { /* inline message would go here */ }
  };

  const startEditName = () => {
    if (!app) return;
    setNameDraft(app.name);
    setEditingName(true);
  };

  const saveName = async () => {
    if (!app || !id) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === app.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await api.patch(`/admin/apps/${id}`, { name: trimmed });
      setEditingName(false);
      // Reflect the change in the form too so a follow-up Save doesn't
      // silently revert it.
      setForm((f) => ({ ...f, name: trimmed }));
      await load();
    } catch {
      /* leave input open so the user can retry */
    }
    setSavingName(false);
  };

  const uploadIcon = async (file: File) => {
    if (!app) return;
    setUploadingIcon(true);
    try {
      const data = new FormData();
      data.append("file", file);
      await api.post(`/admin/apps/${app.id}/icon`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await load();
    } catch {
      /* swallow — could surface a toast */
    }
    setUploadingIcon(false);
  };

  const toggleActive = async () => {
    if (!app) return;
    try {
      await api.patch(`/admin/apps/${app.id}`, { isActive: !app.isActive });
      await load();
    } catch { /* ignore */ }
  };

  // ---- Firebase validate / test push ----
  const validateFirebase = async () => {
    setFbValidating(true);
    setFbResult(null);
    try {
      const res = await api.post("/admin/apps/validate-firebase", {
        firebaseProjectId: form.firebaseProjectId,
        firebaseClientEmail: form.firebaseClientEmail,
        firebasePrivateKey: form.firebasePrivateKey,
      });
      setFbResult({ ok: res.data.valid, msg: res.data.message });
    } catch (err: any) {
      setFbResult({ ok: false, msg: err.response?.data?.error || "Validation failed" });
    }
    setFbValidating(false);
  };

  const sendTestPush = async () => {
    if (!app) return;
    setTestPushSending(true);
    setTestPushResult(null);
    try {
      const res = await api.post(`/admin/apps/${app.id}/test-push`);
      setTestPushResult({ ok: true, msg: `Sent to ${res.data.sent} device${res.data.sent === 1 ? "" : "s"}.` });
    } catch (err: any) {
      setTestPushResult({ ok: false, msg: err.response?.data?.error || "Send failed" });
    }
    setTestPushSending(false);
  };

  const sendAnnouncement = async () => {
    if (!id) return;
    if (!announceTitle.trim() || !announceBody.trim()) return;
    setAnnouncing(true);
    setAnnounceResult(null);
    try {
      await api.post(`/admin/apps/${id}/announcements`, {
        title: announceTitle.trim(),
        body: announceBody.trim(),
        link: announceLink.trim() || undefined,
      });
      setAnnounceTitle("");
      setAnnounceBody("");
      setAnnounceLink("");
      setAnnounceResult({ ok: true, msg: "Announcement sent" });
      refreshAnnouncements();
      setTimeout(() => setAnnounceResult(null), 2000);
    } catch (err: any) {
      setAnnounceResult({ ok: false, msg: err.response?.data?.error || "Failed to send" });
    }
    setAnnouncing(false);
  };

  const deleteAnnouncement = async (aid: string) => {
    try {
      await api.delete(`/admin/announcements/${aid}`);
      setAnnouncements((prev) => prev.filter((x) => x.id !== aid));
    } catch { /* ignore */ }
  };

  const copyKey = () => {
    if (!app) return;
    navigator.clipboard.writeText(app.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  if (notFound || !app) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-gray-900">App not found</h2>
        <Link to="/apps" className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-700">← Back to Apps</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link to="/apps" className="text-gray-500 hover:text-gray-700">Apps</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">{app.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 flex items-start gap-4">
        {/* Photo with hover-overlay upload */}
        <div className="relative group flex-shrink-0">
          {appIconOrInitial(app, 72)}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Change photo"
          >
            {uploadingIcon ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadIcon(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {editingName ? (
              <input
                autoFocus
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  else if (e.key === "Escape") setEditingName(false);
                }}
                disabled={savingName}
                className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-400 focus:outline-none px-0 py-0.5 min-w-0 max-w-full"
              />
            ) : (
              <button
                onClick={startEditName}
                title="Click to rename"
                className="group text-2xl font-bold text-gray-900 truncate hover:text-blue-700 text-left flex items-center gap-1.5"
              >
                <span className="truncate">{app.name}</span>
                <svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
              </button>
            )}
            <button
              onClick={toggleActive}
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                app.isActive
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {app.isActive ? "● Active" : "○ Inactive"}
            </button>
          </div>
          {app.description && <p className="text-sm text-gray-500 mt-1">{app.description}</p>}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {app.platform && (
              <span className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-0.5 capitalize">{app.platform}</span>
            )}
            {app.bundleId && (
              <span className="text-xs text-gray-500 font-mono">{app.bundleId}</span>
            )}
            <span className="text-xs text-gray-400">Created {relTime(app.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <OverviewCard label="Tickets" value={stats?.tickets ?? 0} tint="bg-blue-50 text-blue-700" href={`/tickets?appId=${app.id}`} />
        <OverviewCard label="Open tickets" value={stats?.openTickets ?? 0} tint="bg-amber-50 text-amber-700" href={`/tickets?appId=${app.id}&status=open`} />
        <OverviewCard label="Feedback" value={stats?.feedbacks ?? 0} tint="bg-violet-50 text-violet-700" href={`/feedbacks?appId=${app.id}`} />
        <div className={`bg-white rounded-xl border p-3 ${firebaseOk ? "border-emerald-200" : "border-amber-200"}`}>
          <div className="text-xs text-gray-500 mb-1">Push (Firebase)</div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${firebaseOk ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="text-sm font-semibold text-gray-900">{firebaseOk ? "Configured" : "Not set up"}</span>
          </div>
        </div>
      </div>

      {/* Setup progress banner */}
      {setupPct < 100 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Setup {setupPct}% complete · {setupTotal - setupDone} {setupTotal - setupDone === 1 ? "step" : "steps"} remaining
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {setupRows.filter((r) => !r.done).map((r) => r.label).join(" · ")}
              </p>
            </div>
            <a
              href="#settings"
              className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700"
            >
              Finish setup
            </a>
          </div>
          <div className="mt-3 h-1.5 w-full bg-amber-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-600" style={{ width: `${setupPct}%` }} />
          </div>
        </div>
      )}

      {/* API key */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">API key</h3>
            <p className="text-xs text-gray-500 mt-0.5">Pass this as <code className="bg-gray-100 px-1 rounded">x-api-key</code> in every SDK request.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyKey}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                copiedKey ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {copiedKey ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => setRegenConfirm(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100"
            >
              Regenerate
            </button>
          </div>
        </div>
        <div className="mt-3 font-mono text-xs bg-gray-50 border border-gray-100 rounded px-3 py-2 select-all break-all">
          {app.apiKey}
        </div>
      </div>

      {/* Integration guide */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Integration guide</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Copy-paste setup for this app. Snippets already include the API key and app ID.
          </p>
        </div>
        <IntegrationGuide
          apiKey={app.apiKey}
          appId={app.id}
          defaultPlatform={app.platform}
        />
      </section>

      {/* Announcements */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Announcements</h3>
            <p className="text-xs text-gray-500 mt-0.5">Delivered via FCM topic to every device with this app installed.</p>
          </div>
        </div>

        {/* Inline composer */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <div className="space-y-2">
            <input
              type="text"
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              placeholder="Title"
              maxLength={80}
              className={inputCls}
            />
            <textarea
              value={announceBody}
              onChange={(e) => setAnnounceBody(e.target.value)}
              placeholder="Body"
              rows={2}
              maxLength={240}
              className={`${inputCls} resize-none`}
            />
            <input
              type="text"
              value={announceLink}
              onChange={(e) => setAnnounceLink(e.target.value)}
              placeholder="Link (optional) — /tickets or https://…"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={sendAnnouncement}
              disabled={announcing || !announceTitle.trim() || !announceBody.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {announcing ? "Sending…" : "Send"}
            </button>
            {announceResult && (
              <span className={`text-xs mt-2 ${announceResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                {announceResult.msg}
              </span>
            )}
          </div>
        </div>

        {/* Past announcements */}
        {announcements.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent</div>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div key={a.id} className="flex items-start gap-3 border border-gray-100 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{a.title}</span>
                      <span className="text-xs text-gray-400">{relTime(a.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 break-words">{a.body}</p>
                    {a.link && <p className="text-xs text-blue-600 mt-1 font-mono">{a.link}</p>}
                  </div>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    className="text-xs text-gray-400 hover:text-red-600 flex-shrink-0"
                    title="Delete announcement"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Admins */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Assigned admins <span className="text-gray-400 font-normal">— responsible for tickets & feedback</span>
          </h3>
          <span className="text-xs text-gray-400">{selectedAdminIds.length} / {allAdmins.length}</span>
        </div>
        {allAdmins.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Loading admins…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allAdmins.map((a) => {
              const picked = selectedAdminIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAdminIds(picked ? selectedAdminIds.filter((x) => x !== a.id) : [...selectedAdminIds, a.id])}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    picked ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  <Avatar name={a.name} avatarUrl={a.avatarUrl ?? undefined} size={18} />
                  {a.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Settings (last section) */}
      <section id="settings" className="bg-white rounded-xl border border-gray-200 p-5 mb-4 scroll-mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Settings</h3>
            <p className="text-xs text-gray-500 mt-0.5">Configure how this app authenticates, emails users, and sends push notifications.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="App name" required>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Platform" optional>
            <input type="text" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="android, ios, flutter, web" className={inputCls} />
          </Field>
          <Field label="Description" optional className="md:col-span-2">
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Bundle ID" optional>
            <input type="text" value={form.bundleId} onChange={(e) => setForm({ ...form, bundleId: e.target.value })} placeholder="com.example.app" className={`${inputCls} font-mono text-xs`} />
          </Field>
          <Field label="Google Client ID" required>
            <input type="text" value={form.googleClientId} onChange={(e) => setForm({ ...form, googleClientId: e.target.value })} placeholder="…apps.googleusercontent.com" className={`${inputCls} font-mono text-xs`} />
          </Field>
        </div>

        {/* Email */}
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-3">Email</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Sender email" optional>
            <input type="email" value={form.emailFrom} onChange={(e) => setForm({ ...form, emailFrom: e.target.value })} placeholder="noreply@example.com" className={inputCls} />
          </Field>
          <Field label="Sender name" optional>
            <input type="text" value={form.emailName} onChange={(e) => setForm({ ...form, emailName: e.target.value })} placeholder="Example Support" className={inputCls} />
          </Field>
          <Field label="SMTP host" optional>
            <input type="text" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} placeholder="smtp.gmail.com" className={inputCls} />
          </Field>
          <Field label="SMTP port" optional>
            <input type="text" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: e.target.value })} placeholder="587" className={inputCls} />
          </Field>
          <Field label="SMTP user" optional>
            <input type="text" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} className={inputCls} />
          </Field>
          <Field label="SMTP password" optional>
            <input type="password" value={form.smtpPass} onChange={(e) => setForm({ ...form, smtpPass: e.target.value })} className={inputCls} />
          </Field>
        </div>

        {/* Firebase */}
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-3 flex items-center gap-2">
          <span>Push notifications (Firebase)</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            firebaseOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${firebaseOk ? "bg-emerald-500" : "bg-amber-500"}`} />
            {firebaseOk ? "Configured" : "Not set up"}
          </span>
        </h4>
        <div className="space-y-3">
          <Field label="Firebase Project ID" optional>
            <input type="text" value={form.firebaseProjectId} onChange={(e) => setForm({ ...form, firebaseProjectId: e.target.value })} placeholder="my-app-12345" className={`${inputCls} font-mono text-xs`} />
          </Field>
          <Field label="Firebase Client Email" optional>
            <input type="text" value={form.firebaseClientEmail} onChange={(e) => setForm({ ...form, firebaseClientEmail: e.target.value })} placeholder="firebase-adminsdk-xxx@…" className={`${inputCls} font-mono text-xs`} />
          </Field>
          <Field label="Firebase Private Key" optional>
            <textarea value={form.firebasePrivateKey} onChange={(e) => setForm({ ...form, firebasePrivateKey: e.target.value })} placeholder="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----" rows={3} className={`${inputCls} font-mono text-xs resize-none`} />
          </Field>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={validateFirebase}
              disabled={fbValidating || !form.firebaseProjectId || !form.firebaseClientEmail || !form.firebasePrivateKey}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {fbValidating ? "Validating…" : "Validate credentials"}
            </button>
            <button
              type="button"
              onClick={sendTestPush}
              disabled={testPushSending}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {testPushSending ? "Sending…" : "Send test push to my device"}
            </button>
            {fbResult && (
              <span className={`text-xs ${fbResult.ok ? "text-emerald-600" : "text-red-600"}`}>{fbResult.msg}</span>
            )}
            {testPushResult && (
              <span className={`text-xs ${testPushResult.ok ? "text-emerald-600" : "text-red-600"}`}>{testPushResult.msg}</span>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between gap-3">
          <div>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{saveMsg.msg}</span>
            )}
          </div>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="bg-red-50 border border-red-200 rounded-xl p-5 mb-8">
        <h3 className="text-sm font-semibold text-red-900">Danger zone</h3>
        <p className="text-xs text-red-800 mt-0.5">Deleting an app removes all its tickets, feedback, and announcements. This cannot be undone.</p>
        {deleteConfirm ? (
          <div className="mt-3 flex items-center gap-2">
            <button onClick={deleteApp} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700">Yes, delete app</button>
            <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 bg-white text-red-700 hover:bg-red-50">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setDeleteConfirm(true)} className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 bg-white text-red-700 hover:bg-red-100">
            Delete this app
          </button>
        )}
      </section>

      {/* Regenerate key confirmation */}
      {regenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setRegenConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">Regenerate API key?</h3>
            <p className="text-sm text-gray-600 mt-2">Existing installs will stop working until you push a new build with the new key.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRegenConfirm(false)} className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={regenerateKey} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700">Regenerate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ label, value, tint, href }: { label: string; value: number; tint: string; href?: string }) {
  const content = (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 ${href ? "hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer" : ""}`}>
      <div className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${tint} mb-1`}>{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
  return href ? <Link to={href} className="block">{content}</Link> : content;
}

function Field({ label, required, optional, className, children }: { label: string; required?: boolean; optional?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
