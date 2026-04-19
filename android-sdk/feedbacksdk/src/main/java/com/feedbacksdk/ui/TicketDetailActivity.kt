package com.feedbacksdk.ui

import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.api.ApiClient
import com.feedbacksdk.internal.ConnectivityMonitor
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.SdkWebSocket
import com.feedbacksdk.internal.StatusBanner
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.internal.priorityColor
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.UnreadStore
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.internal.uriToCacheFile
import com.feedbacksdk.models.Attachment
import com.feedbacksdk.models.Comment
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale

class TicketDetailActivity : AppCompatActivity() {

    private lateinit var tvTitle: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvPriority: TextView
    private lateinit var tvDate: TextView
    private lateinit var tvDescription: TextView
    private lateinit var tvAttachmentsHeader: TextView
    private lateinit var rvAttachments: RecyclerView
    private lateinit var commentsContainer: LinearLayout
    private lateinit var emptyComments: View
    private lateinit var editComment: TextInputEditText
    private lateinit var btnSend: MaterialButton
    private lateinit var btnAttach: MaterialButton
    private lateinit var rvPending: RecyclerView
    private lateinit var priorityDot: View
    private lateinit var progressBar: View
    private lateinit var tvTyping: TextView
    private lateinit var statusBanner: LinearLayout
    private var lastLoadFailed = false
    private val connectivityListener = ConnectivityMonitor.Listener { online ->
        runOnUiThread { refreshBanner(online) }
    }

    private var ticketId: String = ""
    private var typingHideJob: kotlinx.coroutines.Job? = null
    private var lastTypingSentAt: Long = 0L

    // Singleton listener registered per-open; removed on finish.
    private val wsListener = object : SdkWebSocket.Listener {
        override fun onMessage(envelope: SdkWebSocket.Envelope) {
            if (envelope.ticketId != ticketId) return
            val me = FeedbackSDK.currentUser?.id
            when (envelope.type) {
                "ticket_comment" -> {
                    // Skip self-echoes — we already rendered this optimistically.
                    if (envelope.userId == me) return
                    runOnUiThread {
                        loadTicket()
                        // Hide typing the moment a real comment arrives.
                        tvTyping.visibility = View.GONE
                    }
                }
                "ticket_typing" -> {
                    if (envelope.userId == me) return
                    runOnUiThread { showTyping() }
                }
            }
        }
    }

    private val pendingFiles = mutableListOf<File>()
    private lateinit var pendingAdapter: PendingAttachmentAdapter

