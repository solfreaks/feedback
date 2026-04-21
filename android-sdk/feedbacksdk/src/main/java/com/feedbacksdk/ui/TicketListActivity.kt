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
import com.feedbacksdk.internal.priorityColor
import com.feedbacksdk.internal.resolveThemeColor
import com.feedbacksdk.internal.statusColor
import com.feedbacksdk.models.Ticket
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

class TicketListActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var shimmerContainer: com.facebook.shimmer.ShimmerFrameLayout
    private lateinit var swipeRefresh: androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    private lateinit var emptyState: View
    private lateinit var statusBanner: android.widget.LinearLayout
    private var lastLoadFailed = false
    private val connectivityListener = ConnectivityMonitor.Listener { online ->
        runOnUiThread { refreshBanner(online) }
    }
    private val tickets = mutableListOf<Ticket>()
    private lateinit var adapter: TicketAdapter

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
            bottomView = findViewById(R.id.bottomBar),
        )

        recyclerView = findViewById(R.id.recyclerView)
        progressBar = findViewById(R.id.progressBar)
        shimmerContainer = findViewById(R.id.shimmerContainer)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        swipeRefresh.setOnRefreshListener { loadTickets() }
        emptyState = findViewById(R.id.emptyState)
        statusBanner = findViewById(R.id.statusBanner)
        ConnectivityMonitor.addListener(connectivityListener)

        adapter = TicketAdapter { ticket ->
            FeedbackSDK.openTicketDetail(this, ticket.id)
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        findViewById<MaterialButton>(R.id.btnCreate).setOnClickListener {
            FeedbackSDK.openCreateTicket(this)
        }
        emptyState.findViewById<MaterialButton>(R.id.btnEmptyCreate)?.setOnClickListener {
            FeedbackSDK.openCreateTicket(this)
        }
    }

    override fun onResume() {
        super.onResume()
        loadTickets()
    }

    private fun loadTickets() {
        lifecycleScope.launch {
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
            when (val result = FeedbackSDK.listTickets()) {
                is SdkResult.Success -> {
                    tickets.clear()
                    tickets.addAll(result.data.tickets)
                    adapter.submitList(tickets.toList())
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
                    lastLoadFailed = true
                    refreshBanner(ConnectivityMonitor.isOnline)
                    // Only surface the toast if we had nothing to show — otherwise
                    // the banner is enough feedback and the stale list is useful.
                    if (tickets.isEmpty()) {
                        Toast.makeText(this@TicketListActivity, result.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    /**
     * Resolve banner state: offline wins; otherwise show a retry banner if
     * the last fetch failed; otherwise hide. Exposed for the connectivity
     * listener and the load callbacks.
     */
    private fun refreshBanner(online: Boolean) {
        when {
            !online -> StatusBanner.showOffline(statusBanner)
            lastLoadFailed -> StatusBanner.showError(statusBanner) { loadTickets() }
            else -> StatusBanner.hide(statusBanner)
        }
    }

    override fun onDestroy() {
        ConnectivityMonitor.removeListener(connectivityListener)
        super.onDestroy()
    }

    private class TicketAdapter(
        private val onClick: (Ticket) -> Unit
    ) : androidx.recyclerview.widget.ListAdapter<Ticket, TicketAdapter.ViewHolder>(DIFF) {

        class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvTitle)
            val tvStatus: TextView = view.findViewById(R.id.tvStatus)
            val tvPriority: TextView = view.findViewById(R.id.tvPriority)
            val tvDate: TextView = view.findViewById(R.id.tvDate)
            val priorityDot: View = view.findViewById(R.id.priorityDot)
            val ivPriorityIcon: android.widget.ImageView = view.findViewById(R.id.ivPriorityIcon)
            val unreadDot: View = view.findViewById(R.id.unreadDot)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.sdk_item_ticket, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val ctx = holder.itemView.context
            val ticket = getItem(position)

            holder.tvTitle.text = ticket.title

            holder.tvStatus.text = ticket.status.replace("_", " ")
            holder.tvStatus.backgroundTintList = ColorStateList.valueOf(ctx.statusColor(ticket.status))
            holder.tvStatus.setTextColor(ctx.resolveThemeColor(R.attr.sdkColorOnStatus))

            val priorityTint = ColorStateList.valueOf(ctx.priorityColor(ticket.priority))
            holder.priorityDot.backgroundTintList = priorityTint
            holder.ivPriorityIcon.imageTintList = priorityTint
            holder.tvPriority.text = ticket.priority.replaceFirstChar { it.uppercase() }

            holder.tvDate.text = formatDate(ticket.createdAt)
            holder.unreadDot.visibility =
                if (com.feedbacksdk.internal.UnreadStore.isTicketUnread(ticket.id, ticket.updatedAt))
                    View.VISIBLE else View.GONE
            holder.itemView.setOnClickListener { onClick(ticket) }
        }

        private fun formatDate(dateStr: String): String = try {
            val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            val output = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
            val date = input.parse(dateStr.substringBefore('.'))
            date?.let { output.format(it) } ?: dateStr
        } catch (_: Exception) {
            dateStr.substringBefore('T')
        }

        companion object {
            private val DIFF = object : androidx.recyclerview.widget.DiffUtil.ItemCallback<Ticket>() {
                override fun areItemsTheSame(old: Ticket, new: Ticket) = old.id == new.id
                override fun areContentsTheSame(old: Ticket, new: Ticket) = old == new
            }
        }
    }
}
