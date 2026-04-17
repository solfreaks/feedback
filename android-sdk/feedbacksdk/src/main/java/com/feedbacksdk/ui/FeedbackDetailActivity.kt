package com.feedbacksdk.ui

import android.content.res.ColorStateList
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.models.FeedbackReply
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class FeedbackDetailActivity : AppCompatActivity() {

    private lateinit var stars: List<ImageView>
    private lateinit var tvStatus: TextView
    private lateinit var tvCategory: TextView
    private lateinit var tvDate: TextView
    private lateinit var tvComment: TextView
    private lateinit var repliesContainer: LinearLayout
    private lateinit var emptyReplies: View
    private lateinit var progressBar: View

    private var feedbackId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_feedback_detail)

        feedbackId = intent.getStringExtra("feedback_id") ?: run {
            finish()
            return
        }

        findViewById<MaterialToolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }

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
        repliesContainer = findViewById(R.id.repliesContainer)
        emptyReplies = findViewById(R.id.emptyReplies)
        progressBar = findViewById(R.id.progressBar)

        loadFeedback()
    }

    private fun loadFeedback() {
        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            when (val result = FeedbackSDK.getFeedback(feedbackId)) {
                is SdkResult.Success -> {
                    progressBar.visibility = View.GONE
                    val feedback = result.data

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

                    repliesContainer.removeAllViews()
                    if (feedback.replies.isEmpty()) {
                        emptyReplies.visibility = View.VISIBLE
                    } else {
                        emptyReplies.visibility = View.GONE
                        feedback.replies.forEach { addReplyView(it) }
                    }
                }
                is SdkResult.Error -> {
                    progressBar.visibility = View.GONE
                    Toast.makeText(this@FeedbackDetailActivity, result.message, Toast.LENGTH_LONG).show()
                }
            }
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
