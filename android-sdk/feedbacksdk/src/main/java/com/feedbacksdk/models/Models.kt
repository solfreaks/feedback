package com.feedbacksdk.models

import com.google.gson.annotations.SerializedName

// ── Auth ──

data class AuthResponse(
    val token: String,
    val user: User
)

data class User(
    val id: String,
    val email: String,
    val name: String,
    val role: String,
    val avatarUrl: String?
)

// ── Ticket ──

data class Ticket(
    val id: String,
    val title: String,
    val description: String,
    val category: String?,
    val priority: String,
    val status: String,
    val createdAt: String,
    val updatedAt: String
)

data class TicketDetail(
    val id: String,
    val title: String,
    val description: String,
    val category: String?,
    val priority: String,
    val status: String,
    val createdAt: String,
    val updatedAt: String,
    val comments: List<Comment>,
    val attachments: List<Attachment>
)

data class CreateTicketRequest(
    val title: String,
    val description: String,
    val category: String? = null,
    val priority: String = "medium"
)

data class TicketListResponse(
    val tickets: List<Ticket>,
    val total: Int,
    val page: Int,
    val totalPages: Int
)

// ── Feedback ──

data class Feedback(
    val id: String,
    val rating: Int,
    val category: String,
    val status: String,
    val comment: String?,
    val createdAt: String
)

data class FeedbackDetail(
    val id: String,
    val rating: Int,
    val category: String,
    val status: String,
    val comment: String?,
    val createdAt: String,
    val replies: List<FeedbackReply>,
    val attachments: List<Attachment>
)

data class CreateFeedbackRequest(
    val rating: Int,
    val category: String = "general",
    val comment: String? = null
)

data class FeedbackListResponse(
    val feedbacks: List<Feedback>,
    val total: Int,
    val page: Int,
    val totalPages: Int
)

data class FeedbackReply(
    val id: String,
    val body: String,
    val createdAt: String,
    val user: User?
)

// ── Comment ──

data class Comment(
    val id: String,
    val body: String,
    @SerializedName("isInternalNote")
    val isInternalNote: Boolean,
    val createdAt: String,
    val user: User?
)

data class AddCommentRequest(
    val body: String
)

// ── Attachment ──

data class Attachment(
    val id: String,
    val fileUrl: String,
    val fileName: String,
    val fileSize: Int,
    val createdAt: String
)

// ── Device Token ──

data class DeviceTokenRequest(
    val token: String,
    val platform: String = "android"
)

data class DeviceTokenResponse(
    val id: String,
    val token: String,
    val platform: String?
)

data class SuccessResponse(
    val success: Boolean
)

data class ErrorResponse(
    val error: String
)
