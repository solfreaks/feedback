package com.feedbacksdk.ui

import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.ConnectivityMonitor
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.StatusBanner
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.UnreadStore
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
    private lateinit var tvStatus: TextView
    private lateinit var tvCategory: TextView
    private lateinit var tvDate: TextView
    private lateinit var tvComment: TextView
    private lateinit var tvAttachmentsHeader: TextView
    private lateinit var rvAttachments: RecyclerView
    private lateinit var repliesContainer: LinearLayout
    private lateinit var emptyReplies: View
    private lateinit var progressBar: View

    private var feedbackId: String = ""
    private var currentFeedback: FeedbackDetail? = null
    private lateinit var toolbar: MaterialToolbar
    private lateinit var statusBanner: LinearLayout
    private var lastLoadFailed = false
    private val connectivityListener = ConnectivityMonitor.Listener { online ->
        runOnUiThread { refreshBanner(online) }
    }

    // Server-enforced too; we mirror the window here so the menu hides cleanly.
    private val editWindowMs = 24L * 60L * 60L * 1000L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_feedback_detail)

        feedbackId = intent.getStringExtra("feedback_id") ?: run {
            finish()
            return
        }

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        toolbar = findViewById(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }
        applySystemBarInsets(topView = appBar, bottomView = null)

        stars = listOf(
            findViewById(R.id.star1),
            findViewById(R.id.star2),
            findViewById(R.id.star3),
            findViewById(R.id.star4),
            findViewById(R.id.star5),
        )
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

        loadFeedback()
    }

    /**
     * Show the overflow only when the loaded feedback belongs to the current
     * user and is still inside the 24h edit window. Tapping it pops a simple
     * menu with Edit / Delete.
     */
    private fun refreshOverflow() {
        toolbar.menu.clear()
        val fb = currentFeedback ?: return
        val me = FeedbackSDK.currentUser ?: return
        if (fb.user?.id != me.id) return
        if (!isWithinEditWindow(fb.createdAt)) return

        toolbar.inflateMenu(R.menu.sdk_feedback_detail_menu)
        toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_feedback_overflow) {
                showOverflowPopup()
                true
            } else false
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

    private fun isWithinEditWindow(createdAtIso: String): Boolean {
        return try {
            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val created = fmt.parse(createdAtIso.substringBefore('.'))?.time ?: return false
            System.currentTimeMillis() - created < editWindowMs
        } catch (_: Exception) {
            false
        }
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

    /**
     * Inline edit sheet shown via AlertDialog. Simple enough that a full
     * separate activity would be overkill. Lets the user change rating,
     * category, and comment; status stays server-managed.
     */
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
                iv.setImageResource(
                    if (i < rating) R.drawable.sdk_ic_star_filled
                    else R.drawable.sdk_ic_star_outline
                )
            }
        }
        paintStars()
        starViews.forEachIndexed { i, iv ->
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

    private fun loadFeedback() {
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

                    tvStatus.text = feedback.status.replace("_", " ")
                    tvStatus.backgroundTintList = ColorStateList.valueOf(statusColor(feedback.status))
                    tvStatus.setTextColor(resolveThemeColor(R.attr.sdkColorOnStatus))

                    tvCategory.text = feedback.category
                        .replace("_", " ")
                        .replaceFirstChar { it.uppercase() }
                    tvDate.text = formatDate(feedback.createdAt)

                    val comment = feedback.comment?.trim().orEmpty()
                    if (comment.isEmpty()) {
                        tvComment.visibility = View.GONE
                    } else {
                        tvComment.visibility = View.VISIBLE
                        tvComment.text = comment
                    }

                    renderAttachments(feedback.attachments)

                    repliesContainer.removeAllViews()
                    if (feedback.replies.isEmpty()) {
                        emptyReplies.visibility = View.VISIBLE
                    } else {
                        emptyReplies.visibility = View.GONE
                        feedback.replies.forEach { addReplyView(it) }
                    }
                    lastLoadFailed = false
                    refreshBanner(ConnectivityMonitor.isOnline)
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
        view.findViewById<TextView>(R.id.tvAuthor).text = reply.user?.name ?: "Support"
        view.findViewById<TextView>(R.id.tvBody).text = reply.body
        view.findViewById<TextView>(R.id.tvTime).text = formatDate(reply.createdAt)
        repliesContainer.addView(view)
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
