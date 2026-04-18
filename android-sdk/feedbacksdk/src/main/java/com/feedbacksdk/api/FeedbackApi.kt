package com.feedbacksdk.api

import com.feedbacksdk.models.*
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

internal interface FeedbackApi {

    // ── Auth ──

    @POST("auth/google")
    suspend fun googleSignIn(
        @Body body: Map<String, String>
    ): Response<AuthResponse>

    // ── Tickets ──

    @POST("tickets")
    suspend fun createTicket(
        @Body request: CreateTicketRequest
    ): Response<Ticket>

    @GET("tickets")
    suspend fun listTickets(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<TicketListResponse>

    @GET("tickets/{id}")
    suspend fun getTicket(
        @Path("id") ticketId: String
    ): Response<TicketDetail>

    @POST("tickets/{id}/comments")
    suspend fun addComment(
        @Path("id") ticketId: String,
        @Body request: AddCommentRequest
    ): Response<Comment>

    @Multipart
    @POST("tickets/{id}/attachments")
    suspend fun uploadTicketAttachment(
        @Path("id") ticketId: String,
        @Part file: MultipartBody.Part
    ): Response<Attachment>

    @PATCH("tickets/{id}/comments/{commentId}")
    suspend fun editComment(
        @Path("id") ticketId: String,
        @Path("commentId") commentId: String,
        @Body request: Map<String, @JvmSuppressWildcards Any?>,
    ): Response<Comment>

    @DELETE("tickets/{id}/comments/{commentId}")
    suspend fun deleteComment(
        @Path("id") ticketId: String,
        @Path("commentId") commentId: String,
    ): Response<SuccessResponse>

    @POST("tickets/{id}/typing")
    suspend fun sendTyping(@Path("id") ticketId: String): Response<SuccessResponse>

    // ── Feedback ──

    @POST("feedbacks")
    suspend fun submitFeedback(
        @Body request: CreateFeedbackRequest
    ): Response<Feedback>

    @GET("feedbacks")
    suspend fun listFeedbacks(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<FeedbackListResponse>

    @GET("feedbacks/{id}")
    suspend fun getFeedback(
        @Path("id") feedbackId: String
    ): Response<FeedbackDetail>

    @Multipart
    @POST("feedbacks/{id}/attachments")
    suspend fun uploadFeedbackAttachment(
        @Path("id") feedbackId: String,
        @Part file: MultipartBody.Part
    ): Response<Attachment>

    @PATCH("feedbacks/{id}")
    suspend fun editFeedback(
        @Path("id") feedbackId: String,
        @Body request: Map<String, @JvmSuppressWildcards Any?>,
    ): Response<Feedback>

    @DELETE("feedbacks/{id}")
    suspend fun deleteFeedback(
        @Path("id") feedbackId: String,
    ): Response<SuccessResponse>

    // ── Device Token ──

    @POST("device-tokens")
    suspend fun registerDeviceToken(
        @Body request: DeviceTokenRequest
    ): Response<DeviceTokenResponse>

    @HTTP(method = "DELETE", path = "device-tokens", hasBody = true)
    suspend fun removeDeviceToken(
        @Body request: Map<String, String>
    ): Response<SuccessResponse>

    // ── Summary ──

    @GET("summary")
    suspend fun getSummary(): Response<SummaryResponse>

    // ── Notifications ──

    @GET("notifications")
    suspend fun listNotifications(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): Response<NotificationListResponse>

    @PATCH("notifications/{id}/read")
    suspend fun markNotificationRead(
        @Path("id") notificationId: String,
    ): Response<SuccessResponse>

    @PATCH("notifications/read-all")
    suspend fun markAllNotificationsRead(): Response<SuccessResponse>

    @GET("notifications/unread-count")
    suspend fun getUnreadNotificationCount(): Response<UnreadCountResponse>

    // ── Announcements ──

    @GET("announcements")
    suspend fun listAnnouncements(): Response<AnnouncementListResponse>
}
