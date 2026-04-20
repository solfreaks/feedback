package com.feedbacksdk

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import com.feedbacksdk.api.ApiClient
import com.feedbacksdk.internal.ConnectivityMonitor
import com.feedbacksdk.internal.DraftStore
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.SdkWebSocket
import com.feedbacksdk.internal.TokenStore
import com.feedbacksdk.internal.UnreadStore
import com.feedbacksdk.internal.toResult
import com.feedbacksdk.models.*
import android.os.Build
import com.feedbacksdk.ui.AttachmentViewerActivity
import com.feedbacksdk.ui.NotificationsActivity
import com.feedbacksdk.ui.FeedbackActivity
import com.feedbacksdk.ui.FeedbackDetailActivity
import com.feedbacksdk.ui.FeedbackListActivity
import com.feedbacksdk.ui.TicketDetailActivity
import com.feedbacksdk.ui.TicketListActivity
import com.feedbacksdk.ui.CreateTicketActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

object FeedbackSDK {

    private var initialized = false
    private var googleClientId: String? = null
    private lateinit var appContext: Context
    // Stored so the FCM service can subscribe to the matching announcements
    // topic when a device token is registered. Null => topic subscription is
    // skipped (consumer didn't pass an appId, or opted out).
    internal var appId: String? = null
        private set
    // Consumer opt-out for topic subscription. Defaults true when an appId is
    // provided; a consumer that manages FCM topics manually can call
    // [setAutoSubscribeAnnouncements] to disable.
    private var autoSubscribeAnnouncements: Boolean = true

    /**
     * Initialize the SDK. Call this in Application.onCreate() or before any SDK usage.
     *
     * @param context Application context
     * @param baseUrl Your feedback server URL (e.g. "https://feedback.example.com")
     * @param apiKey Your app's API key from the admin panel
     * @param appId Your app's ID from the admin panel — required only if you
     *   want to receive announcement broadcasts via FCM topic. When provided,
     *   the SDK subscribes the device to `app_<appId>` on FCM token register.
     * @param googleClientId Google OAuth client ID for sign-in (optional if set in admin panel)
     * @param debug Enable HTTP request/response logging
     */
    fun initialize(
        context: Context,
        baseUrl: String,
        apiKey: String,
        appId: String? = null,
        googleClientId: String? = null,
        debug: Boolean = false
    ) {
        appContext = context.applicationContext
        TokenStore.init(context.applicationContext)
        UnreadStore.init(context.applicationContext)
        DraftStore.init(context.applicationContext)
        ConnectivityMonitor.init(context.applicationContext)
        ApiClient.initialize(baseUrl, apiKey, debug)
        this.googleClientId = googleClientId
        this.appId = appId

        // Restore saved token
        TokenStore.authToken?.let {
            ApiClient.authToken = it
            // Restore a live socket if the user was already signed in.
            SdkWebSocket.connect()
        }

        // Subscribe to the app's announcement topic if FCM is on the classpath
        // and the consumer provided an appId. Silently no-ops if FCM isn't
        // included (it's a compileOnly dep).
        maybeSubscribeAnnouncementTopic()

        initialized = true
    }

    /**
     * Opt in/out of automatic FCM topic subscription for announcements.
     * Default is true. Takes effect on the next [initialize] call.
     */
    fun setAutoSubscribeAnnouncements(enabled: Boolean) {
        autoSubscribeAnnouncements = enabled
    }

    internal fun maybeSubscribeAnnouncementTopic() {
        val id = appId ?: return
        if (!autoSubscribeAnnouncements) return
        // Reflectively call FirebaseMessaging.subscribeToTopic so this compiles
        // when the host app doesn't include firebase-messaging at runtime.
        try {
            val fmClass = Class.forName("com.google.firebase.messaging.FirebaseMessaging")
            val getInstance = fmClass.getMethod("getInstance")
            val instance = getInstance.invoke(null)
            val subscribe = fmClass.getMethod("subscribeToTopic", String::class.java)
            subscribe.invoke(instance, "app_$id")
        } catch (_: Throwable) {
            // firebase-messaging not on the classpath, or not initialized yet.
            // The FeedbackFirebaseService retries the subscription whenever a
            // new token lands, so this is best-effort and self-healing.
        }
    }

    // ── Auth ──

    /** Check if user is currently logged in */
    val isLoggedIn: Boolean
        get() {
            checkInit()
            return TokenStore.isLoggedIn
        }

