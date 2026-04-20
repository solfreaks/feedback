import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import Avatar from "../components/Avatar";

interface FeedbackAttachment {
  id: string;
  feedbackReplyId?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface FeedbackFull {
  id: string;
  rating: number;
  category: string;
  status: string;
  comment?: string;
  deviceType?: string;
  osVersion?: string;
  appVersion?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
  app: { id: string; name: string };
  replies: { id: string; body: string; createdAt: string; user: { id: string; name: string; avatarUrl?: string }; attachments?: FeedbackAttachment[] }[];
  attachments?: FeedbackAttachment[];
}

const categoryLabels: Record<string, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  suggestion: "Suggestion",
  complaint: "Complaint",
  general: "General",
};
const categoryColors: Record<string, string> = {
  bug_report: "bg-red-100 text-red-700 ring-1 ring-red-200",
  feature_request: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  suggestion: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
  complaint: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
  general: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

const statusLabels: Record<string, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const statusColors: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300",
  acknowledged: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  in_progress: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
  resolved: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
};
const statusIcons: Record<string, string> = {
  new: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z",
  acknowledged: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  in_progress: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182",
  resolved: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};


function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-5 h-5 ${s <= rating ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

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

function getSentiment(rating: number, category: string) {
  if (rating >= 4) return { label: "Positive", color: "text-emerald-600 bg-emerald-50", emoji: "Satisfied user", icon: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" };
  if (rating === 3) return { label: "Neutral", color: "text-amber-600 bg-amber-50", emoji: "Mixed feelings", icon: "M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zM9 15h6" };
  if (category === "complaint" || category === "bug_report") return { label: "Negative", color: "text-red-600 bg-red-50", emoji: "Needs attention", icon: "M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" };
  return { label: "Negative", color: "text-red-600 bg-red-50", emoji: "Unsatisfied user", icon: "M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" };
}

function getResponseTime(createdAt: string, replies: { createdAt: string }[]) {
  if (replies.length === 0) return null;
  const created = new Date(createdAt).getTime();
  const firstReply = new Date(replies[0].createdAt).getTime();
  const diff = firstReply - created;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}


export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const [feedback, setFeedback] = useState<FeedbackFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteFeedbackConfirm, setDeleteFeedbackConfirm] = useState(false);
  const [deletingFeedback, setDeletingFeedback] = useState(false);
  const [deleteReplyId, setDeleteReplyId] = useState<string | null>(null);
  const [deletingReply, setDeletingReply] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [cannedReplies, setCannedReplies] = useState<{ id: string; title: string; body: string }[]>([]);
  const [cannedLocale, setCannedLocale] = useState("");
  const [admins, setAdmins] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const params = cannedLocale ? `?locale=${cannedLocale}` : "";
    api.get(`/admin/canned-replies${params}`).then(r => setCannedReplies(r.data)).catch(() => {});
  }, [cannedLocale]);

  useEffect(() => {
    api.get("/admin/admins").then(r => setAdmins(r.data)).catch(() => {});
  }, []);

  const detectMention = (value: string, caret: number) => {
    const match = /@([a-zA-Z0-9._-]*)$/.exec(value.slice(0, caret));
    if (match) { setMentionQuery(match[1].toLowerCase()); setMentionActiveIdx(0); }
    else setMentionQuery(null);
  };

  const insertMention = (admin: { id: string; name: string }) => {
    const el = replyRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? reply.length;
    const replaced = reply.slice(0, caret).replace(/@([a-zA-Z0-9._-]*)$/, `@${admin.name.split(" ")[0]} `);
    const next = replaced + reply.slice(caret);
    setReply(next);
    setMentionQuery(null);
    setTimeout(() => { el.focus(); el.setSelectionRange(replaced.length, replaced.length); }, 0);
  };

  const mentionCandidates = mentionQuery !== null
    ? [
        // feedback submitter first
        ...(feedback?.user ? [{ id: feedback.user.id, name: feedback.user.name, avatarUrl: feedback.user.avatarUrl, isUser: true }] : []),
        ...admins.map(a => ({ ...a, isUser: false })),
      ].filter(a =>
        mentionQuery === "" ||
        a.name.toLowerCase().includes(mentionQuery) ||
        a.name.split(" ")[0].toLowerCase().startsWith(mentionQuery)
      ).slice(0, 7)
    : [];

  const fetchFeedback = () => {
    api.get(`/admin/feedbacks/${id}`).then((r) => { setFeedback(r.data); setLoading(false); });
  };

  useEffect(() => { fetchFeedback(); }, [id]);

  const sendReply = async () => {
    if (!reply.trim() && pendingFiles.length === 0) return;
    setSending(true);
    const res = await api.post(`/admin/feedbacks/${id}/reply`, { body: reply || " " });
    const replyId = res.data?.id;
    if (replyId && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("replyId", replyId);
        await api.post(`/admin/feedbacks/${id}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
    }
    setReply("");
    setPendingFiles([]);
    setSending(false);
    fetchFeedback();
  };

  const updateStatus = async (status: string) => {
    setUpdatingStatus(true);
    try {
      const { data } = await api.patch(`/admin/feedbacks/${id}/status`, { status });
      setFeedback((prev) => prev ? { ...prev, status: data.status } : prev);
    } catch { /* ignore */ }
    setUpdatingStatus(false);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/admin/feedbacks/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setUploading(false);
    fetchFeedback();
  };

  const handleDeleteFeedback = async () => {
    setDeletingFeedback(true);
    try {
      await api.delete(`/admin/feedbacks/${id}`);
      navigate("/feedbacks");
    } catch {
      setDeletingFeedback(false);
      setDeleteFeedbackConfirm(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    setDeletingReply(true);
    try {
      await api.delete(`/admin/feedbacks/${id}/replies/${replyId}`);
      setDeleteReplyId(null);
      fetchFeedback();
    } catch {
      /* ignore */
    } finally {
      setDeletingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!feedback) return <div className="p-8 text-center text-red-500">Feedback not found</div>;

  const isImage = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  };

  const sentiment = getSentiment(feedback.rating, feedback.category);
  const responseTime = getResponseTime(feedback.createdAt, feedback.replies);

  return (
    <div className="max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/feedbacks" className="hover:text-gray-600 transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Feedbacks
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Feedback from {feedback.user.name}</span>
      </div>

      {/* Status + Sentiment Banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-4">
        {/* Status selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</span>
          <div className="flex gap-1">
            {Object.entries(statusLabels).map(([key, label]) => (
              <button key={key} onClick={() => updateStatus(key)} disabled={updatingStatus}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  feedback.status === key
                    ? statusColors[key] + " border-transparent"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={statusIcons[key]} />
                </svg>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden sm:block w-px h-8 bg-gray-200" />

        {/* Sentiment */}
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sentiment.color}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={sentiment.icon} />
            </svg>
            {sentiment.label}
          </div>
          <span className="text-xs text-gray-400">{sentiment.emoji}</span>
        </div>

        {responseTime && (
          <>
            <div className="hidden sm:block w-px h-8 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>First response: <strong className="text-gray-700">{responseTime}</strong></span>
            </div>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Main content */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Feedback Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* Header badges */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${categoryColors[feedback.category] || "bg-gray-100 text-gray-600"}`}>
                {categoryLabels[feedback.category] || feedback.category}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 ring-1 ring-gray-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {feedback.app.name}
              </span>
              <span className="text-xs text-gray-400">{timeAgo(feedback.createdAt)}</span>
            </div>

            {/* Rating with sentiment bar */}
            <div className="flex items-center gap-3 mb-4">
              <Stars rating={feedback.rating} />
              <span className="text-lg font-bold text-gray-900">{feedback.rating}/5</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden ml-2">
                <div className={`h-full rounded-full transition-all ${
                  feedback.rating >= 4 ? "bg-emerald-400" : feedback.rating === 3 ? "bg-amber-400" : "bg-red-400"
                }`} style={{ width: `${(feedback.rating / 5) * 100}%` }} />
              </div>
            </div>

            {/* Comment */}
            {feedback.comment ? (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{feedback.comment}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
                <p className="text-sm text-gray-400 italic">No comment provided</p>
              </div>
            )}

            {/* Attachments */}
            <div className="mt-4">
              {feedback.attachments && feedback.attachments.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Attachments ({feedback.attachments.length})
                  </p>
                  {feedback.attachments.filter(a => isImage(a.fileName)).length > 0 && (
                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 mb-2">
                      {feedback.attachments.filter(a => isImage(a.fileName)).map((a) => (
                        <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                          <img src={`/api${a.fileUrl}`} alt={a.fileName}
                            className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {feedback.attachments.filter(a => !isImage(a.fileName)).map((a) => (
                      <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors group">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="text-sm font-medium text-blue-700">{a.fileName}</span>
                        <span className="text-xs text-blue-400">{(a.fileSize / 1024).toFixed(0)} KB</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

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

          {/* Replies */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Replies
                {feedback.replies.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">{feedback.replies.length}</span>
                )}
              </h2>
            </div>

            <div className="p-6">
              {feedback.replies.length > 0 ? (
                <div className="space-y-1">
                  {feedback.replies.map((r, i) => (
                    <div key={r.id} className="group/reply flex gap-3 pb-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <Avatar name={r.user.name} avatarUrl={r.user.avatarUrl} size={32} />
                        {i < feedback.replies.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 mt-2" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-gray-900">{r.user.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Admin</span>
                          <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                          {deleteReplyId === r.id ? (
                            <span className="flex items-center gap-1 ml-auto">
                              <button onClick={() => handleDeleteReply(r.id)} disabled={deletingReply}
                                className="text-xs text-red-600 hover:text-red-700 font-medium">
                                {deletingReply ? "..." : "Confirm"}
                              </button>
                              <button onClick={() => setDeleteReplyId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 font-medium">Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteReplyId(r.id)}
                              className="ml-auto opacity-0 group-hover/reply:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                              title="Delete reply">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
                        </div>
                        {/* Per-reply attachments */}
                        {(() => {
                          const replyAtts = feedback.attachments?.filter(a => a.feedbackReplyId === r.id) || [];
                          if (replyAtts.length === 0) return null;
                          return (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {replyAtts.map(a => (
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
                <div className="text-center py-6">
                  <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <p className="text-sm text-gray-400">No replies yet</p>
                  <p className="text-xs text-gray-300 mt-1">Use a quick reply or write a custom response</p>
                </div>
              )}

              {/* Reply form */}
              <div className="mt-5 pt-5 border-t border-gray-200">
                {/* Quick replies toggle */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                      <svg className={`w-4 h-4 transition-transform ${showQuickReplies ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                      Quick Replies
                    </button>
                    {showQuickReplies && (
                      <select value={cannedLocale} onChange={e => setCannedLocale(e.target.value)}
                        className="text-xs border border-gray-200 rounded-md px-2 py-0.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                        <option value="">All languages</option>
                        <option value="en">🇬🇧 English</option>
                        <option value="es">🇪🇸 Spanish</option>
                        <option value="fr">🇫🇷 French</option>
                        <option value="de">🇩🇪 German</option>
                        <option value="ar">🇸🇦 Arabic</option>
                        <option value="ur">🇵🇰 Urdu</option>
                      </select>
                    )}
                  </div>

                  {showQuickReplies && (
                    <div className="mt-2">
                      {cannedReplies.length === 0 ? (
                        <div className="text-xs text-gray-400 py-2">
                          No quick replies saved. <a href="/settings" className="text-blue-500 hover:underline" onClick={e => { e.preventDefault(); navigate("/settings"); }}>Add some in Settings → Quick Replies</a>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                          {cannedReplies.map((qr) => (
                            <button key={qr.id} onClick={() => { setReply(qr.body.replace(/\{\{user\}\}/gi, feedback?.user?.name || "there")); setShowQuickReplies(false); }}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-all group">
                              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                              </span>
                              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">{qr.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white relative">
                  <textarea
                    ref={replyRef}
                    value={reply}
                    onChange={(e) => { setReply(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
                    onKeyDown={(e) => {
                      if (mentionQuery === null || mentionCandidates.length === 0) return;
                      if (e.key === "ArrowDown") { e.preventDefault(); setMentionActiveIdx(i => Math.min(i + 1, mentionCandidates.length - 1)); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setMentionActiveIdx(i => Math.max(i - 1, 0)); }
                      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionActiveIdx]); }
                      else if (e.key === "Escape") setMentionQuery(null);
                    }}
                    placeholder="Write a reply to this feedback... (type @ to mention an admin)"
                    className="w-full p-4 text-sm rounded-t-xl resize-none outline-none placeholder-gray-400"
                    rows={3} />
                  {mentionQuery !== null && mentionCandidates.length > 0 && (
                    <div className="absolute left-4 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[220px] overflow-hidden">
                      {mentionCandidates.map((a, i) => (
                        <button key={a.id} onClick={() => insertMention(a)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${i === mentionActiveIdx ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`}>
                          <Avatar name={a.name} avatarUrl={a.avatarUrl} size={20} />
                          <span className="flex-1">{a.name}</span>
                          {a.isUser && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full font-medium">User</span>}
                          {!a.isUser && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">Admin</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Pending file chips */}
                  {pendingFiles.length > 0 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5">
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
                      {/* File picker */}
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 cursor-pointer transition-colors" title="Attach file">
                        <input ref={replyFileRef} type="file" className="hidden" multiple
                          onChange={(e) => {
                            if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                            e.target.value = "";
                          }} />
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}` : "Attach"}
                      </label>
                      {reply.length > 0 && <span className="text-xs text-gray-400">{reply.length} chars</span>}
                      {reply.trim() && (
                        <button onClick={() => setReply("")}
                          className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
                          Clear
                        </button>
                      )}
                    </div>
                    <button onClick={sendReply} disabled={sending || (!reply.trim() && pendingFiles.length === 0)}
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
                          Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-5">
          {/* Submitted by */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={feedback.user.name} avatarUrl={feedback.user.avatarUrl} size={44} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{feedback.user.name}</p>
                  <p className="text-xs text-gray-500">{feedback.user.email}</p>
                </div>
              </div>
              <Link to={`/users?id=${feedback.user.id}`}
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </Link>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</h3>
            </div>
            <div className="p-5 space-y-3">
              {/* Only keep fields NOT already visible on the top banner or
                  the feedback card. Rating / sentiment / status / category /
                  app / response time are all above — don't duplicate them. */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Submitted</span>
                <span className="font-medium text-gray-700">{new Date(feedback.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Replies</span>
                <span className="font-medium text-gray-700">{feedback.replies.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Attachments</span>
                <span className="font-medium text-gray-700">{feedback.attachments?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Device Info */}
          {(feedback.deviceType || feedback.osVersion || feedback.appVersion) && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Device Info</h3>
              </div>
              <div className="p-5 space-y-3">
                {feedback.deviceType && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Device
                    </span>
                    <span className="font-medium text-gray-700 capitalize">{feedback.deviceType}</span>
                  </div>
                )}
                {feedback.osVersion && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                      </svg>
                      OS Version
                    </span>
                    <span className="font-medium text-gray-700">{feedback.osVersion}</span>
                  </div>
                )}
                {feedback.appVersion && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                      </svg>
                      App Version
                    </span>
                    <span className="font-medium text-gray-700">v{feedback.appVersion}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h3>
            </div>
            <div className="p-3 space-y-1">
              {feedback.status !== "acknowledged" && (
                <button onClick={() => updateStatus("acknowledged")} disabled={updatingStatus}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Mark as Acknowledged
                </button>
              )}
              {feedback.status !== "in_progress" && (
                <button onClick={() => updateStatus("in_progress")} disabled={updatingStatus}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Mark as In Progress
                </button>
              )}
              {feedback.status !== "resolved" && (
                <button onClick={() => updateStatus("resolved")} disabled={updatingStatus}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mark as Resolved
                </button>
              )}
              {cannedReplies.length > 0 && (
                <button onClick={() => { setReply(cannedReplies[0].body.replace(/\{\{user\}\}/gi, feedback?.user?.name || "there")); setShowQuickReplies(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  {cannedReplies[0].title}
                </button>
              )}
            </div>
          </div>

          {/* Delete Feedback */}
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-red-50 border-b border-red-200">
              <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider">Danger Zone</h3>
            </div>
            <div className="p-5">
              {!deleteFeedbackConfirm ? (
                <button onClick={() => setDeleteFeedbackConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Feedback
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-red-600">This will permanently delete this feedback, all replies, and attachments.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDeleteFeedback} disabled={deletingFeedback}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {deletingFeedback ? "Deleting..." : "Confirm"}
                    </button>
                    <button onClick={() => setDeleteFeedbackConfirm(false)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
