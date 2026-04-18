package com.feedbacksdk.internal

import android.content.Context
import android.content.SharedPreferences

/**
 * Local "last seen" tracking for tickets and feedback. Lives in SharedPreferences
 * and does not sync across devices or survive app-data clears — matching the
 * "client-only, no server changes" constraint the consumer asked for.
 *
 * Tickets compare against the server's `updatedAt` timestamp. Feedback compares
 * against reply count (the server doesn't expose `updatedAt` on feedback today).
 */
internal object UnreadStore {

    private const val PREFS = "feedbacksdk_unread"
    private const val KEY_TICKET_SEEN_PREFIX = "ticket_seen_"         // suffix: ticketId → updatedAt string
    private const val KEY_FEEDBACK_SEEN_PREFIX = "feedback_seen_"     // suffix: feedbackId → reply count int
    private const val KEY_ANNOUNCEMENT_SEEN = "announcement_seen_at"  // highest createdAt seen

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    // ── Tickets ──

    fun isTicketUnread(ticketId: String, ticketUpdatedAt: String): Boolean {
        val seen = prefs.getString(KEY_TICKET_SEEN_PREFIX + ticketId, null)
            // First time we see this ticket — treat as read. Avoids "everything
            // unread" on first install; we seed immediately.
            ?: run {
                markTicketSeen(ticketId, ticketUpdatedAt)
                return false
            }
        return seen < ticketUpdatedAt
    }

    fun markTicketSeen(ticketId: String, ticketUpdatedAt: String) {
        prefs.edit().putString(KEY_TICKET_SEEN_PREFIX + ticketId, ticketUpdatedAt).apply()
    }

    // ── Feedback ──

    fun isFeedbackUnread(feedbackId: String, currentReplyCount: Int): Boolean {
        val key = KEY_FEEDBACK_SEEN_PREFIX + feedbackId
        if (!prefs.contains(key)) {
            markFeedbackSeen(feedbackId, currentReplyCount)
            return false
        }
        val seen = prefs.getInt(key, 0)
        return currentReplyCount > seen
    }

    fun markFeedbackSeen(feedbackId: String, currentReplyCount: Int) {
        prefs.edit().putInt(KEY_FEEDBACK_SEEN_PREFIX + feedbackId, currentReplyCount).apply()
    }

    // ── Announcements ──
    //
    // Per-device unread tracking: we store the ISO timestamp of the newest
    // announcement the user has viewed. A list is "has unread" if any item's
    // createdAt is greater than that stored value.

    fun lastAnnouncementSeenAt(): String? = prefs.getString(KEY_ANNOUNCEMENT_SEEN, null)

    fun markAnnouncementsSeenUpTo(createdAtIso: String) {
        val prev = prefs.getString(KEY_ANNOUNCEMENT_SEEN, null)
        if (prev == null || createdAtIso > prev) {
            prefs.edit().putString(KEY_ANNOUNCEMENT_SEEN, createdAtIso).apply()
        }
    }

    /** Wipe everything — useful on logout. */
    fun clear() {
        if (::prefs.isInitialized) prefs.edit().clear().apply()
    }
}
