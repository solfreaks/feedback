package com.feedbacksdk.ui

import android.content.res.ColorStateList
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
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
import com.feedbacksdk.internal.priorityColor
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.models.Ticket
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class TicketListActivity : AppCompatActivity() {

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            val sdkResult = FeedbackSDK.handleGoogleSignInResult(result.data)
            if (sdkResult is SdkResult.Success) {
                showContent()
                reloadTickets()
            } else {
                val msg = (sdkResult as? SdkResult.Error)?.message ?: getString(R.string.sdk_error_not_logged_in)
                Toast.makeText(this@TicketListActivity, msg, Toast.LENGTH_LONG).show()
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

    private val tickets = mutableListOf<Ticket>()
    private lateinit var adapter: TicketAdapter
    private var currentPage = 1
    private var totalPages = 1
    private var isLoadingMore = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_ticket_list)

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
        // Nudge FAB above the system navigation bar
        val fab = findViewById<ExtendedFloatingActionButton>(R.id.fabCreate)
        ViewCompat.setOnApplyWindowInsetsListener(fab) { v, insets ->
            val nav = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
            v.updatePadding(bottom = 0)
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
        swipeRefresh.setOnRefreshListener { reloadTickets() }
        emptyState = findViewById(R.id.emptyState)
        loginPrompt = findViewById(R.id.loginPrompt)
        loginPrompt.findViewById<View>(R.id.btnGoogleSignIn).setOnClickListener {
            @Suppress("DEPRECATION")
            googleSignInLauncher.launch(FeedbackSDK.getGoogleSignInIntent(this))
        }
        statusBanner = findViewById(R.id.statusBanner)
        ConnectivityMonitor.addListener(connectivityListener)

        adapter = TicketAdapter(
            onClick = { ticket -> FeedbackSDK.openTicketDetail(this, ticket.id) },
            onLoadMore = { loadMoreTickets() },
        )
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        fab.setOnClickListener { FeedbackSDK.openCreateTicket(this) }
    }

    override fun onResume() {
        super.onResume()
        if (!FeedbackSDK.isLoggedIn) { showLoginPrompt(); return }
        showContent()
        reloadTickets()
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

    /** Full refresh — resets to page 1. Used on first load, swipe-refresh, and onResume. */
    private fun reloadTickets() {
        currentPage = 1
        totalPages = 1
        loadTickets(page = 1, append = false)
    }

    /** Appends the next page to the existing list. */
    private fun loadMoreTickets() {
        if (isLoadingMore || currentPage >= totalPages) return
        loadTickets(page = currentPage + 1, append = true)
    }

    private fun loadTickets(page: Int, append: Boolean) {
        lifecycleScope.launch {
            if (!append) {
                val firstLoad = tickets.isEmpty()
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

            when (val result = FeedbackSDK.listTickets(page = page)) {
                is SdkResult.Success -> {
                    val data = result.data
                    currentPage = page
                    totalPages = data.totalPages
                    if (append) {
                        tickets.addAll(data.tickets)
                    } else {
                        tickets.clear()
                        tickets.addAll(data.tickets)
                    }
                    val hasMore = currentPage < totalPages
                    adapter.setItems(tickets.toList(), hasMore)
                    shimmerContainer.stopShimmer()
                    shimmerContainer.visibility = View.GONE
                    recyclerView.visibility = View.VISIBLE
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    emptyState.visibility = if (tickets.isEmpty()) View.VISIBLE else View.GONE
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
                    if (tickets.isEmpty()) {
                        Toast.makeText(this@TicketListActivity, result.message, Toast.LENGTH_LONG).show()
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
            lastLoadFailed -> StatusBanner.showError(statusBanner) { reloadTickets() }
            else -> StatusBanner.hide(statusBanner)
        }
    }

    override fun onDestroy() {
        ConnectivityMonitor.removeListener(connectivityListener)
        super.onDestroy()
    }

    private class TicketAdapter(
        private val onClick: (Ticket) -> Unit,
        private val onLoadMore: () -> Unit,
    ) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

        private val rows = mutableListOf<Ticket>()
        private var showLoadMore = false
        private var loadingMore = false

        fun setItems(items: List<Ticket>, hasMore: Boolean) {
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
            if (position < rows.size) TYPE_TICKET else TYPE_FOOTER

        override fun getItemCount() = rows.size + if (showLoadMore) 1 else 0

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == TYPE_TICKET) {
                TicketVH(inflater.inflate(R.layout.sdk_item_ticket, parent, false))
            } else {
                FooterVH(inflater.inflate(R.layout.sdk_item_load_more, parent, false))
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            if (holder is TicketVH) bindTicket(holder, rows[position])
            else if (holder is FooterVH) bindFooter(holder)
        }

        private fun bindTicket(holder: TicketVH, ticket: Ticket) {
            val ctx = holder.itemView.context
            holder.tvTitle.text = ticket.title
            holder.tvTitle.contentDescription = ticket.title

            holder.tvStatus.text = ticket.status.replace("_", " ")
            holder.tvStatus.backgroundTintList = ColorStateList.valueOf(ctx.statusColor(ticket.status))
            holder.tvStatus.setTextColor(ctx.resolveThemeColor(R.attr.sdkColorOnStatus))
            holder.tvStatus.contentDescription = ctx.getString(R.string.sdk_status_label, ticket.status.replace("_", " "))

            val priorityTint = ColorStateList.valueOf(ctx.priorityColor(ticket.priority))
            holder.priorityDot.backgroundTintList = priorityTint
            holder.ivPriorityIcon.imageTintList = priorityTint
            holder.tvPriority.text = ticket.priority.replaceFirstChar { it.uppercase() }
            holder.tvPriority.contentDescription = ctx.getString(R.string.sdk_priority_label, ticket.priority.replaceFirstChar { it.uppercase() })

            holder.tvDate.text = formatDate(ticket.createdAt)
            holder.unreadDot.visibility =
                if (UnreadStore.isTicketUnread(ticket.id, ticket.updatedAt)) View.VISIBLE else View.GONE
            holder.unreadDot.contentDescription =
                if (UnreadStore.isTicketUnread(ticket.id, ticket.updatedAt)) ctx.getString(R.string.sdk_unread_indicator) else null
            holder.itemView.setOnClickListener { onClick(ticket) }
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

        class TicketVH(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvTitle)
            val tvStatus: TextView = view.findViewById(R.id.tvStatus)
            val tvPriority: TextView = view.findViewById(R.id.tvPriority)
            val tvDate: TextView = view.findViewById(R.id.tvDate)
            val priorityDot: View = view.findViewById(R.id.priorityDot)
            val ivPriorityIcon: android.widget.ImageView = view.findViewById(R.id.ivPriorityIcon)
            val unreadDot: View = view.findViewById(R.id.unreadDot)
        }

        class FooterVH(view: View) : RecyclerView.ViewHolder(view) {
            val btnLoadMore: View = view.findViewById(R.id.btnLoadMore)
            val progress: ProgressBar = view.findViewById(R.id.loadMoreProgress)
        }

        companion object {
            private const val TYPE_TICKET = 0
            private const val TYPE_FOOTER = 1
        }
    }
}