    /** Get the currently logged in user, or null */
    val currentUser: User?
        get() {
            checkInit()
            return TokenStore.currentUser
        }

    /**
     * Get Google Sign-In intent. Launch this with an ActivityResultLauncher,
     * then pass the result to [handleGoogleSignInResult].
     */
    fun getGoogleSignInIntent(activity: Activity): Intent {
        checkInit()
        val clientId = googleClientId ?: throw IllegalStateException(
            "Google Client ID not set. Pass it in FeedbackSDK.initialize() or configure it in the admin panel."
        )
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(clientId)
            .requestEmail()
            .build()
        val client = GoogleSignIn.getClient(activity, gso)
        return client.signInIntent
    }

    /**
     * Handle the result from Google Sign-In.
     * Call this from your ActivityResultLauncher callback.
     */
    suspend fun handleGoogleSignInResult(data: Intent?): SdkResult<AuthResponse> {
        checkInit()
        return try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.result
            val idToken = account.idToken ?: return SdkResult.Error("Failed to get ID token")

            val response = ApiClient.getApi().googleSignIn(mapOf("idToken" to idToken))
            val result = response.toResult()

            if (result is SdkResult.Success) {
                TokenStore.authToken = result.data.token
                TokenStore.currentUser = result.data.user
                ApiClient.authToken = result.data.token
                SdkWebSocket.connect()
            }

            result
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Google sign-in failed")
        }
    }

    /**
     * Set auth token directly (if you handle authentication yourself).
     */
    fun setAuthToken(token: String, user: User? = null) {
        checkInit()
        TokenStore.authToken = token
        TokenStore.currentUser = user
        ApiClient.authToken = token
        SdkWebSocket.connect()
    }

    /** Log out and clear stored credentials */
    fun logout() {
        checkInit()
        TokenStore.clear()
        UnreadStore.clear()
        ApiClient.authToken = null
        SdkWebSocket.disconnect()
    }

    // ── Tickets ──

    /** Create a new support ticket */
    suspend fun createTicket(
        title: String,
        description: String,
        category: String? = null,
        priority: String = "medium"
    ): SdkResult<Ticket> {
        checkInit()
        return try {
            val response = ApiClient.getApi().createTicket(
                CreateTicketRequest(title, description, category, priority)
            )
            response.toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to create ticket")
        }
    }

    /** List current user's tickets */
    suspend fun listTickets(page: Int = 1, limit: Int = 20): SdkResult<TicketListResponse> {
        checkInit()
        return try {
            ApiClient.getApi().listTickets(page, limit).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to list tickets")
        }
    }

    /** Get ticket details */
    suspend fun getTicket(ticketId: String): SdkResult<TicketDetail> {
        checkInit()
        return try {
            ApiClient.getApi().getTicket(ticketId).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to get ticket")
        }
    }

    /** Add a comment to a ticket */
    suspend fun addComment(ticketId: String, body: String): SdkResult<Comment> {
        checkInit()
        return try {
            ApiClient.getApi().addComment(ticketId, AddCommentRequest(body)).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to add comment")
        }
    }

    /**
     * Edit a comment the current user posted on a ticket. The server enforces
     * ownership and a 10-minute edit window; if either check fails an
     * [SdkResult.Error] is returned.
     */
    suspend fun editComment(ticketId: String, commentId: String, body: String): SdkResult<Comment> {
        checkInit()
        return try {
            ApiClient.getApi().editComment(ticketId, commentId, mapOf("body" to body)).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to edit comment")
        }
    }

    /** Delete a comment the current user posted. Same 10-minute window. */
    suspend fun deleteComment(ticketId: String, commentId: String): SdkResult<SuccessResponse> {
        checkInit()
        return try {
            ApiClient.getApi().deleteComment(ticketId, commentId).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to delete comment")
        }
    }

    /** Upload attachment to a ticket */
    suspend fun uploadTicketAttachment(ticketId: String, file: File): SdkResult<Attachment> {
        checkInit()
        return try {
            val part = filePart(file)
            ApiClient.getApi().uploadTicketAttachment(ticketId, part).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to upload attachment")
        }
    }

    /**
     * Edit the rating / category / comment of a feedback the current user
     * submitted. Only allowed within the server's 24h edit window. Pass null
     * for fields you don't want to change; `comment = ""` clears the comment.
     */
    suspend fun editFeedback(
        feedbackId: String,
        rating: Int? = null,
        category: String? = null,
        comment: String? = null,
    ): SdkResult<Feedback> {
        checkInit()
        return try {
            val body = buildMap<String, Any?> {
                if (rating != null) put("rating", rating)
                if (category != null) put("category", category)
                if (comment != null) put("comment", comment)
            }
            ApiClient.getApi().editFeedback(feedbackId, body).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to edit feedback")
        }
    }

    /**
     * Delete a feedback the current user submitted. Only allowed within the
     * server's 24h window.
     */
    suspend fun deleteFeedback(feedbackId: String): SdkResult<SuccessResponse> {
        checkInit()
        return try {
            ApiClient.getApi().deleteFeedback(feedbackId).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to delete feedback")
        }
    }

    /** Upload attachment to a feedback submission */
    suspend fun uploadFeedbackAttachment(feedbackId: String, file: File): SdkResult<Attachment> {
        checkInit()
        return try {
            val part = filePart(file)
            ApiClient.getApi().uploadFeedbackAttachment(feedbackId, part).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to upload attachment")
        }
    }

    /**
     * User reply on their own feedback, optionally with attachments. Replies
     * thread under the feedback detail and notify the assigned admin. Files
     * are streamed via multipart in the same request — no separate upload
     * step — which matches what the legacy PHP proxy expects.
     */
    suspend fun sendFeedbackReply(
        feedbackId: String,
        body: String,
        attachments: List<File> = emptyList(),
    ): SdkResult<FeedbackReply> {
        checkInit()
        return try {
            val bodyPart = body.toRequestBody("text/plain".toMediaTypeOrNull())
            val fileParts = attachments.map { file ->
                val rb = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
                MultipartBody.Part.createFormData("attachments", file.name, rb)
            }.ifEmpty { null }
            ApiClient.getApi().addFeedbackReply(feedbackId, bodyPart, fileParts).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to send reply")
        }
    }

    private fun filePart(file: File): MultipartBody.Part {
        val requestBody = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
        return MultipartBody.Part.createFormData("file", file.name, requestBody)
    }

    // ── Feedback ──

    /** Submit feedback/rating */
    suspend fun submitFeedback(
        rating: Int,
        category: String = "general",
        comment: String? = null
    ): SdkResult<Feedback> {
        checkInit()
        return try {
            val appVersion = try {
                appContext.packageManager.getPackageInfo(appContext.packageName, 0).versionName
            } catch (e: Exception) { null }
            ApiClient.getApi().submitFeedback(
                CreateFeedbackRequest(
                    rating = rating,
                    category = category,
                    comment = comment,
                    deviceType = "android",
                    osVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
                    appVersion = appVersion
                )
            ).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to submit feedback")
        }
    }

    /** List current user's feedbacks */
    suspend fun listFeedbacks(page: Int = 1, limit: Int = 20): SdkResult<FeedbackListResponse> {
        checkInit()
        return try {
            ApiClient.getApi().listFeedbacks(page, limit).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to list feedbacks")
        }
    }

    /** Get feedback detail with replies */
    suspend fun getFeedback(feedbackId: String): SdkResult<FeedbackDetail> {
        checkInit()
        return try {
            ApiClient.getApi().getFeedback(feedbackId).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to get feedback")
        }
    }

    // ── Device Token (FCM) ──

    /** Register FCM device token for push notifications */
    suspend fun registerDeviceToken(token: String): SdkResult<DeviceTokenResponse> {
        checkInit()
        return try {
            ApiClient.getApi().registerDeviceToken(
                DeviceTokenRequest(token, "android")
            ).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to register device token")
        }
    }

    /** Remove device token (call on logout) */
    suspend fun removeDeviceToken(token: String): SdkResult<SuccessResponse> {
        checkInit()
        return try {
            ApiClient.getApi().removeDeviceToken(mapOf("token" to token)).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to remove device token")
        }
    }

    // ── Pre-built UI ──

    /** Open the Create Ticket screen */
    fun openCreateTicket(activity: Activity) {
        checkInit()
        activity.startActivity(Intent(activity, CreateTicketActivity::class.java))
    }

    /** Open the Ticket List screen (user's tickets) */
    fun openTicketList(activity: Activity) {
        checkInit()
        activity.startActivity(Intent(activity, TicketListActivity::class.java))
    }

    /** Open a specific ticket's detail screen */
    fun openTicketDetail(activity: Activity, ticketId: String) {
        checkInit()
        activity.startActivity(
            Intent(activity, TicketDetailActivity::class.java).apply {
                putExtra("ticket_id", ticketId)
            }
        )
    }

    /** Open the Feedback submission screen */
    fun openFeedback(activity: Activity) {
        checkInit()
        activity.startActivity(Intent(activity, FeedbackActivity::class.java))
    }

    /** Open the Feedback List screen (user's past feedback submissions) */
    fun openFeedbackList(activity: Activity) {
        checkInit()
        activity.startActivity(Intent(activity, FeedbackListActivity::class.java))
    }

    /** Open a specific feedback's detail screen */
    fun openFeedbackDetail(activity: Activity, feedbackId: String) {
        checkInit()
        activity.startActivity(
            Intent(activity, FeedbackDetailActivity::class.java).apply {
                putExtra("feedback_id", feedbackId)
            }
        )
    }

    // ── Summary ──

    /**
     * Full activity snapshot for the signed-in user: totals and status breakdowns
     * for tickets and feedback, plus the unread counts computed locally. Intended
     * for a "My Support" landing screen before the user drills into either list.
     *
     * The server aggregates in a single round-trip; unread is derived from the
     * UnreadStore the SDK already maintains, so this method triggers the list
     * endpoints a second time to feed the diff.
     */
    suspend fun getSummary(): SdkResult<SupportSummary> {
        checkInit()
        return try {
            val serverResp = ApiClient.getApi().getSummary().toResult()
            if (serverResp is SdkResult.Error) return serverResp
            val server = (serverResp as SdkResult.Success).data

            val unread = getUnreadCounts()
            val unreadTickets = if (unread is SdkResult.Success) unread.data.tickets else 0
            val unreadFeedback = if (unread is SdkResult.Success) unread.data.feedback else 0

            SdkResult.Success(
                SupportSummary(
                    tickets = TicketSectionSummary(
                        total = server.tickets.total,
                        open = server.tickets.byStatus["open"] ?: 0,
                        inProgress = server.tickets.byStatus["in_progress"] ?: 0,
                        resolved = server.tickets.byStatus["resolved"] ?: 0,
                        closed = server.tickets.byStatus["closed"] ?: 0,
                        unread = unreadTickets,
                    ),
                    feedback = FeedbackSectionSummary(
                        total = server.feedback.total,
                        averageRating = server.feedback.averageRating,
                        new = server.feedback.byStatus["new"] ?: 0,
                        acknowledged = server.feedback.byStatus["acknowledged"] ?: 0,
                        inProgress = server.feedback.byStatus["in_progress"] ?: 0,
                        resolved = server.feedback.byStatus["resolved"] ?: 0,
                        unread = unreadFeedback,
                    ),
                )
            )
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to load summary")
        }
    }

    data class SupportSummary(
        val tickets: TicketSectionSummary,
        val feedback: FeedbackSectionSummary,
    )

    data class TicketSectionSummary(
        val total: Int,
        val open: Int,
        val inProgress: Int,
        val resolved: Int,
        val closed: Int,
        val unread: Int,
    )

    data class FeedbackSectionSummary(
        val total: Int,
        val averageRating: Double,
        val new: Int,
        val acknowledged: Int,
        val inProgress: Int,
        val resolved: Int,
        val unread: Int,
    )

    // ── Unread tracking (client-side only) ──

    /**
     * Unread summary for the currently signed-in user. Counts are computed
     * against the first page of each list endpoint — if either `ticketsHasMore`
     * or `feedbackHasMore` is true there could be unread items beyond the cap.
     * Per-item sets let the consumer highlight specific rows.
     */
    data class UnreadCounts(
        val tickets: Int,
        val feedback: Int,
        val unreadTicketIds: Set<String>,
        val unreadFeedbackIds: Set<String>,
        val ticketsHasMore: Boolean,
        val feedbackHasMore: Boolean,
    )

    /**
     * Compute unread counts by diffing the server's current list against what
     * the user has locally "seen". Tickets use `updatedAt` as the change signal;
     * feedback uses reply count. On the very first call per ticket / feedback,
     * it's treated as seen (no retroactive notifications on install).
     */
    suspend fun getUnreadCounts(limit: Int = 50): SdkResult<UnreadCounts> {
        checkInit()
        return try {
            val ticketResp = ApiClient.getApi().listTickets(page = 1, limit = limit).toResult()
            val feedbackResp = ApiClient.getApi().listFeedbacks(page = 1, limit = limit).toResult()

            if (ticketResp is SdkResult.Error) return ticketResp
            if (feedbackResp is SdkResult.Error) return feedbackResp

            val ticketList = (ticketResp as SdkResult.Success).data
            val feedbackList = (feedbackResp as SdkResult.Success).data

            val unreadTicketIds = ticketList.tickets
                .filter { UnreadStore.isTicketUnread(it.id, it.updatedAt) }
                .map { it.id }
                .toSet()

            val unreadFeedbackIds = feedbackList.feedbacks
                .filter { UnreadStore.isFeedbackUnread(it.id, it.count?.replies ?: 0) }
                .map { it.id }
                .toSet()

            SdkResult.Success(
                UnreadCounts(
                    tickets = unreadTicketIds.size,
                    feedback = unreadFeedbackIds.size,
                    unreadTicketIds = unreadTicketIds,
                    unreadFeedbackIds = unreadFeedbackIds,
                    ticketsHasMore = ticketList.totalPages > 1,
                    feedbackHasMore = feedbackList.totalPages > 1,
                )
            )
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to compute unread counts")
        }
    }

    /**
     * Manually mark a ticket as read. Called automatically when the user opens
     * TicketDetailActivity successfully; expose here for custom UIs.
     */
    fun markTicketRead(ticketId: String, updatedAt: String) {
        checkInit()
        UnreadStore.markTicketSeen(ticketId, updatedAt)
    }

    /**
     * Manually mark a feedback as read. [replyCount] must reflect the current
     * number of replies on the server so a future reply is correctly flagged.
     */
    fun markFeedbackRead(feedbackId: String, replyCount: Int) {
        checkInit()
        UnreadStore.markFeedbackSeen(feedbackId, replyCount)
    }

    // ── Notifications ──

    /**
     * Fetch the current user's notifications. Includes total, unreadCount,
     * and the page's notification list. Mentions, comment notifications,
     * status changes all flow through this endpoint.
     */
    suspend fun listNotifications(page: Int = 1, limit: Int = 20): SdkResult<NotificationListResponse> {
        checkInit()
        return try {
            ApiClient.getApi().listNotifications(page, limit).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to load notifications")
        }
    }

    suspend fun markNotificationRead(notificationId: String): SdkResult<SuccessResponse> {
        checkInit()
        return try {
            ApiClient.getApi().markNotificationRead(notificationId).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to mark notification read")
        }
    }

    suspend fun markAllNotificationsRead(): SdkResult<SuccessResponse> {
        checkInit()
        return try {
            ApiClient.getApi().markAllNotificationsRead().toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to mark notifications read")
        }
    }

    /**
     * Fetch just the unread notification count. Used by [ui.FeedbackBellView]
     * and by consumer apps that want to render their own bell widget.
     */
    suspend fun getUnreadNotificationCount(): SdkResult<Int> {
        checkInit()
        return try {
            when (val r = ApiClient.getApi().getUnreadNotificationCount().toResult()) {
                is SdkResult.Success -> SdkResult.Success(r.data.count)
                is SdkResult.Error -> r
            }
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to load unread count")
        }
    }

    /**
     * List developer announcements for this app. Poll on foreground; topic
     * subscriptions handle the live case via FCM push.
     */
    suspend fun listAnnouncements(): SdkResult<AnnouncementListResponse> {
        checkInit()
        return try {
            ApiClient.getApi().listAnnouncements().toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to load announcements")
        }
    }

    /** Open the pre-built notifications list. */
    fun openNotifications(activity: Activity) {
        checkInit()
        activity.startActivity(Intent(activity, NotificationsActivity::class.java))
    }

    /**
     * Open the built-in attachment viewer for a given attachment. Images show
     * inline with pinch-zoom; other file types render as an "Open with…" button
     * that fires ACTION_VIEW so the user's installed viewer can take over.
     *
     * [fileUrl] accepts either an absolute URL or a server-relative path like
     * `/uploads/abc.png` (the SDK prepends the configured base URL).
     */
    fun openAttachment(activity: Activity, fileUrl: String, fileName: String = "") {
        checkInit()
        activity.startActivity(
            Intent(activity, AttachmentViewerActivity::class.java).apply {
                putExtra(AttachmentViewerActivity.EXTRA_URL, fileUrl)
                putExtra(AttachmentViewerActivity.EXTRA_NAME, fileName)
            }
        )
    }

    // ── Internal ──

    private fun checkInit() {
        if (!initialized) {
            throw IllegalStateException(
                "FeedbackSDK not initialized. Call FeedbackSDK.initialize() first."
            )
        }
    }
}
