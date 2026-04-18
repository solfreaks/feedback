import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import type { App } from "../types";

/**
 * Global Announcements page. Lists announcements across every app the admin
 * can see (all apps for super admins, only assigned ones otherwise) and lets
 * them broadcast a new one by picking the target app from a dropdown.
 *
 * Per-app announcements still live on /apps/:id?tab=announcements — this page
 * is the cross-app overview, reachable from the sidebar.
 */

type Announcement = {
  id: string;
  appId: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  app?: { id: string; name: string; iconUrl?: string | null; platform?: string | null } | null;
};

const inputCls =
  "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 " +
  "placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 " +
  "focus:bg-white focus:border-blue-300 transition-all";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function AppIcon({ app, size = 32 }: { app: Announcement["app"]; size?: number }) {
  if (app?.iconUrl) {
    return <img src={`/api${app.iconUrl}`} alt={app.name} className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  }
  const letter = app?.name?.charAt(0)?.toUpperCase() || "?";
  return (
    <div
      className="rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {letter}
    </div>
  );
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAppId, setFilterAppId] = useState<string>("");

  // Composer
  const [composeAppId, setComposeAppId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [annRes, appsRes] = await Promise.all([
        api.get("/admin/announcements"),
        api.get("/admin/apps"),
      ]);
      setItems(annRes.data || []);
      setApps(Array.isArray(appsRes.data) ? appsRes.data : []);
    } catch {
      /* ignore — empty state covers it */
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => (filterAppId ? items.filter((i) => i.appId === filterAppId) : items),
    [items, filterAppId]
  );

  const send = async () => {
    if (!composeAppId || !title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      await api.post(`/admin/apps/${composeAppId}/announcements`, {
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || undefined,
      });
      setTitle("");
      setBody("");
      setLink("");
      setResult({ ok: true, msg: "Announcement sent" });
      setTimeout(() => setResult(null), 2000);
      load();
    } catch (err: any) {
      setResult({ ok: false, msg: err.response?.data?.error || "Failed to send" });
    }
    setSending(false);
  };

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/admin/announcements/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Announcements</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Broadcast a message to every device using one of your apps. Delivered via FCM topic push and surfaced in-app via the SDK notifications feed.
        </p>
      </div>

      {/* Composer */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">New broadcast</h2>
        {apps.length === 0 ? (
          <p className="text-sm text-gray-500">
            You don't have any apps yet.{" "}
            <Link to="/apps" className="text-blue-600 hover:text-blue-700">Create one →</Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target app</label>
              <select
                value={composeAppId}
                onChange={(e) => setComposeAppId(e.target.value)}
                className={inputCls}
              >
                <option value="">Select app…</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Pushes to every device on <code className="bg-gray-100 px-1 rounded">app_&lt;id&gt;</code>.
              </p>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                maxLength={80}
                className={inputCls}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Body"
                rows={3}
                maxLength={240}
                className={`${inputCls} resize-none`}
              />
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Link (optional) — /tickets or https://…"
                className={`${inputCls} font-mono text-xs`}
              />
              <div className="flex items-center justify-end gap-3 pt-1">
                {result && (
                  <span className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {result.msg}
                  </span>
                )}
                <button
                  onClick={send}
                  disabled={sending || !composeAppId || !title.trim() || !body.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-transform active:scale-95"
                >
                  {sending ? "Sending…" : "Broadcast"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* List */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900">
            Recent broadcasts{" "}
            <span className="text-gray-400 font-normal">· {filtered.length}</span>
          </h2>
          {apps.length > 1 && (
            <select
              value={filterAppId}
              onChange={(e) => setFilterAppId(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-300"
            >
              <option value="">All apps</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sdk-skeleton h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" />
            </svg>
            <p className="text-sm text-gray-500">No announcements yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Send your first broadcast above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="group flex items-start gap-3 border border-gray-100 rounded-lg p-3 hover:border-gray-200 hover:bg-gray-50/50 transition-colors"
              >
                <Link to={`/apps/${a.appId}?tab=announcements`} className="flex-shrink-0">
                  <AppIcon app={a.app} />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{a.title}</span>
                    {a.app && (
                      <Link
                        to={`/apps/${a.appId}?tab=announcements`}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        {a.app.name}
                      </Link>
                    )}
                    <span className="text-xs text-gray-400">{relTime(a.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 break-words">{a.body}</p>
                  {a.link && <p className="text-xs text-blue-600 mt-1 font-mono break-all">{a.link}</p>}
                </div>
                <button
                  onClick={() => deleteItem(a.id)}
                  className="text-xs text-gray-400 hover:text-red-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete announcement"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
