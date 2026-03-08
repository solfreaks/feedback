package com.feedbacksdk.ui

import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.models.Comment
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class TicketDetailActivity : AppCompatActivity() {

    private lateinit var tvTitle: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvPriority: TextView
    private lateinit var tvDate: TextView
    private lateinit var tvDescription: TextView
    private lateinit var commentsContainer: LinearLayout
    private lateinit var tvNoComments: TextView
    private lateinit var editComment: TextInputEditText
    private lateinit var btnSend: MaterialButton
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

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        tvTitle = findViewById(R.id.tvTitle)
        tvStatus = findViewById(R.id.tvStatus)
        tvPriority = findViewById(R.id.tvPriority)
        tvDate = findViewById(R.id.tvDate)
        tvDescription = findViewById(R.id.tvDescription)
        commentsContainer = findViewById(R.id.commentsContainer)
        tvNoComments = findViewById(R.id.tvNoComments)
        editComment = findViewById(R.id.editComment)
        btnSend = findViewById(R.id.btnSend)
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
                    tvStatus.setBackgroundColor(getStatusColor(ticket.status))
                    tvPriority.text = "Priority: ${ticket.priority}"
                    tvDate.text = formatDate(ticket.createdAt)

                    val visibleComments = ticket.comments.filter { !it.isInternalNote }
                    if (visibleComments.isEmpty()) {
                        tvNoComments.visibility = View.VISIBLE
                    } else {
                        tvNoComments.visibility = View.GONE
                        commentsContainer.removeAllViews()
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
        val view = layoutInflater.inflate(android.R.layout.simple_list_item_2, commentsContainer, false)
        val text1 = view.findViewById<TextView>(android.R.id.text1)
        val text2 = view.findViewById<TextView>(android.R.id.text2)
        text1.text = comment.user?.name ?: "User"
        text1.textSize = 13f
        text1.setTextColor(Color.parseColor("#3B82F6"))
        text2.text = comment.body
        text2.textSize = 14f
        text2.setTextColor(Color.parseColor("#111827"))
        view.setPadding(0, 8, 0, 12)
        commentsContainer.addView(view)
    }

    private fun sendComment() {
        val body = editComment.text?.toString()?.trim() ?: ""
        if (body.isEmpty()) return

        btnSend.isEnabled = false
        lifecycleScope.launch {
            when (val result = FeedbackSDK.addComment(ticketId, body)) {
                is SdkResult.Success -> {
                    editComment.text?.clear()
                    tvNoComments.visibility = View.GONE
                    addCommentView(result.data)
                }
                is SdkResult.Error -> {
                    Toast.makeText(this@TicketDetailActivity, result.message, Toast.LENGTH_LONG).show()
                }
            }
            btnSend.isEnabled = true
        }
    }

    private fun getStatusColor(status: String): Int {
        return when (status) {
            "open" -> Color.parseColor("#3B82F6")
            "in_progress" -> Color.parseColor("#F59E0B")
            "resolved" -> Color.parseColor("#10B981")
            "closed" -> Color.parseColor("#6B7280")
            else -> Color.parseColor("#6B7280")
        }
    }

    private fun formatDate(dateStr: String): String {
        return try {
            val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            val output = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
            val date = input.parse(dateStr.substringBefore('.'))
            date?.let { output.format(it) } ?: dateStr
        } catch (_: Exception) {
            dateStr.substringBefore('T')
        }
    }
}
