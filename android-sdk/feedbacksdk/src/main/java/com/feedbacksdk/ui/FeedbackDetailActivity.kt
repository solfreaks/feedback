package com.feedbacksdk.ui

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.widget.NestedScrollView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.ConnectivityMonitor
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.StatusBanner
import com.feedbacksdk.internal.UnreadStore
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.models.Attachment
import com.feedbacksdk.models.FeedbackDetail
import com.feedbacksdk.models.FeedbackReply
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class FeedbackDetailActivity : AppCompatActivity() {

    private lateinit var stars: List<ImageView>
    private lateinit var starsRow: LinearLayout
    private lateinit var tvStatus: TextView
    private lateinit var tvCategory: TextView
    private lateinit var tvDate: TextView
    private lateinit var tvComment: TextView
    private lateinit var tvAttachmentsHeader: TextView
    private lateinit var rvAttachments: RecyclerView
    private lateinit var repliesContainer: LinearLayout
    private lateinit var emptyReplies: View
    private lateinit var progressBar: View
    private lateinit var contentScroll: NestedScrollView

    private lateinit var replyComposer: LinearLayout
    private lateinit var editReply: TextInputEditText
    private lateinit var btnAttach: ImageView
    private lateinit var btnSendReply: ImageView
    private lateinit var attachChipRow: LinearLayout
    private val pendingAttachments = mutableListOf<Uri>()
    private var sendingReply = false

    private val pickAttachment = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (uris.isNotEmpty()) {
            pendingAttachments.addAll(uris)
            renderAttachChips()
        }
    }

    private var feedbackId: String = ""
    private var currentFeedback: FeedbackDetail? = null
    private lateinit var toolbar: MaterialToolbar
    private lateinit var statusBanner: LinearLayout
    private var lastLoadFailed = false
    private val connectivityListener = ConnectivityMonitor.Listener { online ->
        runOnUiThread { refreshBanner(online) }
    }

    private val editWindowMs = 24L * 60L * 60L * 1000L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_feedback_detail)

        feedbackId = intent.getStringExtra("feedback_id") ?: run { finish(); return }

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        toolbar = findViewById(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }
        applySystemBarInsets(topView = appBar, bottomView = findViewById(R.id.replyComposer))

        contentScroll = findViewById(R.id.contentScroll)
        val baseScrollPadBottom = contentScroll.paddingBottom
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(contentScroll) { v, insets ->
            val ime = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime()).bottom
            v.setPadding(v.paddingLeft, v.paddingTop, v.paddingRight, baseScrollPadBottom + ime)
            insets
        }

        stars = listOf(
            findViewById(R.id.star1),
            findViewById(R.id.star2),
            findViewById(R.id.star3),
            findViewById(R.id.star4),
            findViewById(R.id.star5),
        )
        starsRow = findViewById(R.id.starsRow)
        tvStatus = findViewById(R.id.tvStatus)
        tvCategory = findViewById(R.id.tvCategory)
        tvDate = findViewById(R.id.tvDate)
        tvComment = findViewById(R.id.tvComment)
        tvAttachmentsHeader = findViewById(R.id.tvAttachmentsHeader)
        rvAttachments = findViewById(R.id.rvAttachments)
        repliesContainer = findViewById(R.id.repliesContainer)
        emptyReplies = findViewById(R.id.emptyReplies)
        progressBar = findViewById(R.id.progressBar)
        statusBanner = findViewById(R.id.statusBanner)
        ConnectivityMonitor.addListener(connectivityListener)

        rvAttachments.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)

        replyComposer = findViewById(R.id.replyComposer)
        editReply = findViewById(R.id.editReply)
        btnAttach = findViewById(R.id.btnAttach)
        btnSendReply = findViewById(R.id.btnSendReply)
        attachChipRow = findViewById(R.id.attachChipRow)

        editReply.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) { refreshSendButton() }
        })
        btnAttach.setOnClickListener { pickAttachment.launch("*/*") }
        btnSendReply.setOnClickListener { sendReply() }

        loadFeedback()
    }

    private fun refreshOverflow() {
        toolbar.menu.clear()
        val fb = currentFeedback ?: return
        val me = FeedbackSDK.currentUser ?: return
        if (fb.user?.id != me.id) return
        if (!isWithinWindow(fb.createdAt, editWindowMs)) return

        toolbar.inflateMenu(R.menu.sdk_feedback_detail_menu)
        toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_feedback_overflow) { showOverflowPopup(); true }
            else false
        }
    }

    private fun showOverflowPopup() {
        val anchor = toolbar.findViewById<View>(R.id.action_feedback_overflow) ?: toolbar
        val popup = PopupMenu(this, anchor)
        popup.menu.add(0, 1, 0, R.string.sdk_edit)
        popup.menu.add(0, 2, 1, R.string.sdk_delete)
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                1 -> { showEditSheet(); true }
                2 -> { confirmDelete(); true }
                else -> false
            }
        }
        popup.show()
    }

    private fun isWithinWindow(createdAtIso: String, windowMs: Long): Boolean {
        return try {
            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val created = fmt.parse(createdAtIso.substringBefore('.'))?.time ?: return false
            System.currentTimeMillis() - created < windowMs
        } catch (_: Exception) { false }
    }

    private fun confirmDelete() {
        AlertDialog.Builder(this)
            .setMessage(R.string.sdk_delete_feedback_confirm)
            .setPositiveButton(R.string.sdk_delete) { _, _ -> performDelete() }
            .setNegativeButton(R.string.sdk_cancel_edit, null)
            .show()
    }

    private fun performDelete() {
        val fb = currentFeedback ?: return
        lifecycleScope.launch {
            when (val r = FeedbackSDK.deleteFeedback(fb.id)) {
                is SdkResult.Success -> {
                    Toast.makeText(this@FeedbackDetailActivity, R.string.sdk_feedback_deleted, Toast.LENGTH_SHORT).show()
                    setResult(RESULT_OK)
                    finish()
                }
                is SdkResult.Error -> Toast.makeText(this@FeedbackDetailActivity, r.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showEditSheet() {
        val fb = currentFeedback ?: return
        val sheet = layoutInflater.inflate(R.layout.sdk_edit_feedback_sheet, null)
        val starViews = listOf<ImageView>(
            sheet.findViewById(R.id.star1),
            sheet.findViewById(R.id.star2),
            sheet.findViewById(R.id.star3),
            sheet.findViewById(R.id.star4),
            sheet.findViewById(R.id.star5),
        )
        val editComment = sheet.findViewById<TextInputEditText>(R.id.editComment)
        editComment.setText(fb.comment ?: "")
        var rating = fb.rating

        fun paintStars() {
            starViews.forEachIndexed { i, iv ->
                iv.setImageResource(if (i < rating) R.drawable.sdk_ic_star_filled else R.drawable.sdk_ic_star_outline)
            }
        }
        paintStars()
        starViews.forEachIndexed { i, iv ->
            iv.contentDescription = getString(R.string.sdk_star_rating_label, i + 1)
            iv.setOnClickListener { rating = i + 1; paintStars() }
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.sdk_edit)
            .setView(sheet)
            .setPositiveButton(R.string.sdk_save) { _, _ ->
                val newComment = editComment.text?.toString()?.trim().orEmpty()
                lifecycleScope.launch {
                    when (val r = FeedbackSDK.editFeedback(
                        feedbackId = fb.id,
                        rating = if (rating != fb.rating) rating else null,
                        comment = if (newComment != (fb.comment ?: "")) newComment else null,
                    )) {
                        is SdkResult.Success -> {
                            Toast.makeText(this@FeedbackDetailActivity, R.string.sdk_feedback_updated, Toast.LENGTH_SHORT).show()
                            loadFeedback()
                        }
                        is SdkResult.Error -> Toast.makeText(this@FeedbackDetailActivity, r.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton(R.string.sdk_cancel_edit, null)
            .show()
    }

    private fun loadFeedback(scrollToBottom: Boolean = false) {
        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            when (val result = FeedbackSDK.getFeedback(feedbackId)) {
                is SdkResult.Success -> {
                    progressBar.visibility = View.GONE
                    val feedback = result.data
                    currentFeedback = feedback
                    refreshOverflow()
                    UnreadStore.markFeedbackSeen(feedback.id, feedback.replies.size)

                    stars.forEachIndexed { i, star ->
                        star.setImageResource(
                            if (i < feedback.rating) R.drawable.sdk_ic_star_filled
                            else R.drawable.sdk_ic_star_outline
                        )
                    }
                    // Single accessible label on the row so TalkBack reads "4 out of 5 stars".
                    starsRow.contentDescription = getString(R.string.sdk_star_rating_selected, feedback.rating)
                    starsRow.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
                    stars.forEach { it.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }

                    tvStatus.text = feedback.status.replace("_", " ").replaceFirstChar { it.uppercase() }
                    tvStatus.backgroundTintList = ColorStateList.valueOf(statusColor(feedback.status))
                    tvStatus.setTextColor(resolveThemeColor(R.attr.sdkColorOnStatus))
                    tvStatus.contentDescription = getString(R.string.sdk_status_label, feedback.status.replace("_", " "))

                    tvCategory.text = feedback.category
                        .replace("_", " ")
                        .replaceFirstChar { it.uppercase() }
                    tvDate.text = relativeTime(feedback.createdAt)

                    val comment = feedback.comment?.trim().orEmpty()
                    if (comment.isEmpty()) {
                        tvComment.visibility = View.GONE
                    } else {
                        tvComment.visibility = View.VISIBLE
                        tvComment.text = comment
                        tvComment.setOnLongClickListener { copyToClipboard(comment); true }
                    }

                    renderAttachments(feedback.attachments)

                    repliesContainer.removeAllViews()
                    if (feedback.replies.isEmpty()) {
                        emptyReplies.visibility = View.VISIBLE
                    } else {
                        emptyReplies.visibility = View.GONE
                        feedback.replies.forEach { addReplyView(it) }
                    }

                    val me = FeedbackSDK.currentUser
                    replyComposer.visibility =
                        if (me != null && feedback.user?.id == me.id) View.VISIBLE else View.GONE

                    lastLoadFailed = false
                    refreshBanner(ConnectivityMonitor.isOnline)

                    if (scrollToBottom) {
                        contentScroll.post { contentScroll.fullScroll(View.FOCUS_DOWN) }
                    }
                }
                is SdkResult.Error -> {
                    progressBar.visibility = View.GONE
                    lastLoadFailed = true
                    refreshBanner(ConnectivityMonitor.isOnline)
                    if (currentFeedback == null) {
                        Toast.makeText(this@FeedbackDetailActivity, result.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun refreshBanner(online: Boolean) {
        when {
            !online -> StatusBanner.showOffline(statusBanner)
            lastLoadFailed -> StatusBanner.showError(statusBanner) { loadFeedback() }
            else -> StatusBanner.hide(statusBanner)
        }
    }

    override fun onDestroy() {
        ConnectivityMonitor.removeListener(connectivityListener)
        super.onDestroy()
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

    private fun addReplyView(reply: FeedbackReply) {
        val view = layoutInflater.inflate(R.layout.sdk_item_comment, repliesContainer, false)
        val tvAuthor = view.findViewById<TextView>(R.id.tvAuthor)
        val tvBody = view.findViewById<TextView>(R.id.tvBody)
        val tvTime = view.findViewById<TextView>(R.id.tvTime)

        tvAuthor.text = reply.user?.name ?: getString(R.string.sdk_support_fallback)
        tvBody.text = reply.body
        tvTime.text = relativeTime(reply.createdAt)
        com.feedbacksdk.internal.AvatarBinder.bind(view, reply.user)

        // Long-press copies body; show popup if it's the current user's own reply.
        val myId = FeedbackSDK.currentUser?.id
        if (myId != null && reply.user?.id == myId) {
            view.setOnLongClickListener {
                showReplyPopup(view, reply)
                true
            }
        } else {
            tvBody.setOnLongClickListener { copyToClipboard(reply.body); true }
            view.setOnLongClickListener { copyToClipboard(reply.body); true }
        }

        repliesContainer.addView(view)
    }

    private fun showReplyPopup(anchor: View, reply: FeedbackReply) {
        val popup = PopupMenu(this, anchor)
        popup.menu.add(0, 1, 0, R.string.sdk_copy)
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                1 -> { copyToClipboard(reply.body); true }
                else -> false
            }
        }
        popup.show()
    }

    private fun refreshSendButton() {
        val enabled = !sendingReply && !editReply.text.isNullOrBlank()
        btnSendReply.isEnabled = enabled
        btnSendReply.alpha = if (enabled) 1f else 0.5f
    }

    private fun renderAttachChips() {
        attachChipRow.removeAllViews()
        attachChipRow.visibility = if (pendingAttachments.isEmpty()) View.GONE else View.VISIBLE
        pendingAttachments.forEachIndexed { idx, uri ->
            val chip = layoutInflater.inflate(R.layout.sdk_item_attach_chip, attachChipRow, false)
            val name = displayName(uri)
            chip.findViewById<TextView>(R.id.tvChipName).text = name
            chip.contentDescription = name
            chip.findViewById<ImageView>(R.id.btnChipRemove).apply {
                contentDescription = getString(R.string.sdk_remove_attachment_desc, name)
                setOnClickListener {
                    pendingAttachments.removeAt(idx)
                    renderAttachChips()
                }
            }
            attachChipRow.addView(chip)
        }
    }

    private fun displayName(uri: Uri): String {
        val cursor = contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            val idx = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && it.moveToFirst()) return it.getString(idx) ?: uri.lastPathSegment.orEmpty()
        }
        return uri.lastPathSegment.orEmpty().ifEmpty { "file" }
    }

    private fun sendReply() {
        if (sendingReply) return
        val text = editReply.text?.toString()?.trim().orEmpty()
        if (text.isEmpty()) {
            Toast.makeText(this, R.string.sdk_reply_empty, Toast.LENGTH_SHORT).show()
            return
        }
        sendingReply = true
        refreshSendButton()

        lifecycleScope.launch {
            val tempFiles = pendingAttachments.mapNotNull { uri ->
                runCatching { copyUriToCache(uri) }.getOrNull()
            }
            try {
                when (val r = FeedbackSDK.sendFeedbackReply(feedbackId, text, tempFiles)) {
                    is SdkResult.Success -> {
                        Toast.makeText(this@FeedbackDetailActivity, R.string.sdk_reply_sent, Toast.LENGTH_SHORT).show()
                        editReply.setText("")
                        pendingAttachments.clear()
                        renderAttachChips()
                        loadFeedback(scrollToBottom = true)
                    }
                    is SdkResult.Error -> {
                        Toast.makeText(this@FeedbackDetailActivity, r.message, Toast.LENGTH_LONG).show()
                    }
                }
            } finally {
                tempFiles.forEach { runCatching { it.delete() } }
                sendingReply = false
                refreshSendButton()
            }
        }
    }

    private fun copyToClipboard(text: String) {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText(null, text))
        Toast.makeText(this, R.string.sdk_copied, Toast.LENGTH_SHORT).show()
    }

    private fun relativeTime(dateStr: String): String {
        return try {
            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val ms = fmt.parse(dateStr.substringBefore('.'))?.time ?: return dateStr
            val diff = System.currentTimeMillis() - ms
            when {
                diff < 60_000 -> getString(R.string.sdk_time_just_now)
                diff < 3_600_000 -> getString(R.string.sdk_time_minutes_ago, diff / 60_000)
                diff < 86_400_000 -> getString(R.string.sdk_time_hours_ago, diff / 3_600_000)
                diff < 7L * 86_400_000 -> getString(R.string.sdk_time_days_ago, diff / 86_400_000)
                else -> SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(java.util.Date(ms))
            }
        } catch (_: Exception) { dateStr.substringBefore('T') }
    }

    private fun copyUriToCache(uri: Uri): java.io.File {
        val name = displayName(uri).take(100).ifEmpty { "upload" }
        val outFile = java.io.File.createTempFile("fbreply_", "_$name", cacheDir)
        contentResolver.openInputStream(uri).use { input ->
            outFile.outputStream().use { out ->
                input?.copyTo(out) ?: error("Cannot open $uri")
            }
        }
        return outFile
    }
}