    private val pickAttachments = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isEmpty()) return@registerForActivityResult
        lifecycleScope.launch {
            uris.forEach { uri ->
                uriToCacheFile(uri)?.let { pendingFiles.add(it) }
            }
            refreshPending()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_ticket_detail)

        ticketId = intent.getStringExtra("ticket_id") ?: run {
            finish()
            return
        }

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        findViewById<MaterialToolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }
        applySystemBarInsets(topView = appBar, bottomView = findViewById(R.id.bottomBar))

        tvTitle = findViewById(R.id.tvTitle)
        tvStatus = findViewById(R.id.tvStatus)
        tvPriority = findViewById(R.id.tvPriority)
        tvDate = findViewById(R.id.tvDate)
        tvDescription = findViewById(R.id.tvDescription)
        tvAttachmentsHeader = findViewById(R.id.tvAttachmentsHeader)
        rvAttachments = findViewById(R.id.rvAttachments)
        commentsContainer = findViewById(R.id.commentsContainer)
        emptyComments = findViewById(R.id.emptyComments)
        editComment = findViewById(R.id.editComment)
        btnSend = findViewById(R.id.btnSend)
        btnAttach = findViewById(R.id.btnAttach)
        rvPending = findViewById(R.id.rvPendingAttachments)
        priorityDot = findViewById(R.id.priorityDot)
        progressBar = findViewById(R.id.progressBar)
        tvTyping = findViewById(R.id.tvTyping)
        statusBanner = findViewById(R.id.statusBanner)
        ConnectivityMonitor.addListener(connectivityListener)

        rvAttachments.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)

        pendingAdapter = PendingAttachmentAdapter(pendingFiles) { position ->
            pendingFiles.removeAt(position)
            refreshPending()
        }
        rvPending.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)
        rvPending.adapter = pendingAdapter

        btnSend.setOnClickListener { sendMessage() }
        btnAttach.setOnClickListener { pickAttachments.launch("*/*") }

        // Emit typing pings while the user is composing, throttled to one per
        // 4s so we don't flood the server with keystrokes.
        editComment.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun afterTextChanged(s: android.text.Editable?) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                maybeSendTyping()
            }
        })

        // Make sure the shared socket is live even if the consumer skipped
        // calling initialize() through the usual login path.
        SdkWebSocket.connect()
        SdkWebSocket.addListener(wsListener)

        loadTicket()
    }

    override fun onDestroy() {
        SdkWebSocket.removeListener(wsListener)
        ConnectivityMonitor.removeListener(connectivityListener)
        typingHideJob?.cancel()
        super.onDestroy()
    }

    private fun refreshBanner(online: Boolean) {
        when {
            !online -> StatusBanner.showOffline(statusBanner)
            lastLoadFailed -> StatusBanner.showError(statusBanner) { loadTicket() }
            else -> StatusBanner.hide(statusBanner)
        }
    }

    private fun maybeSendTyping() {
        val now = System.currentTimeMillis()
        if (now - lastTypingSentAt < 4_000L) return
        lastTypingSentAt = now
        lifecycleScope.launch {
            try { ApiClient.getApi().sendTyping(ticketId) } catch (_: Exception) { /* best effort */ }
        }
    }

    private fun showTyping() {
        tvTyping.text = getString(R.string.sdk_typing)
        tvTyping.visibility = View.VISIBLE
        typingHideJob?.cancel()
        typingHideJob = lifecycleScope.launch {
            kotlinx.coroutines.delay(5_000L)
            tvTyping.visibility = View.GONE
        }
    }

    private fun refreshPending() {
        pendingAdapter.notifyDataSetChanged()
        rvPending.visibility = if (pendingFiles.isEmpty()) View.GONE else View.VISIBLE
    }

    override fun onResume() {
        super.onResume()
        loadTicket()
    }

    private fun loadTicket() {
        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            when (val result = FeedbackSDK.getTicket(ticketId)) {
                is SdkResult.Success -> {
                    progressBar.visibility = View.GONE
                    val ticket = result.data
                    UnreadStore.markTicketSeen(ticket.id, ticket.updatedAt)
                    tvTitle.text = ticket.title
                    tvDescription.text = ticket.description

                    tvStatus.text = ticket.status.replace("_", " ")
                    tvStatus.backgroundTintList = ColorStateList.valueOf(statusColor(ticket.status))
                    tvStatus.setTextColor(resolveThemeColor(R.attr.sdkColorOnStatus))

                    priorityDot.backgroundTintList = ColorStateList.valueOf(priorityColor(ticket.priority))
                    tvPriority.text = ticket.priority.replaceFirstChar { it.uppercase() }

                    tvDate.text = formatDate(ticket.createdAt)

                    renderAttachments(ticket.attachments)

                    val visibleComments = ticket.comments.filter { !it.isInternalNote }
                    commentsContainer.removeAllViews()
                    if (visibleComments.isEmpty()) {
                        emptyComments.visibility = View.VISIBLE
                    } else {
                        emptyComments.visibility = View.GONE
                        visibleComments.forEach { addCommentView(it) }
                    }
                    lastLoadFailed = false
                    refreshBanner(ConnectivityMonitor.isOnline)
                }
                is SdkResult.Error -> {
                    progressBar.visibility = View.GONE
                    lastLoadFailed = true
                    refreshBanner(ConnectivityMonitor.isOnline)
                    // Only toast if we've never successfully loaded; otherwise
                    // the banner + stale state is enough.
                    if (tvTitle.text.isNullOrEmpty()) {
                        Toast.makeText(this@TicketDetailActivity, result.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun renderAttachments(attachments: List<Attachment>) {
        if (attachments.isEmpty()) {
            tvAttachmentsHeader.visibility = View.GONE
            rvAttachments.visibility = View.GONE
            return
        }
        tvAttachmentsHeader.visibility = View.VISIBLE
        rvAttachments.visibility = View.VISIBLE
        rvAttachments.adapter = AttachmentAdapter(attachments) { attachment ->
            startActivity(
                Intent(this, AttachmentViewerActivity::class.java).apply {
                    putExtra(AttachmentViewerActivity.EXTRA_URL, attachment.fileUrl)
                    putExtra(AttachmentViewerActivity.EXTRA_NAME, attachment.fileName)
                }
            )
        }
    }

    private fun addCommentView(comment: Comment) {
        val view = layoutInflater.inflate(R.layout.sdk_item_comment, commentsContainer, false)
        view.findViewById<TextView>(R.id.tvAuthor).text = comment.user?.name ?: "User"
        view.findViewById<TextView>(R.id.tvBody).text = comment.body
        view.findViewById<TextView>(R.id.tvTime).text = formatDate(comment.createdAt)
        com.feedbacksdk.internal.AvatarBinder.bind(view, comment.user)

        // Only the author can edit/delete, and only within the 10-min window.
        // Server enforces both; this just suppresses the affordance when it
        // wouldn't work anyway.
        val myId = FeedbackSDK.currentUser?.id
        if (myId != null && comment.user?.id == myId && isCommentEditable(comment.createdAt)) {
            view.setOnLongClickListener {
                showCommentPopup(view, comment)
                true
            }
        }

        commentsContainer.addView(view)
    }

    private fun isCommentEditable(createdAtIso: String): Boolean {
        return try {
            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val created = fmt.parse(createdAtIso.substringBefore('.'))?.time ?: return false
            System.currentTimeMillis() - created < 10L * 60L * 1000L
        } catch (_: Exception) {
            false
        }
    }

    private fun showCommentPopup(anchor: View, comment: Comment) {
        val popup = PopupMenu(this, anchor)
        popup.menu.add(0, 1, 0, R.string.sdk_edit)
        popup.menu.add(0, 2, 1, R.string.sdk_delete)
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                1 -> { showCommentEditSheet(comment); true }
                2 -> { confirmDeleteComment(comment); true }
                else -> false
            }
        }
        popup.show()
    }

    private fun showCommentEditSheet(comment: Comment) {
        val edit = android.widget.EditText(this).apply {
            setText(comment.body)
            setSelection(comment.body.length)
            setPadding(48, 32, 48, 32)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.sdk_edit)
            .setView(edit)
            .setPositiveButton(R.string.sdk_save) { _, _ ->
                val newBody = edit.text?.toString()?.trim().orEmpty()
                if (newBody.isEmpty() || newBody == comment.body) return@setPositiveButton
                lifecycleScope.launch {
                    when (val r = FeedbackSDK.editComment(ticketId, comment.id, newBody)) {
                        is SdkResult.Success -> {
                            Toast.makeText(this@TicketDetailActivity, R.string.sdk_comment_updated, Toast.LENGTH_SHORT).show()
                            loadTicket()
                        }
                        is SdkResult.Error -> Toast.makeText(this@TicketDetailActivity, r.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton(R.string.sdk_cancel_edit, null)
            .show()
    }

    private fun confirmDeleteComment(comment: Comment) {
        AlertDialog.Builder(this)
            .setMessage(R.string.sdk_delete_comment_confirm)
            .setPositiveButton(R.string.sdk_delete) { _, _ ->
                lifecycleScope.launch {
                    when (val r = FeedbackSDK.deleteComment(ticketId, comment.id)) {
                        is SdkResult.Success -> {
                            Toast.makeText(this@TicketDetailActivity, R.string.sdk_comment_deleted, Toast.LENGTH_SHORT).show()
                            loadTicket()
                        }
                        is SdkResult.Error -> Toast.makeText(this@TicketDetailActivity, r.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton(R.string.sdk_cancel_edit, null)
            .show()
    }

    private fun sendMessage() {
        val body = editComment.text?.toString()?.trim().orEmpty()
        if (body.isEmpty() && pendingFiles.isEmpty()) return

        // Optimistic path: clear the composer immediately, render a placeholder
        // row so the user sees instant response. Real server comment replaces
        // the placeholder on success; on failure the row becomes a retry chip.
        val optimisticBody = body
        val filesToUpload = pendingFiles.toList()
        editComment.text?.clear()
        pendingFiles.clear()
        refreshPending()

        val placeholder = if (optimisticBody.isNotEmpty()) addPendingCommentView(optimisticBody) else null
        if (placeholder != null) emptyComments.visibility = View.GONE

        btnSend.isEnabled = false
        btnAttach.isEnabled = false

        lifecycleScope.launch {
            var commentFailed = false
            var attachmentFailed = false
            var attachmentsUploaded = false

            if (optimisticBody.isNotEmpty() && placeholder != null) {
                when (val result = FeedbackSDK.addComment(ticketId, optimisticBody)) {
                    is SdkResult.Success -> {
                        replacePendingCommentView(placeholder, result.data)
                    }
                    is SdkResult.Error -> {
                        commentFailed = true
                        markPendingCommentFailed(placeholder, optimisticBody)
                    }
                }
            }

            if (filesToUpload.isNotEmpty()) {
                filesToUpload.forEach { file ->
                    when (FeedbackSDK.uploadTicketAttachment(ticketId, file)) {
                        is SdkResult.Success -> attachmentsUploaded = true
                        is SdkResult.Error -> attachmentFailed = true
                    }
                }
                if (attachmentsUploaded) loadTicket()
            }

            if (attachmentFailed && !commentFailed) {
                Toast.makeText(
                    this@TicketDetailActivity,
                    R.string.sdk_attachment_upload_failed,
                    Toast.LENGTH_LONG,
                ).show()
            }

            btnSend.isEnabled = true
            btnAttach.isEnabled = true
        }
    }

    /**
     * Render a transient "sending…" row so the user sees their message appear
     * immediately. Returned view is handed back into [replacePendingCommentView]
     * or [markPendingCommentFailed] depending on the server's response.
     */
    private fun addPendingCommentView(body: String): View {
        val view = layoutInflater.inflate(R.layout.sdk_item_comment, commentsContainer, false)
        view.findViewById<TextView>(R.id.tvAuthor).text =
            FeedbackSDK.currentUser?.name ?: getString(R.string.sdk_sending)
        view.findViewById<TextView>(R.id.tvBody).text = body
        view.findViewById<TextView>(R.id.tvTime).text = getString(R.string.sdk_sending)
        com.feedbacksdk.internal.AvatarBinder.bind(view, FeedbackSDK.currentUser)
        view.alpha = 0.55f
        commentsContainer.addView(view)
        return view
    }

    private fun replacePendingCommentView(placeholder: View, comment: com.feedbacksdk.models.Comment) {
        val index = commentsContainer.indexOfChild(placeholder)
        if (index < 0) {
            addCommentView(comment)
            return
        }
        commentsContainer.removeView(placeholder)
        val view = layoutInflater.inflate(R.layout.sdk_item_comment, commentsContainer, false)
        view.findViewById<TextView>(R.id.tvAuthor).text = comment.user?.name ?: "User"
        view.findViewById<TextView>(R.id.tvBody).text = comment.body
        view.findViewById<TextView>(R.id.tvTime).text = formatDate(comment.createdAt)
        com.feedbacksdk.internal.AvatarBinder.bind(view, comment.user)
        commentsContainer.addView(view, index)
    }

    private fun markPendingCommentFailed(placeholder: View, body: String) {
        placeholder.alpha = 1f
        val tvTime = placeholder.findViewById<TextView>(R.id.tvTime)
        tvTime.text = getString(R.string.sdk_send_failed_tap_to_retry)
        tvTime.setTextColor(
            androidx.core.content.ContextCompat.getColor(this, android.R.color.holo_red_dark)
        )
        placeholder.setOnClickListener {
            commentsContainer.removeView(placeholder)
            editComment.setText(body)
            editComment.setSelection(body.length)
            editComment.requestFocus()
        }
    }

    private fun formatDate(dateStr: String): String = try {
        val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val output = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
        val date = input.parse(dateStr.substringBefore('.'))
        date?.let { output.format(it) } ?: dateStr
    } catch (_: Exception) {
        dateStr.substringBefore('T')
    }
}
