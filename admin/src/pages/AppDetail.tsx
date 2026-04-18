import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api";
import Avatar from "../components/Avatar";
import SettingsHelp from "../components/SettingsHelp";
import { useCountUp } from "../hooks/useCountUp";
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

type TabKey = "overview" | "announcements" | "settings";
const TAB_KEYS: TabKey[] = ["overview", "announcements", "settings"];

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabKey = (TAB_KEYS as string[]).includes(searchParams.get("tab") || "")
    ? (searchParams.get("tab") as TabKey)
    : "overview";
  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(searchParams);
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

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

  const [showSettingsHelp, setShowSettingsHelp] = useState(false);

  // Flip true once the initial fetch resolves — gates the count-up animation
  // so numbers don't flash at 0 while the skeleton is visible.
  const [animated, setAnimated] = useState(false);
  const animTickets = useCountUp(stats?.tickets ?? 0, 700, animated);
  const animOpen = useCountUp(stats?.openTickets ?? 0, 700, animated);
  const animFeedback = useCountUp(stats?.feedbacks ?? 0, 700, animated);

  // Floating success toast (shown briefly after Save completes).
  const [saveToastKey, setSaveToastKey] = useState(0);

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
    // Next frame so the DOM has painted the real values before count-up runs.
    requestAnimationFrame(() => setAnimated(true));
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
      setSaveToastKey((k) => k + 1); // re-triggers the floating toast animation
      await load();
      setTimeout(() => setSaveMsg(null), 2400);
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

  // Skeleton while the initial fetch resolves. Mirrors the real layout so the
  // page doesn't jump when content appears.
  if (loading) {
    return (
      <div className="max-w-7xl animate-fade-in">
        <div className="sdk-skeleton h-4 w-40 mb-4" />
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 flex items-start gap-4">
          <div className="sdk-skeleton w-[72px] h-[72px] rounded-xl" />
          <div className="flex-1 space-y-2 py-1">
            <div className="sdk-skeleton h-6 w-64" />
            <div className="sdk-skeleton h-3 w-96 max-w-full" />
            <div className="sdk-skeleton h-3 w-40 mt-3" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="sdk-skeleton h-3 w-20 mb-2" />
              <div className="sdk-skeleton h-7 w-12" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="sdk-skeleton h-4 w-20 mb-3" />
          <div className="sdk-skeleton h-8 w-full" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="sdk-skeleton h-4 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="sdk-skeleton h-3 w-24 mb-1.5" />
                <div className="sdk-skeleton h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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

      {/* Header — subtle radial wash on top-left for identity, still white at the form edge. */}
      <div className="relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 mb-4 flex items-start gap-4 animate-fade-in-up">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-16 w-80 h-80 rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(closest-side, #2563eb, transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -right-16 w-80 h-80 rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(closest-side, #7c3aed, transparent)" }}
        />
        {/* Photo with hover-overlay upload */}
        <div className="relative z-10 group flex-shrink-0">
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

        <div className="relative z-10 flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            {app.isActive && (
              <span className="relative flex h-2 w-2" title="Active" aria-label="Active">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
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
                className="text-3xl font-bold tracking-tight text-gray-900 bg-transparent border-b-2 border-blue-400 focus:outline-none px-0 py-0.5 min-w-0 max-w-full"
              />
            ) : (
              <button
                onClick={startEditName}
                title="Click to rename"
                className="group text-3xl font-bold tracking-tight text-gray-900 truncate hover:text-blue-700 text-left flex items-center gap-1.5 transition-colors"
              >
                <span className="truncate">{app.name}</span>
                <svg className="w-5 h-5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200 flex items-end gap-1 animate-fade-in-up [animation-delay:40ms]">
        {(
          [
            { key: "overview", label: "Overview", badge: undefined, badgeTint: undefined },
            { key: "announcements", label: "Announcements", badge: announcements.length, badgeTint: undefined },
            { key: "settings", label: "Settings", badge: setupPct < 100 ? setupTotal - setupDone : undefined, badgeTint: "amber" },
          ] as { key: TabKey; label: string; badge: number | undefined; badgeTint: "amber" | undefined }[]
        ).map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                active ? "text-blue-700" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full ${
                    t.badgeTint === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : active
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    {t.badge}
                  </span>
                )}
              </span>
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-blue-600 rounded-t" />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
      <>
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 animate-fade-in-up [animation-delay:80ms]">
        <OverviewCard label="Tickets" value={animTickets} tint="bg-blue-50 text-blue-700" href={`/tickets?appId=${app.id}`} />
        <OverviewCard label="Open tickets" value={animOpen} tint="bg-amber-50 text-amber-700" href={`/tickets?appId=${app.id}&status=open`} />
        <OverviewCard label="Feedback" value={animFeedback} tint="bg-violet-50 text-violet-700" href={`/feedbacks?appId=${app.id}`} />
        <div className={`bg-white rounded-xl border p-3 transition-colors ${firebaseOk ? "border-emerald-200" : "border-amber-200"}`}>
          <div className="text-xs text-gray-500 mb-1">Push (Firebase)</div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${firebaseOk ? "bg-emerald-500" : "bg-amber-500 animate-soft-pulse"}`} />
            <span className="text-sm font-semibold text-gray-900">{firebaseOk ? "Configured" : "Not set up"}</span>
          </div>
        </div>
      </div>

      {/* Setup progress banner */}
      {setupPct < 100 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 animate-fade-in-up [animation-delay:160ms]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Setup {setupPct}% complete · {setupTotal - setupDone} {setupTotal - setupDone === 1 ? "step" : "steps"} remaining
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {setupRows.filter((r) => !r.done).map((r) => r.label).join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab("settings")}
              className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-transform active:scale-95"
            >
              Finish setup
            </button>
          </div>
          <div className="mt-3 h-1.5 w-full bg-amber-200 rounded-full overflow-hidden">
            {/* Animated fill: starts at 0, slides to setupPct over 900ms once
                the page has loaded. key on animated so it restarts on refetch. */}
            <div
              key={animated ? "done" : "idle"}
              className="h-full bg-amber-600 transition-[width] duration-[900ms] ease-out"
              style={{ width: animated ? `${setupPct}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {/* API key */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 animate-fade-in-up [animation-delay:240ms]">
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

      {/* Admins (overview tab) */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4 animate-fade-in-up [animation-delay:320ms]">
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
                  className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 active:scale-95 ${
                    picked
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  <Avatar name={a.name} avatarUrl={a.avatarUrl ?? undefined} size={18} />
                  {a.name}
                  {picked && (
                    <svg className="w-3 h-3 animate-fade-in" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-transform active:scale-95"
          >
            {saving ? "Saving…" : "Save assignments"}
          </button>
        </div>
      </section>
      </>
      )}

      {activeTab === "announcements" && (
      <>
      {/* Composer + live device preview side-by-side. The preview gives the
          admin instant feedback on what the push will look like on a phone —
          pure visual, wired directly to the current input state. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-4 animate-fade-in-up">
        {/* Composer */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-gray-900">New broadcast</h3>
            <span className="text-xs text-gray-400">· Delivered via FCM topic <code className="bg-gray-100 px-1 rounded font-mono">app_{app.id.slice(0, 8)}…</code></span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Every device with this app installed receives it — in-app + push.</p>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">Title</label>
                <span className={`text-[11px] tabular-nums ${announceTitle.length > 70 ? "text-amber-600" : "text-gray-400"}`}>
                  {announceTitle.length}/80
                </span>
              </div>
              <input
                type="text"
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="e.g. Version 2.1 is here"
                maxLength={80}
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">Body</label>
                <span className={`text-[11px] tabular-nums ${announceBody.length > 220 ? "text-amber-600" : "text-gray-400"}`}>
                  {announceBody.length}/240
                </span>
              </div>
              <textarea
                value={announceBody}
                onChange={(e) => setAnnounceBody(e.target.value)}
                placeholder="Share what's new, maintenance windows, outages, feature launches…"
                rows={4}
                maxLength={240}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 inline-flex items-center gap-1.5">
                Link <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <input
                  type="text"
                  value={announceLink}
                  onChange={(e) => setAnnounceLink(e.target.value)}
                  placeholder="/tickets  or  https://example.com/blog"
                  className={`${inputCls} pl-9 font-mono text-xs`}
                />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[11px] text-gray-400">Quick:</span>
                {["/tickets", "/feedback", "/notifications"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAnnounceLink(p)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-mono transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-xs text-gray-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Cannot be undone
              </div>
              <div className="flex items-center gap-3">
                {announceResult && (
                  <span className={`text-xs ${announceResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {announceResult.msg}
                  </span>
                )}
                <button
                  onClick={sendAnnouncement}
                  disabled={announcing || !announceTitle.trim() || !announceBody.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm hover:shadow"
                >
                  {announcing ? (
                    <>
                      <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.125A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.875L5.999 12zm0 0h7.5" />
                      </svg>
                      Broadcast
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Live phone preview */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Live preview</div>
          <div className="relative mx-auto w-[260px] rounded-[32px] bg-gray-900 p-3 shadow-xl">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-gray-700" />
            <div className="rounded-[24px] bg-gradient-to-b from-slate-100 to-slate-200 pt-7 pb-4 px-3 min-h-[340px]">
              {/* Status bar */}
              <div className="flex items-center justify-between text-[10px] font-semibold text-gray-700 mb-3 px-1">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22h2V10H2v12zm5 0h2V6H7v16zm5 0h2V2h-2v20zm5 0h2V14h-2v8z" /></svg>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" /></svg>
                </div>
              </div>
              {/* Notification card */}
              <div className="bg-white/95 backdrop-blur rounded-2xl shadow-sm p-3 animate-slide-down" key={announceTitle + announceBody + announceLink}>
                <div className="flex items-start gap-2.5">
                  {appIconOrInitial(app, 32)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-900 truncate">{app.name}</span>
                      <span className="text-[10px] text-gray-400">now</span>
                    </div>
                    <div className="text-[12px] font-semibold text-gray-900 mt-0.5 leading-tight break-words">
                      {announceTitle || "Your title appears here"}
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-snug break-words line-clamp-3">
                      {announceBody || "Your body text will show up in the notification shade and in the in-app feed."}
                    </div>
                    {announceLink && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono truncate max-w-full">
                        <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
                        </svg>
                        <span className="truncate">{announceLink}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Faux secondary notif to give the preview context */}
              <div className="mt-2 bg-white/60 rounded-2xl p-2.5">
                <div className="h-2 w-16 rounded bg-gray-300 mb-1.5" />
                <div className="h-1.5 w-3/4 rounded bg-gray-200 mb-1" />
                <div className="h-1.5 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Past announcements — timeline */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4 animate-fade-in-up [animation-delay:80ms]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            History <span className="text-gray-400 font-normal">· {announcements.length}</span>
          </h3>
        </div>

        {announcements.length > 0 ? (
          <div className="relative">
            {/* Vertical rail */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-200 via-gray-200 to-transparent" />
            <ul className="space-y-4">
              {announcements.map((a) => (
                <li key={a.id} className="relative pl-10 group">
                  {/* Dot */}
                  <span className="absolute left-2 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-violet-500 shadow-sm group-hover:scale-110 transition-transform" />
                  <div className="rounded-lg border border-gray-100 p-3 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{a.title}</span>
                          <span className="text-xs text-gray-400" title={new Date(a.createdAt).toLocaleString()}>
                            {relTime(a.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 break-words whitespace-pre-wrap leading-relaxed">{a.body}</p>
                        {a.link && (
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
                            </svg>
                            {a.link}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => deleteAnnouncement(a.id)}
                        className="flex-shrink-0 p-1.5 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete announcement"
                        aria-label="Delete announcement"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-dashed border-gray-200 p-10 text-center">
            {/* Subtle violet radial background */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.4]"
              style={{ background: "radial-gradient(circle at 50% 0%, rgba(124,58,237,0.08), transparent 60%)" }}
            />
            <div className="relative">
              <div className="mx-auto w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-violet-500" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">No announcements yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                Broadcast product updates, outages, or feature launches — they appear here and in the SDK notifications feed.
              </p>
            </div>
          </div>
        )}
      </section>
      </>
      )}

      {activeTab === "settings" && (
      <>
      {/* Settings */}
      <section id="settings" className="bg-white rounded-xl border border-gray-200 p-5 mb-4 scroll-mt-6 animate-fade-in-up">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Settings</h3>
            <p className="text-xs text-gray-500 mt-0.5">Configure how this app authenticates, emails users, and sends push notifications.</p>
          </div>
          <button
            onClick={() => setShowSettingsHelp((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            {showSettingsHelp ? "Hide setup help" : "How to configure"}
          </button>
        </div>

        {showSettingsHelp && (
          <div className="mb-5 -mx-1 overflow-hidden animate-reveal">
            <SettingsHelp />
          </div>
        )}

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
            className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-transform active:scale-95"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      {/* Danger zone — visible only on the Settings tab, where destructive
          actions belong. */}
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
      </>
      )}

      {/* Floating success toast — appears on Save success, auto-dismisses.
          keyed on saveToastKey so re-saves restart the slide-up animation. */}
      {saveMsg && saveMsg.ok && (
        <div
          key={saveToastKey}
          className="fixed bottom-8 left-1/2 z-40 bg-gray-900 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium animate-slide-up flex items-center gap-2"
          style={{ transform: "translateX(-50%)" }}
        >
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {saveMsg.msg}
        </div>
      )}

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
    <div
      className={`rounded-xl border border-gray-200 bg-white p-3 transition-all duration-200 ${
        href ? "hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer" : ""
      }`}
    >
      <div className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${tint} mb-1`}>{label}</div>
      <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
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
