import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import Avatar from "../components/Avatar";

interface FeedbackAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface FeedbackFull {
  id: string;
  rating: number;
  category: string;
  comment?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
  app: { id: string; name: string };
  replies: { id: string; body: string; createdAt: string; user: { id: string; name: string; avatarUrl?: string } }[];
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


export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const [feedback, setFeedback] = useState<FeedbackFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchFeedback = () => {
    api.get(`/admin/feedbacks/${id}`).then((r) => { setFeedback(r.data); setLoading(false); });
  };

  useEffect(() => { fetchFeedback(); }, [id]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    await api.post(`/admin/feedbacks/${id}/reply`, { body: reply });
    setReply("");
    setSending(false);
    fetchFeedback();
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

  return (
    <div className="max-w-4xl">
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
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

            {/* Rating */}
            <div className="flex items-center gap-3 mb-4">
              <Stars rating={feedback.rating} />
              <span className="text-lg font-bold text-gray-900">{feedback.rating}/5</span>
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
                  {/* Image previews */}
                  {feedback.attachments.filter(a => isImage(a.fileName)).length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {feedback.attachments.filter(a => isImage(a.fileName)).map((a) => (
                        <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                          <img src={`/api${a.fileUrl}`} alt={a.fileName}
                            className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {/* Non-image files */}
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

              {/* Upload button */}
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
                    <div key={r.id} className="flex gap-3 pb-4">
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
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
                        </div>
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
                  <p className="text-xs text-gray-300 mt-1">Be the first to respond</p>
                </div>
              )}

              {/* Reply form */}
              <div className="mt-5 pt-5 border-t border-gray-200">
                <div className="rounded-xl border border-gray-200 bg-white">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply to this feedback..."
                    className="w-full p-4 text-sm rounded-t-xl resize-none outline-none placeholder-gray-400"
                    rows={3} />
                  <div className="flex items-center justify-end px-4 py-3 border-t border-gray-100">
                    <button onClick={sendReply} disabled={sending || !reply.trim()}
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
        <div className="space-y-5">
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Rating</span>
                <div className="flex items-center gap-1.5">
                  <Stars rating={feedback.rating} />
                  <span className="font-bold text-gray-900">{feedback.rating}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Category</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${categoryColors[feedback.category] || ""}`}>
                  {categoryLabels[feedback.category] || feedback.category}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Application</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[8px] font-bold text-white">
                    {feedback.app.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-700">{feedback.app.name}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Attachments</span>
                <span className="font-medium text-gray-700">{feedback.attachments?.length || 0} files</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Replies</span>
                <span className="font-medium text-gray-700">{feedback.replies.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Submitted</span>
                <span className="font-medium text-gray-700">{new Date(feedback.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
