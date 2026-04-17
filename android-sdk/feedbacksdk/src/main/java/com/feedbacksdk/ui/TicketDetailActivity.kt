package com.feedbacksdk.ui

import android.content.Intent
import android.content.res.ColorStateList
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.internal.priorityColor
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.models.Attachment
import com.feedbacksdk.models.Comment
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch
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
    private lateinit var priorityDot: View
    private lateinit var progressBar: View

    private var ticketId: String = ""

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
        priorityDot = findViewById(R.id.priorityDot)
        progressBar = findViewById(R.id.progressBar)

        rvAttachments.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)

        btnSend.setOnClickListener { sendComment() }
        loadTicket()
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
                }
                is SdkResult.Error -> {
                    progressBar.visibility = View.GONE
                    Toast.makeText(this@TicketDetailActivity, result.message, Toast.LENGTH_LONG).show()
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
        commentsContainer.addView(view)
    }

    private fun sendComment() {
        val body = editComment.text?.toString()?.trim().orEmpty()
        if (body.isEmpty()) return

        btnSend.isEnabled = false
        lifecycleScope.launch {
            when (val result = FeedbackSDK.addComment(ticketId, body)) {
                is SdkResult.Success -> {
                    editComment.text?.clear()
                    emptyComments.visibility = View.GONE
                    addCommentView(result.data)
                }
                is SdkResult.Error -> {
                    Toast.makeText(this@TicketDetailActivity, result.message, Toast.LENGTH_LONG).show()
                }
            }
            btnSend.isEnabled = true
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
