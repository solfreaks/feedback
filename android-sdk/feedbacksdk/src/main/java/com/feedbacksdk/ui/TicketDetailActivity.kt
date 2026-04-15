package com.feedbacksdk.ui

import android.content.res.ColorStateList
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.priorityColor
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.models.Comment
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
    private lateinit var commentsContainer: LinearLayout
    private lateinit var emptyComments: View
    private lateinit var editComment: TextInputEditText
    private lateinit var btnSend: MaterialButton
    private lateinit var priorityDot: View
    private lateinit var progressBar: View

    private var ticketId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_ticket_detail)

        ticketId = intent.getStringExtra("ticket_id") ?: run {
            finish()
            return
        }

        findViewById<MaterialToolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }

        tvTitle = findViewById(R.id.tvTitle)
        tvStatus = findViewById(R.id.tvStatus)
        tvPriority = findViewById(R.id.tvPriority)
        tvDate = findViewById(R.id.tvDate)
        tvDescription = findViewById(R.id.tvDescription)
        commentsContainer = findViewById(R.id.commentsContainer)
        emptyComments = findViewById(R.id.emptyComments)
        editComment = findViewById(R.id.editComment)
        btnSend = findViewById(R.id.btnSend)
        priorityDot = findViewById(R.id.priorityDot)
        progressBar = findViewById(R.id.progressBar)

        btnSend.setOnClickListener { sendComment() }
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
