package com.feedbacksdk

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResultLauncher
import com.feedbacksdk.api.ApiClient
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.TokenStore
import com.feedbacksdk.internal.toResult
import com.feedbacksdk.models.*
import com.feedbacksdk.ui.FeedbackActivity
import com.feedbacksdk.ui.TicketDetailActivity
import com.feedbacksdk.ui.TicketListActivity
import com.feedbacksdk.ui.CreateTicketActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

object FeedbackSDK {

    private var initialized = false
    private var googleClientId: String? = null

    /**
     * Initialize the SDK. Call this in Application.onCreate() or before any SDK usage.
     *
     * @param context Application context
     * @param baseUrl Your feedback server URL (e.g. "https://feedback.example.com")
     * @param apiKey Your app's API key from the admin panel
     * @param googleClientId Google OAuth client ID for sign-in (optional if set in admin panel)
     * @param debug Enable HTTP request/response logging
     */
    fun initialize(
        context: Context,
        baseUrl: String,
        apiKey: String,
        googleClientId: String? = null,
        debug: Boolean = false
    ) {
        TokenStore.init(context.applicationContext)
        ApiClient.initialize(baseUrl, apiKey, debug)
        this.googleClientId = googleClientId

        // Restore saved token
        TokenStore.authToken?.let {
            ApiClient.authToken = it
        }

        initialized = true
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
    }

    /** Log out and clear stored credentials */
    fun logout() {
        checkInit()
        TokenStore.clear()
        ApiClient.authToken = null
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

    /** Upload attachment to a ticket */
    suspend fun uploadTicketAttachment(ticketId: String, file: File): SdkResult<Attachment> {
        checkInit()
        return try {
            val requestBody = file.asRequestBody("application/octet-stream".toMediaTypeOrNull())
            val part = MultipartBody.Part.createFormData("file", file.name, requestBody)
            ApiClient.getApi().uploadTicketAttachment(ticketId, part).toResult()
        } catch (e: Exception) {
            SdkResult.Error(e.message ?: "Failed to upload attachment")
        }
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
            ApiClient.getApi().submitFeedback(
                CreateFeedbackRequest(rating, category, comment)
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

    // ── Internal ──

    private fun checkInit() {
        if (!initialized) {
            throw IllegalStateException(
                "FeedbackSDK not initialized. Call FeedbackSDK.initialize() first."
            )
        }
    }
}
