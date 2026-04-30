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
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
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
import com.feedbacksdk.models.Feedback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class FeedbackListActivity : AppCompatActivity() {

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            val sdkResult = FeedbackSDK.handleGoogleSignInResult(result.data)
            if (sdkResult is SdkResult.Success) {
                showContent()
                reloadFeedbacks()
            } else {
                val msg = (sdkResult as? SdkResult.Error)?.message ?: getString(R.string.sdk_error_not_logged_in)
                Toast.makeText(this@FeedbackListActivity, msg, Toast.LENGTH_LONG).show()
            }
        }
    }

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var shimmerContainer: com.facebook.shimmer.ShimmerFrameLayout
    private lateinit var swipeRefresh: androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    private lateinit var emptyState: View
    private lateinit var loginPrompt: View
    private lateinit var statusBanner: android.widget.LinearLayout
    private var lastLoadFailed = false
    private val connectivityListener = ConnectivityMonitor.Listener { online ->
        runOnUiThread { refreshBanner(online) }
    }

    private val feedbacks = mutableListOf<Feedback>()
    private lateinit var adapter: FeedbackAdapter
    private var currentPage = 1
    private var totalPages = 1
    private var isLoadingMore = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_feedback_list)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }
        toolbar.inflateMenu(R.menu.sdk_list_menu)
        toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_notifications) {
                FeedbackSDK.openNotifications(this)
                true
            } else false
        }
        applySystemBarInsets(
            topView = findViewById<AppBarLayout>(R.id.appBar),
            bottomView = null,
        )
        val fab = findViewById<ExtendedFloatingActionButton>(R.id.fabSubmit)
        ViewCompat.setOnApplyWindowInsetsListener(fab) { v, insets ->
            val nav = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
            (v.layoutParams as? androidx.coordinatorlayout.widget.CoordinatorLayout.LayoutParams)
                ?.bottomMargin = nav + resources.getDimensionPixelSize(R.dimen.sdk_fab_margin)
            insets
        }

        recyclerView = findViewById(R.id.recyclerView)
        progressBar = findViewById(R.id.progressBar)
        @Suppress("UNCHECKED_CAST")
        shimmerContainer = findViewById<View>(R.id.shimmerContainer) as com.facebook.shimmer.ShimmerFrameLayout
        @Suppress("UNCHECKED_CAST")
        swipeRefresh = findViewById<View>(R.id.swipeRefresh) as androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        swipeRefresh.setOnRefreshListener { reloadFeedbacks() }
        emptyState = findViewById(R.id.emptyState)
        loginPrompt = findViewById(R.id.loginPrompt)
        loginPrompt.findViewById<View>(R.id.btnGoogleSignIn).setOnClickListener {
            @Suppress("DEPRECATION")
            googleSignInLauncher.launch(FeedbackSDK.getGoogleSignInIntent(this))
        }
        statusBanner = findViewById(R.id.statusBanner)
        ConnectivityMonitor.addListener(connectivityListener)

        adapter = FeedbackAdapter(
            onClick = { feedback -> FeedbackSDK.openFeedbackDetail(this, feedback.id) },
            onLoadMore = { loadMoreFeedbacks() },
        )
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        fab.setOnClickListener { FeedbackSDK.openFeedback(this) }
    }

    override fun onResume() {
        super.onResume()
        if (!FeedbackSDK.isLoggedIn) { showLoginPrompt(); return }
        showContent()
        reloadFeedbacks()
    }

    private fun showLoginPrompt() {
        shimmerContainer.stopShimmer()
        shimmerContainer.visibility = View.GONE
        recyclerView.visibility = View.GONE
        swipeRefresh.isRefreshing = false
        emptyState.visibility = View.GONE
        loginPrompt.visibility = View.VISIBLE
    }

    private fun showContent() {
        loginPrompt.visibility = View.GONE
    }

    private fun reloadFeedbacks() {
        currentPage = 1
        totalPages = 1
        loadFeedbacks(page = 1, append = false)
    }

    private fun loadMoreFeedbacks() {
        if (isLoadingMore || currentPage >= totalPages) return
        loadFeedbacks(page = currentPage + 1, append = true)
    }

    private fun loadFeedbacks(page: Int, append: Boolean) {
        lifecycleScope.launch {
            if (!append) {
                val firstLoad = feedbacks.isEmpty()
                val swipe = swipeRefresh.isRefreshing
                if (firstLoad && !swipe) {
                    shimmerContainer.visibility = View.VISIBLE
                    shimmerContainer.startShimmer()
                    recyclerView.visibility = View.GONE
                } else if (!swipe) {
                    progressBar.visibility = View.VISIBLE
                }
                emptyState.visibility = View.GONE
            } else {
                isLoadingMore = true
                adapter.setLoadingMore(true)
            }

            when (val result = FeedbackSDK.listFeedbacks(page = page)) {
                is SdkResult.Success -> {
                    val data = result.data
                    currentPage = page
                    totalPages = data.totalPages
                    if (append) {
                        feedbacks.addAll(data.feedbacks)
                    } else {
                        feedbacks.clear()
                        feedbacks.addAll(data.feedbacks)
                    }
                    val hasMore = currentPage < totalPages
                    adapter.setItems(feedbacks.toList(), hasMore)
                    shimmerContainer.stopShimmer()
                    shimmerContainer.visibility = View.GONE
                    recyclerView.visibility = View.VISIBLE
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    emptyState.visibility = if (feedbacks.isEmpty()) View.VISIBLE else View.GONE
                    lastLoadFailed = false
                    refreshBanner(ConnectivityMonitor.isOnline)
                }
                is SdkResult.Error -> {
                    shimmerContainer.stopShimmer()
                    shimmerContainer.visibility = View.GONE
                    recyclerView.visibility = View.VISIBLE
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    lastLoadFailed = !append
                    refreshBanner(ConnectivityMonitor.isOnline)
                    if (feedbacks.isEmpty()) {
                        Toast.makeText(this@FeedbackListActivity, result.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            isLoadingMore = false
            adapter.setLoadingMore(false)
        }
    }

    private fun refreshBanner(online: Boolean) {
        when {
            !online -> StatusBanner.showOffline(statusBanner)
            lastLoadFailed -> StatusBanner.showError(statusBanner) { reloadFeedbacks() }
            else -> StatusBanner.hide(statusBanner)
        }
    }

    override fun onDestroy() {
        ConnectivityMonitor.removeListener(connectivityListener)
        super.onDestroy()
    }

    private class FeedbackAdapter(
        private val onClick: (Feedback) -> Unit,
        private val onLoadMore: () -> Unit,
    ) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

        private val rows = mutableListOf<Feedback>()
        private var showLoadMore = false
        private var loadingMore = false

        fun setItems(items: List<Feedback>, hasMore: Boolean) {
            rows.clear()
            rows.addAll(items)
            showLoadMore = hasMore
            notifyDataSetChanged()
        }

        fun setLoadingMore(loading: Boolean) {
            loadingMore = loading
            notifyDataSetChanged()
        }

        override fun getItemViewType(position: Int) =
            if (position < rows.size) TYPE_FEEDBACK else TYPE_FOOTER

        override fun getItemCount() = rows.size + if (showLoadMore) 1 else 0

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == TYPE_FEEDBACK) {
                FeedbackVH(inflater.inflate(R.layout.sdk_item_feedback, parent, false))
            } else {
                FooterVH(inflater.inflate(R.layout.sdk_item_load_more, parent, false))
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            if (holder is FeedbackVH) bindFeedback(holder, rows[position])
            else if (holder is FooterVH) bindFooter(holder)
        }

        private fun bindFeedback(holder: FeedbackVH, feedback: Feedback) {
            val ctx = holder.itemView.context

            holder.stars.forEachIndexed { i, star ->
                star.setImageResource(
                    if (i < feedback.rating) R.drawable.sdk_ic_star_filled
                    else R.drawable.sdk_ic_star_outline
                )
            }
            holder.stars.firstOrNull()?.contentDescription =
                ctx.getString(R.string.sdk_star_rating_selected, feedback.rating)

            holder.tvStatus.text = feedback.status.replace("_", " ")
            holder.tvStatus.backgroundTintList = ColorStateList.valueOf(ctx.statusColor(feedback.status))
            holder.tvStatus.setTextColor(ctx.resolveThemeColor(R.attr.sdkColorOnStatus))
            holder.tvStatus.contentDescription = ctx.getString(R.string.sdk_status_label, feedback.status.replace("_", " "))

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
            val isUnread = UnreadStore.isFeedbackUnread(feedback.id, feedback.count?.replies ?: 0)
            holder.unreadDot.visibility = if (isUnread) View.VISIBLE else View.GONE
            holder.unreadDot.contentDescription = if (isUnread) ctx.getString(R.string.sdk_unread_indicator) else null
            holder.itemView.setOnClickListener { onClick(feedback) }
        }

        private fun bindFooter(holder: FooterVH) {
            holder.btnLoadMore.visibility = if (loadingMore) View.INVISIBLE else View.VISIBLE
            holder.progress.visibility = if (loadingMore) View.VISIBLE else View.GONE
            holder.btnLoadMore.setOnClickListener { onLoadMore() }
        }

        private fun formatDate(dateStr: String): String = try {
            val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            val output = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
            input.parse(dateStr.substringBefore('.'))?.let { output.format(it) } ?: dateStr
        } catch (_: Exception) { dateStr.substringBefore('T') }

        class FeedbackVH(view: View) : RecyclerView.ViewHolder(view) {
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
            val unreadDot: View = view.findViewById(R.id.unreadDot)
        }

        class FooterVH(view: View) : RecyclerView.ViewHolder(view) {
            val btnLoadMore: View = view.findViewById(R.id.btnLoadMore)
            val progress: ProgressBar = view.findViewById(R.id.loadMoreProgress)
        }

        companion object {
            private const val TYPE_FEEDBACK = 0
            private const val TYPE_FOOTER = 1
        }
    }
}
