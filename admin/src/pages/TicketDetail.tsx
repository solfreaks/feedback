import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import type { Ticket } from "../types";
import Avatar from "../components/Avatar";

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

  const fetchTicket = () => {
    api.get(`/admin/tickets/${id}`).then((r) => { setTicket(r.data); setLoading(false); });
  };

  useEffect(() => { fetchTicket(); }, [id]);

  const updateTicket = async (updates: Record<string, string>) => {
    setUpdating(true);
    await api.patch(`/admin/tickets/${id}`, updates);
    fetchTicket();
    setUpdating(false);
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    await api.post(`/admin/tickets/${id}/notes`, { body: comment, isInternalNote: isInternal });
    setComment("");
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
                              <p className="whitespace-pre-wrap">{c.body}</p>
                            </div>
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
                    <div className={`rounded-xl border transition-colors ${
                      isInternal ? "border-amber-300 bg-amber-50/50" : "border-gray-200 bg-white"
                    }`}>
                      <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                        placeholder={isInternal ? "Write an internal note (only visible to admins)..." : "Write a reply to the user..."}
                        className={`w-full p-4 text-sm rounded-t-xl resize-none outline-none bg-transparent ${
                          isInternal ? "placeholder-amber-400" : "placeholder-gray-400"
                        }`}
                        rows={3} />
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
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
                        <button onClick={addComment} disabled={sending || !comment.trim()}
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
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Assignee</label>
                {ticket.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={ticket.assignee.name} size={24} />
                    <span className="text-sm font-medium text-gray-700">{ticket.assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 italic">Unassigned</span>
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
