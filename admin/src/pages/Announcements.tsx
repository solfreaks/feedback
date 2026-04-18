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

function AppIcon({ app, size = 32 }: { app: Announcement["app"] | App | null | undefined; size?: number }) {
  const a = app as any;
  if (a?.iconUrl) {
    return <img src={`/api${a.iconUrl}`} alt={a.name} className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  }
  const letter = a?.name?.charAt(0)?.toUpperCase() || "?";
  return (
    <div
      className="rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {letter}
    </div>
  );
}

function groupByDay(items: Announcement[]): { label: string; items: Announcement[] }[] {
  const buckets = new Map<string, { label: string; items: Announcement[] }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  for (const item of items) {
    const d = new Date(item.createdAt);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else if (d.getTime() >= weekAgo.getTime()) label = "This week";
    else label = d.toLocaleDateString(undefined, { month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
    if (!buckets.has(label)) buckets.set(label, { label, items: [] });
    buckets.get(label)!.items.push(item);
  }
  return Array.from(buckets.values());
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAppId, setFilterAppId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);

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
      /* empty state covers it */
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let out = items;
    if (filterAppId) out = out.filter((i) => i.appId === filterAppId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.body.toLowerCase().includes(q) ||
          (i.app?.name.toLowerCase().includes(q) ?? false)
      );
    }
    return out;
  }, [items, filterAppId, search]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  // Per-app counts for the filter pills — only apps with at least one
  // announcement get a pill, so the row doesn't explode when the admin has
  // many apps but only a few with broadcast history.
  const countsByApp = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) map.set(i.appId, (map.get(i.appId) ?? 0) + 1);
    return map;
  }, [items]);

  const composeApp = apps.find((a) => a.id === composeAppId) || null;

  const sentLast7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return items.filter((i) => new Date(i.createdAt).getTime() >= cutoff).length;
  }, [items]);
  const sentLast30Days = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    return items.filter((i) => new Date(i.createdAt).getTime() >= cutoff).length;
  }, [items]);

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
      setResult({ ok: true, msg: "Broadcast sent" });
      setTimeout(() => setResult(null), 2000);
      load();
    } catch (err: any) {
      setResult({ ok: false, msg: err.response?.data?.error || "Failed to send" });
    }
    setSending(false);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    try {
      await api.delete(`/admin/announcements/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="max-w-6xl">
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap animate-fade-in-up">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" />
            </svg>
            Broadcasts
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Push a message to every device running one of your apps. Delivered in-app and via FCM topic so even users with the app closed see it.
          </p>
        </div>

        {/* Stat strip */}
        <div className="flex gap-2">
          <StatCard label="Total" value={items.length} tint="from-violet-50 to-violet-50/50" dotClass="bg-violet-500" />
          <StatCard label="7 days" value={sentLast7Days} tint="from-blue-50 to-blue-50/50" dotClass="bg-blue-500" />
          <StatCard label="30 days" value={sentLast30Days} tint="from-emerald-50 to-emerald-50/50" dotClass="bg-emerald-500" />
        </div>
      </div>

      {/* Composer + live preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-6 animate-fade-in-up [animation-delay:60ms]">
        <section className="relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5">
          {/* Soft violet corner wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-[0.08]"
            style={{ background: "radial-gradient(closest-side, #7c3aed, transparent)" }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <h3 className="text-sm font-semibold text-gray-900">New broadcast</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Pick an app, write your message, preview it on the right.</p>

            {apps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-500">
                  You don't have any apps yet.{" "}
                  <Link to="/apps" className="text-blue-600 hover:text-blue-700 font-medium">Create one →</Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Target app</label>
                  <div className="flex flex-wrap gap-1.5">
                    {apps.slice(0, 8).map((a) => {
                      const picked = composeAppId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setComposeAppId(a.id)}
                          className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                            picked
                              ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                              : "bg-white text-gray-700 border-gray-300 hover:border-violet-400 hover:bg-violet-50"
                          }`}
                        >
                          <AppIcon app={a} size={18} />
                          {a.name}
                        </button>
                      );
                    })}
                    {apps.length > 8 && (
                      <select
                        value={apps.slice(0, 8).some((a) => a.id === composeAppId) ? "" : composeAppId}
                        onChange={(e) => setComposeAppId(e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded-full bg-white text-gray-700 hover:border-violet-400"
                      >
                        <option value="">More…</option>
                        {apps.slice(8).map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Title</label>
                    <span className={`text-[11px] tabular-nums ${title.length > 70 ? "text-amber-600" : "text-gray-400"}`}>
                      {title.length}/80
                    </span>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Version 2.1 is here"
                    maxLength={80}
                    className={inputCls}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Body</label>
                    <span className={`text-[11px] tabular-nums ${body.length > 220 ? "text-amber-600" : "text-gray-400"}`}>
                      {body.length}/240
                    </span>
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Share what's new, maintenance windows, outages, feature launches…"
                    rows={4}
                    maxLength={240}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 inline-block">
                    Link <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <input
                      type="text"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
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
                        onClick={() => setLink(p)}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-mono transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Cannot be undone once sent
                  </div>
                  <div className="flex items-center gap-3">
                    {result && (
                      <span className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                        {result.msg}
                      </span>
                    )}
                    <button
                      onClick={send}
                      disabled={sending || !composeAppId || !title.trim() || !body.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm hover:shadow"
                    >
                      {sending ? (
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
            )}
          </div>
        </section>

        {/* Live phone preview */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Live preview</div>
          <div className="relative mx-auto w-[260px] rounded-[32px] bg-gray-900 p-3 shadow-xl">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-gray-700" />
            <div className="rounded-[24px] bg-gradient-to-b from-slate-100 to-slate-200 pt-7 pb-4 px-3 min-h-[340px]">
              <div className="flex items-center justify-between text-[10px] font-semibold text-gray-700 mb-3 px-1">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22h2V10H2v12zm5 0h2V6H7v16zm5 0h2V2h-2v20zm5 0h2V14h-2v8z" /></svg>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" /></svg>
                </div>
              </div>
              <div className="bg-white/95 backdrop-blur rounded-2xl shadow-sm p-3 animate-slide-down" key={title + body + link + composeAppId}>
                <div className="flex items-start gap-2.5">
                  <AppIcon app={composeApp} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-900 truncate">
                        {composeApp?.name || "Your app"}
                      </span>
                      <span className="text-[10px] text-gray-400">now</span>
                    </div>
                    <div className="text-[12px] font-semibold text-gray-900 mt-0.5 leading-tight break-words">
                      {title || "Your title appears here"}
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-snug break-words line-clamp-3">
                      {body || "Your body text will show up in the notification shade and in the in-app feed."}
                    </div>
                    {link && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono truncate max-w-full">
                        <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
                        </svg>
                        <span className="truncate">{link}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 bg-white/60 rounded-2xl p-2.5">
                <div className="h-2 w-16 rounded bg-gray-300 mb-1.5" />
                <div className="h-1.5 w-3/4 rounded bg-gray-200 mb-1" />
                <div className="h-1.5 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Toolbar */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 animate-fade-in-up [animation-delay:120ms]">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-900">
            History <span className="text-gray-400 font-normal">· {filtered.length}{filterAppId || search ? ` of ${items.length}` : ""}</span>
          </h2>
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, body, or app…"
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-300"
            />
          </div>
        </div>

        {/* App filter pills — only show apps that have history */}
        {countsByApp.size > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <FilterPill
              active={!filterAppId}
              onClick={() => setFilterAppId("")}
              label="All"
              count={items.length}
            />
            {apps
              .filter((a) => countsByApp.has(a.id))
              .map((a) => (
                <FilterPill
                  key={a.id}
                  active={filterAppId === a.id}
                  onClick={() => setFilterAppId(a.id)}
                  label={a.name}
                  count={countsByApp.get(a.id) ?? 0}
                  icon={<AppIcon app={a} size={16} />}
                />
              ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sdk-skeleton h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative overflow-hidden rounded-xl border border-dashed border-gray-200 p-10 text-center">
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
              <p className="text-sm font-medium text-gray-700">
                {items.length === 0 ? "No announcements yet" : "Nothing matches your filters"}
              </p>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                {items.length === 0
                  ? "Broadcast product updates, outages, or feature launches — they'll appear here and in the SDK notifications feed."
                  : "Try clearing the search or picking a different app."}
              </p>
              {(filterAppId || search) && items.length > 0 && (
                <button
                  onClick={() => { setFilterAppId(""); setSearch(""); }}
                  className="mt-3 text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((bucket) => (
              <div key={bucket.label}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {bucket.label}
                </div>
                <div className="relative">
                  {/* Vertical rail */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-200 via-gray-200 to-transparent" />
                  <ul className="space-y-3">
                    {bucket.items.map((a) => (
                      <li key={a.id} className="relative pl-10 group">
                        <span className="absolute left-2 top-2 w-3 h-3 rounded-full bg-white border-2 border-violet-500 shadow-sm group-hover:scale-110 transition-transform" />
                        <div className="rounded-lg border border-gray-100 p-3 hover:border-violet-200 hover:bg-violet-50/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <Link to={`/apps/${a.appId}?tab=announcements`} className="flex-shrink-0">
                              <AppIcon app={a.app} size={36} />
                            </Link>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{a.title}</span>
                                {a.app && (
                                  <Link
                                    to={`/apps/${a.appId}?tab=announcements`}
                                    className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium"
                                  >
                                    {a.app.name}
                                  </Link>
                                )}
                                <span
                                  className="text-xs text-gray-400"
                                  title={new Date(a.createdAt).toLocaleString()}
                                >
                                  {relTime(a.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1 break-words whitespace-pre-wrap leading-relaxed">{a.body}</p>
                              {a.link && (
                                <div className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono break-all">
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
                                  </svg>
                                  {a.link}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setConfirmDelete(a)}
                              className="flex-shrink-0 p-1.5 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                              title="Delete"
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
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">Delete announcement?</h3>
            <p className="text-sm text-gray-600 mt-2">
              "{confirmDelete.title}" will disappear from the in-app feed. Users who already received the push won't be affected.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={doDelete}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tint, dotClass }: { label: string; value: number; tint: string; dotClass: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 px-4 py-2 bg-gradient-to-br ${tint}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600">
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        {label}
      </div>
      <div className="text-xl font-bold text-gray-900 tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function FilterPill({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95 ${
        active
          ? "bg-violet-600 text-white border-violet-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-200 hover:border-violet-300 hover:bg-violet-50"
      }`}
    >
      {icon ?? <span className={`w-4 h-4 rounded-full ${active ? "bg-white/30" : "bg-gray-200"}`} />}
      {label}
      <span className={`tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
        active ? "bg-white/25" : "bg-gray-100 text-gray-500"
      }`}>
        {count}
      </span>
    </button>
  );
}
