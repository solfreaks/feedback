import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import type { Ticket } from "../types";
import Avatar from "../components/Avatar";
import { LANGUAGE_OPTIONS, detectLanguage, QUICK_REPLY_TRANSLATIONS, TICKET_REPLY_TRANSLATIONS } from "../utils/translations";

const priorityConfig: Record<string, { bg: string; dot: string; label: string }> = {
  critical: { bg: "bg-red-100 text-red-700 ring-1 ring-red-200", dot: "bg-red-500", label: "Critical" },
  high: { bg: "bg-orange-100 text-orange-700 ring-1 ring-orange-200", dot: "bg-orange-500", label: "High" },
  medium: { bg: "bg-amber-100 text-amber-700 ring-1 ring-amber-200", dot: "bg-amber-500", label: "Medium" },
  low: { bg: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500", label: "Low" },
};
const statusConfig: Record<string, { bg: string; dot: string; label: string }> = {
  open: { bg: "bg-blue-100 text-blue-700 ring-1 ring-blue-200", dot: "bg-blue-500", label: "Open" },
  in_progress: { bg: "bg-violet-100 text-violet-700 ring-1 ring-violet-200", dot: "bg-violet-500", label: "In Progress" },
  resolved: { bg: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500", label: "Resolved" },
  closed: { bg: "bg-gray-100 text-gray-600 ring-1 ring-gray-200", dot: "bg-gray-400", label: "Closed" },
};

const ticketQuickReplies = [
  { label: "Acknowledged", body: "Thank you for reporting this issue. We've received your ticket and our team is looking into it. We'll update you as soon as we have more information.", icon: "eye" },
  { label: "Need more info", body: "Thank you for reaching out. To help us investigate this further, could you please provide:\n\n1. Steps to reproduce the issue\n2. Device model and OS version\n3. App version\n4. Any screenshots or error messages\n\nThis will help us resolve your issue faster.", icon: "question" },
  { label: "In progress", body: "We've identified the issue and our team is actively working on a fix. We'll notify you once the fix is ready. Thank you for your patience.", icon: "progress" },
  { label: "Fixed / Resolved", body: "Great news! This issue has been resolved. Please update to the latest version of the app and let us know if you experience any further problems.", icon: "check" },
  { label: "Workaround", body: "While we work on a permanent fix, here's a temporary workaround you can try:\n\n1. [Describe workaround steps]\n\nPlease let us know if this helps. We'll update you once the permanent fix is available.", icon: "tool" },
  { label: "Duplicate", body: "Thank you for reporting this. We've identified that this issue has already been reported and is being tracked. We'll keep you updated on the progress and notify you once it's resolved.", icon: "copy" },
  { label: "Cannot reproduce", body: "We've investigated this issue but were unable to reproduce it on our end. Could you please confirm if the issue is still occurring? If so, any additional details such as steps to reproduce, screenshots, or device information would be very helpful.", icon: "search" },
  { label: "Closing", body: "We're closing this ticket as the issue appears to have been resolved. If you continue to experience problems, please don't hesitate to open a new ticket and we'll be happy to help.", icon: "archive" },
];

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function slaTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h left`;
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");
  const [deleteTicketConfirm, setDeleteTicketConfirm] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  // Merge-into-primary state. Two-step flow: open the form, enter the target
  // ticket's short ID (or paste its URL), add an optional reason, confirm.
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [admins, setAdmins] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  // Handoff confirmation state: when non-null, shows a panel asking for an
  // optional note before the reassignment is committed.
  const [pendingAssignee, setPendingAssignee] = useState<{ id: string; name: string } | null>(null);
  const [handoffNote, setHandoffNote] = useState("");
  // User's saved canned replies merged with the built-in ones in the quick
  // replies panel. Persisted via /admin/canned-replies.
  const [cannedReplies, setCannedReplies] = useState<{ id: string; title: string; body: string; shared: boolean; locale: string | null }[]>([]);
  const [cannedLocale, setCannedLocale] = useState("");
  const [detectedLocale, setDetectedLocale] = useState("");
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translatingComment, setTranslatingComment] = useState(false);
  const [translateToLocale, setTranslateToLocale] = useState("");
  const [translatingCanned, setTranslatingCanned] = useState<string | null>(null);
  const [translatedComments, setTranslatedComments] = useState<Record<string, string>>({});
  const [translatingCommentId, setTranslatingCommentId] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateShared, setNewTemplateShared] = useState(false);
  // Mention autocomplete: detect an @token at the cursor and suggest admins.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);

  const fetchTicket = () => {
    api.get(`/admin/tickets/${id}`).then((r) => { setTicket(r.data); setLoading(false); });
  };

  useEffect(() => { fetchTicket(); }, [id]);
  useEffect(() => {
    api.get("/admin/admins").then((r) => setAdmins(r.data));
  }, []);
  useEffect(() => {
    api.get("/admin/canned-replies").then((r) => setCannedReplies(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!ticket) return;
    const userTexts = [
      ticket.description ?? "",
      ...(ticket.comments ?? [])
        .filter((c) => c.user.id === ticket.user.id)
        .map((c) => c.body),
    ].join(" ");
    const detected = detectLanguage(userTexts);
    if (detected) {
      setDetectedLocale(detected);
      setCannedLocale(detected);
    }
  }, [ticket?.id]);

  // Match an @token immediately before the caret (i.e. currently typing).
  const detectMention = (value: string, caret: number) => {
    const prefix = value.slice(0, caret);
    const match = /@([a-zA-Z0-9._-]*)$/.exec(prefix);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionActiveIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (admin: { id: string; name: string }) => {
    const el = commentRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? comment.length;
    const prefix = comment.slice(0, caret);
    const suffix = comment.slice(caret);
    const replaced = prefix.replace(/@([a-zA-Z0-9._-]*)$/, `@${admin.name.split(" ")[0]} `);
    const next = replaced + suffix;
    setComment(next);
    setMentionQuery(null);
    // Restore caret after the inserted mention
    setTimeout(() => {
      const newCaret = replaced.length;
      el.focus();
      el.setSelectionRange(newCaret, newCaret);
    }, 0);
  };

  const mentionCandidates = mentionQuery !== null
    ? admins.filter((a) =>
        mentionQuery === "" ||
        a.name.toLowerCase().includes(mentionQuery) ||
        a.name.split(" ")[0].toLowerCase().startsWith(mentionQuery)
      ).slice(0, 6)
    : [];

  const performMerge = async () => {
    if (!id) return;
    setMergeError(null);
    // Accept full URL, full UUID, or short prefix. The endpoint takes the
    // server's full UUID, so short slices are rejected here rather than
    // round-tripping an invalid ID.
    const raw = mergeTargetId.trim();
    const urlMatch = raw.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    const primaryId = urlMatch ? urlMatch[0] : raw;
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(primaryId)) {
      setMergeError("Paste the primary ticket's URL or full ID.");
      return;
    }
    if (primaryId === id) {
      setMergeError("A ticket cannot be merged into itself.");
      return;
    }
    setMerging(true);
    try {
      await api.post(`/admin/tickets/${id}/merge-into/${primaryId}`, { reason: mergeReason.trim() });
      navigate(`/tickets/${primaryId}`);
    } catch (err: any) {
      setMergeError(err?.response?.data?.error || "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!comment.trim() || !newTemplateTitle.trim()) return;
    const res = await api.post("/admin/canned-replies", {
      title: newTemplateTitle.trim(),
      body: comment,
      shared: newTemplateShared,
    });
    setCannedReplies((prev) => [...prev, res.data]);
    setSaveTemplateOpen(false);
    setNewTemplateTitle("");
    setNewTemplateShared(false);
  };

  const deleteCannedReply = async (replyId: string) => {
    await api.delete(`/admin/canned-replies/${replyId}`);
    setCannedReplies((prev) => prev.filter((r) => r.id !== replyId));
  };

  const updateTicket = async (updates: Record<string, string | null>, extras: { handoffNote?: string } = {}) => {
    setUpdating(true);
    // Convert empty string to null for unassign
    const payload: Record<string, unknown> = Object.fromEntries(
      Object.entries(updates).map(([k, v]) => [k, v === "" ? null : v])
    );
    if (extras.handoffNote) payload.handoffNote = extras.handoffNote;
    await api.patch(`/admin/tickets/${id}`, payload);
    fetchTicket();
    setUpdating(false);
  };

  const confirmReassign = async () => {
    if (!pendingAssignee) return;
    await updateTicket({ assignedTo: pendingAssignee.id }, { handoffNote: handoffNote.trim() });
    setPendingAssignee(null);
    setHandoffNote("");
    setAssignDropdownOpen(false);
  };

  const addComment = async () => {
    if (!comment.trim() && pendingFiles.length === 0) return;
    setSending(true);
    const res = await api.post(`/admin/tickets/${id}/notes`, { body: comment || " ", isInternalNote: isInternal });
    const commentId = res.data?.id;
    if (commentId && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("commentId", commentId);
        await api.post(`/admin/tickets/${id}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
    }
    setComment("");
    setPendingFiles([]);
    setIsInternal(false);
    setSending(false);
    fetchTicket();
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/admin/tickets/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setUploading(false);
    fetchTicket();
  };

  const handleDeleteTicket = async () => {
    setDeletingTicket(true);
    try {
      await api.delete(`/admin/tickets/${id}`);
      navigate("/tickets");
    } catch {
      alert("Failed to delete ticket");
      setDeletingTicket(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setDeletingComment(true);
    try {
      await api.delete(`/admin/tickets/${id}/comments/${commentId}`);
      setDeleteCommentId(null);
      fetchTicket();
    } catch {
      alert("Failed to delete comment");
    } finally {
      setDeletingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!ticket) return <div className="p-8 text-center text-red-500">Ticket not found</div>;

  const slaBreach = ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && ticket.status !== "closed" && ticket.status !== "resolved";
  const slaRemaining = ticket.slaDeadline && !slaBreach ? slaTimeLeft(ticket.slaDeadline) : null;
  const sc = statusConfig[ticket.status] || statusConfig.open;
  const pc = priorityConfig[ticket.priority] || priorityConfig.medium;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/tickets" className="hover:text-gray-600 transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tickets
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium truncate max-w-md">{ticket.title}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${pc.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                {pc.label}
              </span>
              {ticket.category && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 ring-1 ring-gray-200">
                  {ticket.category}
                </span>
              )}
              {slaBreach && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 ring-1 ring-red-200">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  SLA BREACHED
                </span>
              )}
              {slaRemaining && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 ring-1 ring-sky-200">
                  {slaRemaining}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-3">{ticket.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Avatar name={ticket.user.name} avatarUrl={ticket.user.avatarUrl} size={24} />
                <span className="font-medium text-gray-700">{ticket.user.name}</span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {ticket.app.name}
              </span>
              <span className="text-gray-300">|</span>
              <span>{timeAgo(ticket.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-5 bg-gray-50 rounded-xl p-5 border border-gray-100">
          <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          {translatedDescription && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Translated to English</span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{translatedDescription}</p>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={async () => {
                if (translatedDescription) { setTranslatedDescription(null); return; }
                setTranslating(true);
                try {
                  const res = await api.post("/admin/translate", { text: ticket.description, from: detectedLocale || undefined });
                  setTranslatedDescription(res.data.translated);
                } catch { /* silent */ } finally { setTranslating(false); }
              }}
              disabled={translating}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
            >
              {translating ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              )}
              {translating ? "Translating..." : translatedDescription ? "Hide translation" : "Translate to English"}
            </button>
            {detectedLocale && !translatedDescription && (
              <span className="text-[10px] text-gray-400">
                Detected: {LANGUAGE_OPTIONS.find(o => o.value === detectedLocale)?.label ?? detectedLocale}
              </span>
            )}
          </div>
        </div>

        {/* Attachments */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {ticket.attachments?.map((a) => (
              <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors group">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="text-sm font-medium text-blue-700 group-hover:text-blue-800">{a.fileName}</span>
                <span className="text-xs text-blue-400">{(a.fileSize / 1024).toFixed(0)} KB</span>
              </a>
            ))}
            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors ${
              uploading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
            }`}>
              <input type="file" className="hidden" disabled={uploading}
                onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  <span className="text-sm text-blue-600 font-medium">Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-gray-500">Attach file</span>
                </>
              )}
            </label>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button onClick={() => setActiveTab("comments")}
                className={`flex-1 px-5 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === "comments"
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}>
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Comments
                  {ticket.comments && ticket.comments.length > 0 && (
                    <span className="bg-gray-100 text-gray-600 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">{ticket.comments.length}</span>
                  )}
                </span>
                {activeTab === "comments" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
              </button>
              <button onClick={() => setActiveTab("history")}
                className={`flex-1 px-5 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === "history"
                    ? "text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}>
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  History
                  {ticket.history && ticket.history.length > 0 && (
                    <span className="bg-gray-100 text-gray-600 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">{ticket.history.length}</span>
                  )}
                </span>
                {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
              </button>
            </div>

            <div className="p-5">
              {/* Comments tab */}
              {activeTab === "comments" && (
                <div className="space-y-0">
                  {ticket.comments && ticket.comments.length > 0 ? (
                    <div className="space-y-1">
                      {ticket.comments.map((c, i) => (
                        <div key={c.id} className={`flex gap-3 group/comment ${i > 0 ? "pt-4" : ""}`}>
                          <div className="flex flex-col items-center flex-shrink-0">
                            {c.isInternalNote ? (
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
                                {c.user.name.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <Avatar name={c.user.name} avatarUrl={c.user.avatarUrl} size={32} />
                            )}
                            {i < (ticket.comments?.length ?? 0) - 1 && (
                              <div className="w-px flex-1 bg-gray-200 mt-2" />
                            )}
                          </div>
                          <div className={`flex-1 pb-4 ${i < (ticket.comments?.length ?? 0) - 1 ? "border-b border-gray-50" : ""}`}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-sm font-semibold text-gray-900">{c.user.name}</span>
                              {c.isInternalNote && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  Internal
                                </span>
                              )}
                              <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                              {deleteCommentId === c.id ? (
                                <span className="inline-flex items-center gap-1 ml-auto">
                                  <button onClick={() => handleDeleteComment(c.id)} disabled={deletingComment}
                                    className="text-[10px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                                    {deletingComment ? "Deleting..." : "Confirm"}
                                  </button>
                                  <span className="text-gray-300">|</span>
                                  <button onClick={() => setDeleteCommentId(null)}
                                    className="text-[10px] font-medium text-gray-500 hover:text-gray-700">
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button onClick={() => setDeleteCommentId(c.id)} title="Delete comment"
                                  className="ml-auto p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover/comment:opacity-100">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div className={`text-sm leading-relaxed rounded-lg p-3 ${
                              c.isInternalNote
                                ? "bg-amber-50 text-amber-900 border border-amber-100"
                                : "bg-gray-50 text-gray-700 border border-gray-100"
                            }`}>
                              <p className="whitespace-pre-wrap">{translatedComments[c.id] || c.body}</p>
                              {translatedComments[c.id] && (
                                <p className="mt-2 text-[11px] text-gray-400 italic border-t border-gray-200 pt-1.5">Original: {c.body}</p>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  if (translatedComments[c.id]) {
                                    setTranslatedComments(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                                    return;
                                  }
                                  setTranslatingCommentId(c.id);
                                  try {
                                    const from = detectLanguage(c.body) || undefined;
                                    const res = await api.post("/admin/translate", { text: c.body, from });
                                    if (res.data.translated) setTranslatedComments(prev => ({ ...prev, [c.id]: res.data.translated }));
                                  } catch { /* silent */ } finally { setTranslatingCommentId(null); }
                                }}
                                disabled={translatingCommentId === c.id}
                                className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                              >
                                {translatingCommentId === c.id
                                  ? <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-blue-500" />
                                  : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>}
                                {translatingCommentId === c.id ? "Translating..." : translatedComments[c.id] ? "Show original" : "Translate"}
                              </button>
                            </div>
                            {/* Per-comment attachments */}
                            {(() => {
                              const commentAtts = ticket.attachments?.filter(a => a.commentId === c.id) || [];
                              if (commentAtts.length === 0) return null;
                              return (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {commentAtts.map(a => (
                                    <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 hover:bg-blue-100 text-xs text-blue-700 font-medium transition-colors">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                      </svg>
                                      {a.fileName}
                                      <span className="text-blue-400">{(a.fileSize / 1024).toFixed(0)} KB</span>
                                    </a>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-sm text-gray-400">No comments yet</p>
                      <p className="text-xs text-gray-300 mt-1">Be the first to reply</p>
                    </div>
                  )}

                  {/* Add comment */}
                  <div className="mt-5 pt-5 border-t border-gray-200">
                    {/* Quick replies */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                          <svg className={`w-4 h-4 transition-transform ${showQuickReplies ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                          Quick Replies
                        </button>
                      </div>
                      {showQuickReplies && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {detectedLocale && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                              </svg>
                              Detected: {LANGUAGE_OPTIONS.find(o => o.value === detectedLocale)?.label ?? detectedLocale}
                              {cannedLocale !== detectedLocale && (
                                <button onClick={() => setCannedLocale(detectedLocale)} className="ml-0.5 font-semibold text-violet-600 hover:text-violet-900">Use</button>
                              )}
                            </span>
                          )}
                          <button onClick={() => setCannedLocale("")}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${cannedLocale === "" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"}`}>
                            🌐 All Languages
                          </button>
                          <select value={cannedLocale} onChange={e => setCannedLocale(e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 cursor-pointer">
                            <option value="">— Select Language —</option>
                            {LANGUAGE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {cannedLocale && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {LANGUAGE_OPTIONS.find(o => o.value === cannedLocale)?.label ?? cannedLocale}
                              <button onClick={() => setCannedLocale("")} className="ml-0.5 hover:text-blue-900">✕</button>
                            </span>
                          )}
                        </div>
                      )}

                      {showQuickReplies && (
                        <>
                        {cannedReplies.filter(qr => !qr.locale).length > 0 && (
                          <div className="mt-2">
                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                              Your Saved Replies
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {cannedReplies.filter(qr => !qr.locale).map((cr) => (
                                <div key={cr.id} className="relative group">
                                  <button
                                    disabled={translatingCanned === cr.id}
                                    onClick={async () => {
                                      const preTranslated = cannedLocale && QUICK_REPLY_TRANSLATIONS[cr.title]?.[cannedLocale];
                                      if (preTranslated) { setComment(preTranslated); setShowQuickReplies(false); return; }
                                      if (cannedLocale) {
                                        setTranslatingCanned(cr.id);
                                        try {
                                          const res = await api.post("/admin/translate", { text: cr.body, to: cannedLocale });
                                          setComment(res.data.translated || cr.body);
                                        } catch { setComment(cr.body); }
                                        finally { setTranslatingCanned(null); setShowQuickReplies(false); }
                                      } else { setComment(cr.body); setShowQuickReplies(false); }
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 pr-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-200 text-left transition-all disabled:opacity-60"
                                  >
                                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                      {translatingCanned === cr.id
                                        ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-600" />
                                        : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                    </span>
                                    <span className="text-xs font-medium text-gray-700 truncate">
                                      {cr.title}
                                      {cr.shared && <span className="ml-1 text-[10px] text-emerald-600">· shared</span>}
                                    </span>
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteCannedReply(cr.id); }}
                                    className="absolute top-1 right-1 w-5 h-5 rounded hover:bg-red-100 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                    title="Delete template"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-1.5">
                          Built-in
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {ticketQuickReplies.map((qr) => (
                            <button key={qr.label} disabled={translatingCanned === qr.label} onClick={async () => {
                              const preTranslated = cannedLocale && TICKET_REPLY_TRANSLATIONS[qr.label]?.[cannedLocale];
                              if (preTranslated) { setComment(preTranslated); setShowQuickReplies(false); return; }
                              if (cannedLocale) {
                                setTranslatingCanned(qr.label);
                                try {
                                  const res = await api.post("/admin/translate", { text: qr.body, to: cannedLocale });
                                  setComment(res.data.translated || qr.body);
                                } catch { setComment(qr.body); }
                                finally { setTranslatingCanned(null); setShowQuickReplies(false); }
                              } else { setComment(qr.body); setShowQuickReplies(false); }
                            }}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-all group disabled:opacity-60">
                              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                                {translatingCanned === qr.label
                                  ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                                  : <>
                                    {qr.icon === "eye" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                                    {qr.icon === "question" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>}
                                    {qr.icon === "progress" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>}
                                    {qr.icon === "check" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                    {qr.icon === "tool" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 5.1a2.121 2.121 0 11-3-3l5.1-5.1m0 0L15 9.59m-3.58 5.58L6.41 10.16m5.01 5.01L17.83 8.76a2.121 2.121 0 00-3-3l-6.41 6.41" /></svg>}
                                    {qr.icon === "copy" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>}
                                    {qr.icon === "search" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
                                    {qr.icon === "archive" && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}
                                  </>}
                              </span>
                              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">{qr.label}</span>
                            </button>
                          ))}
                        </div>
                        </>
                      )}
                    </div>

                    <div className={`rounded-xl border transition-colors ${
                      isInternal ? "border-amber-300 bg-amber-50/50" : "border-gray-200 bg-white"
                    }`}>
                      <div className="relative">
                        <textarea
                          ref={commentRef}
                          value={comment}
                          onChange={(e) => {
                            setComment(e.target.value);
                            detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
                          }}
                          onKeyDown={(e) => {
                            if (mentionQuery === null || mentionCandidates.length === 0) return;
                            if (e.key === "ArrowDown") { e.preventDefault(); setMentionActiveIdx((i) => Math.min(i + 1, mentionCandidates.length - 1)); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); setMentionActiveIdx((i) => Math.max(i - 1, 0)); }
                            else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionActiveIdx]); }
                            else if (e.key === "Escape") { setMentionQuery(null); }
                          }}
                          placeholder={isInternal ? "Write an internal note (only visible to admins)..." : "Write a reply to the user..."}
                          className={`w-full p-4 text-sm rounded-t-xl resize-none outline-none bg-transparent ${
                            isInternal ? "placeholder-amber-400" : "placeholder-gray-400"
                          }`}
                          rows={3}
                        />
                        {mentionQuery !== null && mentionCandidates.length > 0 && (
                          <div className="absolute left-4 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[220px] overflow-hidden">
                            {mentionCandidates.map((a, i) => (
                              <button
                                key={a.id}
                                onClick={() => insertMention(a)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                                  i === mentionActiveIdx ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                                }`}
                              >
                                <Avatar name={a.name} avatarUrl={a.avatarUrl} size={20} />
                                <span>{a.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Pending file chips */}
                      {pendingFiles.length > 0 && (
                        <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
                          {pendingFiles.map((f, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              {f.name}
                              <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="hover:text-red-500 transition-colors ml-0.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setIsInternal(!isInternal)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isInternal
                                ? "bg-amber-200 text-amber-800"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {isInternal ? "Internal Note" : "Public Reply"}
                          </button>
                          {/* File picker */}
                          <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 cursor-pointer transition-colors" title="Attach file">
                            <input ref={commentFileRef} type="file" className="hidden" multiple
                              onChange={(e) => {
                                if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                e.target.value = "";
                              }} />
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}` : "Attach"}
                          </label>
                          {comment.length > 0 && (
                            <span className="text-xs text-gray-400">{comment.length} chars</span>
                          )}
                          {comment.trim() && (
                            <button onClick={() => setComment("")}
                              className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
                              Clear
                            </button>
                          )}
                          {comment.trim() && (
                            <button onClick={() => setSaveTemplateOpen(true)}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
                              Save as template
                            </button>
                          )}
                          {comment.trim() && (
                            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                              <span className="inline-flex items-center gap-1.5 text-xs text-indigo-500 font-medium whitespace-nowrap">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                </svg>
                                Translate
                              </span>
                              <select
                                value={translateToLocale}
                                onChange={e => setTranslateToLocale(e.target.value)}
                                className="text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 cursor-pointer min-w-[150px]"
                              >
                                <option value="">— Pick a language —</option>
                                {LANGUAGE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              {translateToLocale && (
                                <button
                                  onClick={async () => {
                                    setTranslatingComment(true);
                                    try {
                                      const detFrom = detectLanguage(comment);
                                      const res = await api.post("/admin/translate", {
                                        text: comment,
                                        ...(detFrom && { from: detFrom }),
                                        to: translateToLocale,
                                      });
                                      if (res.data.translated) setComment(res.data.translated);
                                    } catch (e) { console.error("translate comment:", e); } finally { setTranslatingComment(false); }
                                  }}
                                  disabled={translatingComment}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                  {translatingComment
                                    ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                    : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>}
                                  {translatingComment ? "Translating…" : `→ ${LANGUAGE_OPTIONS.find(o => o.value === translateToLocale)?.label ?? translateToLocale}`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <button onClick={addComment} disabled={sending || (!comment.trim() && pendingFiles.length === 0)}
                          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          {sending ? (
                            <>
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                              Send
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Save-as-template inline panel */}
                    {saveTemplateOpen && (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                        <div className="text-xs font-semibold text-emerald-800">Save reply as template</div>
                        <input
                          value={newTemplateTitle}
                          onChange={(e) => setNewTemplateTitle(e.target.value)}
                          placeholder="Template title (e.g. 'Refund in progress')"
                          className="w-full text-sm rounded-md border border-emerald-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <div className="flex items-center justify-between">
                          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newTemplateShared}
                              onChange={(e) => setNewTemplateShared(e.target.checked)}
                              className="rounded"
                            />
                            Share with all admins
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setSaveTemplateOpen(false); setNewTemplateTitle(""); setNewTemplateShared(false); }}
                              className="px-3 py-1.5 rounded-md text-xs text-gray-600 hover:bg-emerald-100"
                            >Cancel</button>
                            <button
                              onClick={saveAsTemplate}
                              disabled={!newTemplateTitle.trim()}
                              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >Save</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History tab */}
              {activeTab === "history" && (
                <div>
                  {ticket.history && ticket.history.length > 0 ? (
                    <div className="relative">
                      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200" />
                      <div className="space-y-0">
                        {ticket.history.map((h) => {
                          const isStatus = h.field === "status";
                          const isPriority = h.field === "priority";
                          const isAssignee = h.field === "assignedTo";
                          return (
                            <div key={h.id} className="flex gap-4 relative py-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0 ${
                                isStatus ? "bg-blue-100" : isPriority ? "bg-amber-100" : isAssignee ? "bg-violet-100" : "bg-gray-100"
                              }`}>
                                {isStatus ? (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                ) : isPriority ? (
                                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                  </svg>
                                ) : isAssignee ? (
                                  <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-700">
                                  <span className="font-semibold">{h.user.name}</span>
                                  <span className="text-gray-400"> changed </span>
                                  <span className="font-medium">{h.field === "assignedTo" ? "assignee" : h.field.replace("_", " ")}</span>
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {h.oldValue && (
                                    <span className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 line-through">{h.oldValue}</span>
                                  )}
                                  <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 font-medium">{h.newValue}</span>
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5">{timeAgo(h.createdAt)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-gray-400">No activity history</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Manage Ticket</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">Status</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["open", "in_progress", "resolved", "closed"] as const).map((s) => {
                    const cfg = statusConfig[s];
                    const active = ticket.status === s;
                    return (
                      <button key={s} onClick={() => !active && updateTicket({ status: s })} disabled={updating}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? `${cfg.bg} shadow-sm`
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${active ? cfg.dot : "bg-gray-300"}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-2">Priority</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["critical", "high", "medium", "low"] as const).map((p) => {
                    const cfg = priorityConfig[p];
                    const active = ticket.priority === p;
                    return (
                      <button key={p} onClick={() => !active && updateTicket({ priority: p })} disabled={updating}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          active
                            ? `${cfg.bg} shadow-sm`
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${active ? cfg.dot : "bg-gray-300"}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Merge into another ticket */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5">
              {mergeOpen ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 font-medium">Merge this ticket into:</p>
                  <input
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    placeholder="Paste primary ticket URL or ID"
                    className="w-full text-sm rounded-md border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <textarea
                    value={mergeReason}
                    onChange={(e) => setMergeReason(e.target.value)}
                    rows={2}
                    placeholder="Reason (optional — stored as internal note)"
                    className="w-full text-sm rounded-md border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {mergeError && <p className="text-xs text-red-600">{mergeError}</p>}
                  <p className="text-[11px] text-gray-500">
                    Comments and attachments move to the primary. This ticket gets closed with a
                    public comment pointing there.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={performMerge}
                      disabled={merging || !mergeTargetId.trim()}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {merging ? "Merging…" : "Merge"}
                    </button>
                    <button
                      onClick={() => { setMergeOpen(false); setMergeTargetId(""); setMergeReason(""); setMergeError(null); }}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setMergeOpen(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Merge duplicate…
                </button>
              )}
            </div>
          </div>

          {/* Delete Ticket */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5">
              {deleteTicketConfirm ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-red-700 font-medium">Delete this ticket and all its comments, attachments, and history? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDeleteTicket} disabled={deletingTicket}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all">
                      {deletingTicket ? "Deleting..." : "Yes, Delete"}
                    </button>
                    <button onClick={() => setDeleteTicketConfirm(false)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDeleteTicketConfirm(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-all">
                  Delete Ticket
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</h3>
            </div>
            <div className="p-5 space-y-4">
              {/* SLA */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">SLA Deadline</label>
                {slaBreach ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-red-600">Breached</span>
                    <span className="text-xs text-red-400">{new Date(ticket.slaDeadline!).toLocaleString()}</span>
                  </div>
                ) : ticket.slaDeadline ? (
                  <div>
                    <p className="text-sm text-gray-700 font-medium">{new Date(ticket.slaDeadline).toLocaleString()}</p>
                    {slaRemaining && <p className="text-xs text-sky-600 mt-0.5">{slaRemaining}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Not set</p>
                )}
              </div>

              {/* Assignee */}
              <div className="relative">
                <label className="text-xs font-medium text-gray-400 block mb-1">Assignee</label>
                <button onClick={() => setAssignDropdownOpen((o) => !o)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
                  {ticket.assignee ? (
                    <>
                      <Avatar name={ticket.assignee.name} size={22} />
                      <span className="text-sm font-medium text-gray-700 flex-1">{ticket.assignee.name}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-[22px] h-[22px] rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-400 italic flex-1">Unassigned</span>
                    </>
                  )}
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {assignDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    <button onClick={() => { updateTicket({ assignedTo: "" }); setAssignDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-100">
                      <div className="w-[22px] h-[22px] rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-500">Unassign</span>
                    </button>
                    {admins.map((a) => (
                      <button key={a.id} onClick={() => {
                        if (ticket.assignedTo === a.id) {
                          setAssignDropdownOpen(false);
                          return;
                        }
                        // Different admin → stage the reassignment so the user
                        // can attach a handoff note before it's committed.
                        setPendingAssignee({ id: a.id, name: a.name });
                        setAssignDropdownOpen(false);
                      }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 text-left ${ticket.assignedTo === a.id ? "bg-blue-50" : ""}`}>
                        <Avatar name={a.name} avatarUrl={a.avatarUrl} size={22} />
                        <span className="text-sm text-gray-700">{a.name}</span>
                        {ticket.assignedTo === a.id && (
                          <svg className="w-3.5 h-3.5 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Handoff confirmation panel */}
                {pendingAssignee && (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <div className="text-xs text-gray-600">
                      Handing off to <span className="font-semibold text-gray-900">{pendingAssignee.name}</span>
                    </div>
                    <textarea
                      value={handoffNote}
                      onChange={(e) => setHandoffNote(e.target.value)}
                      rows={2}
                      placeholder="Context for the new assignee (optional)…"
                      className="w-full text-sm rounded-md border border-blue-200 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={confirmReassign}
                        disabled={updating}
                        className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >Reassign</button>
                      <button
                        onClick={() => { setPendingAssignee(null); setHandoffNote(""); }}
                        className="px-3 py-1.5 rounded-md text-xs text-gray-600 hover:bg-blue-100"
                      >Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* App */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Application</label>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white">
                    {ticket.app.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{ticket.app.name}</span>
                </div>
              </div>

              {/* Created */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Created</label>
                <p className="text-sm text-gray-700">{new Date(ticket.createdAt).toLocaleString()}</p>
              </div>

              {/* Updated */}
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Last Updated</label>
                <p className="text-sm text-gray-700">{new Date(ticket.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Submitted by */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reporter</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={ticket.user.name} avatarUrl={ticket.user.avatarUrl} size={44} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{ticket.user.name}</p>
                  <p className="text-xs text-gray-500">{ticket.user.email}</p>
                </div>
              </div>
              <Link to={`/users?id=${ticket.user.id}`}
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
