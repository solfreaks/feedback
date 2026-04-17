package com.feedbacksdk.ui

import android.content.res.ColorStateList
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.models.Feedback
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class FeedbackListActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyState: View
    private val feedbacks = mutableListOf<Feedback>()
    private lateinit var adapter: FeedbackAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_feedback_list)

        findViewById<MaterialToolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }

        recyclerView = findViewById(R.id.recyclerView)
        progressBar = findViewById(R.id.progressBar)
        emptyState = findViewById(R.id.emptyState)

        adapter = FeedbackAdapter(feedbacks) { feedback ->
            FeedbackSDK.openFeedbackDetail(this, feedback.id)
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        findViewById<MaterialButton>(R.id.btnSubmit).setOnClickListener {
            FeedbackSDK.openFeedback(this)
        }
    }

    override fun onResume() {
        super.onResume()
        loadFeedbacks()
    }

    private fun loadFeedbacks() {
        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            emptyState.visibility = View.GONE
            when (val result = FeedbackSDK.listFeedbacks()) {
                is SdkResult.Success -> {
                    feedbacks.clear()
                    feedbacks.addAll(result.data.feedbacks)
                    adapter.notifyDataSetChanged()
                    progressBar.visibility = View.GONE
                    emptyState.visibility = if (feedbacks.isEmpty()) View.VISIBLE else View.GONE
                }
                is SdkResult.Error -> {
                    progressBar.visibility = View.GONE
                    Toast.makeText(this@FeedbackListActivity, result.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private class FeedbackAdapter(
        private val feedbacks: List<Feedback>,
        private val onClick: (Feedback) -> Unit
    ) : RecyclerView.Adapter<FeedbackAdapter.ViewHolder>() {

        class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val stars: List<ImageView> = listOf(
                view.findViewById(R.id.star1),
                view.findViewById(R.id.star2),
                view.findViewById(R.id.star3),
                view.findViewById(R.id.star4),
                view.findViewById(R.id.star5),
            )
            val tvStatus: TextView = view.findViewById(R.id.tvStatus)
            val tvComment: TextView = view.findViewById(R.id.tvComment)
            val tvCategory: TextView = view.findViewById(R.id.tvCategory)
            val tvDate: TextView = view.findViewById(R.id.tvDate)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.sdk_item_feedback, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val ctx = holder.itemView.context
            val feedback = feedbacks[position]

            holder.stars.forEachIndexed { i, star ->
                star.setImageResource(
                    if (i < feedback.rating) R.drawable.sdk_ic_star_filled
                    else R.drawable.sdk_ic_star_outline
                )
            }

            holder.tvStatus.text = feedback.status.replace("_", " ")
            holder.tvStatus.backgroundTintList = ColorStateList.valueOf(ctx.statusColor(feedback.status))
            holder.tvStatus.setTextColor(ctx.resolveThemeColor(R.attr.sdkColorOnStatus))

            val comment = feedback.comment?.trim().orEmpty()
            if (comment.isEmpty()) {
                holder.tvComment.visibility = View.GONE
            } else {
                holder.tvComment.visibility = View.VISIBLE
                holder.tvComment.text = comment
            }

            holder.tvCategory.text = feedback.category
                .replace("_", " ")
                .replaceFirstChar { it.uppercase() }

            holder.tvDate.text = formatDate(feedback.createdAt)
            holder.itemView.setOnClickListener { onClick(feedback) }
        }

        override fun getItemCount() = feedbacks.size

        private fun formatDate(dateStr: String): String = try {
            val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            val output = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
            val date = input.parse(dateStr.substringBefore('.'))
            date?.let { output.format(it) } ?: dateStr
        } catch (_: Exception) {
            dateStr.substringBefore('T')
        }
    }
}
