package com.feedbacksdk.ui

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
import com.feedbacksdk.internal.UnreadStore
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.models.Announcement
import com.feedbacksdk.models.Notification
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.tabs.TabLayout
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Pre-built notifications screen. Shows two tabs:
 *   - Activity: per-user notifications (new comment, mention, status change)
 *   - Announcements: broadcasts pushed by the app's admins via FCM topic
 *
 * Tapping an Activity entry routes to the linked ticket/feedback detail.
 * Tapping an Announcement opens the embedded link externally if present.
 */
class NotificationsActivity : AppCompatActivity() {

    private enum class Tab { ACTIVITY, ANNOUNCEMENTS }

    private lateinit var recycler: RecyclerView
    private lateinit var progress: ProgressBar
    private lateinit var emptyState: View
    private lateinit var statusBanner: android.widget.LinearLayout
    private lateinit var tabs: TabLayout

    private val activityItems = mutableListOf<Notification>()
    private val announcementItems = mutableListOf<Announcement>()
    private sealed class Row {
        data class Activity(val n: Notification) : Row()
        data class Announce(val a: Announcement) : Row()
    }
    private val unifiedAdapter = UnifiedAdapter()
    private var currentTab: Tab = Tab.ACTIVITY
    private var lastLoadFailed = false

    private val connectivityListener = ConnectivityMonitor.Listener { online ->
        runOnUiThread { refreshBanner(online) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_notifications)

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }
        toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_mark_all_read) {
                markAllRead()
                true
            } else false
        }
        toolbar.inflateMenu(R.menu.sdk_notifications_menu)
        applySystemBarInsets(topView = appBar, bottomView = null)

        recycler = findViewById(R.id.recyclerView)
        progress = findViewById(R.id.progressBar)
        emptyState = findViewById(R.id.emptyState)
        statusBanner = findViewById(R.id.statusBanner)
        tabs = findViewById(R.id.tabs)
        ConnectivityMonitor.addListener(connectivityListener)

        recycler.layoutManager = LinearLayoutManager(this)
        recycler.adapter = unifiedAdapter

        tabs.addTab(tabs.newTab().setText(R.string.sdk_tab_activity))
        tabs.addTab(tabs.newTab().setText(R.string.sdk_tab_announcements))
        tabs.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab) {
                currentTab = if (tab.position == 0) Tab.ACTIVITY else Tab.ANNOUNCEMENTS
                renderCurrent()
                if (currentTab == Tab.ANNOUNCEMENTS) markAnnouncementsSeen()
            }
            override fun onTabUnselected(tab: TabLayout.Tab) {}
            override fun onTabReselected(tab: TabLayout.Tab) {}
        })
    }

    override fun onDestroy() {
        ConnectivityMonitor.removeListener(connectivityListener)
        super.onDestroy()
    }

    private fun refreshBanner(online: Boolean) {
        when {
            !online -> StatusBanner.showOffline(statusBanner)
            lastLoadFailed -> StatusBanner.showError(statusBanner) { load() }
            else -> StatusBanner.hide(statusBanner)
        }
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun load() {
        lifecycleScope.launch {
            progress.visibility = View.VISIBLE
            emptyState.visibility = View.GONE

            val notificationResult = FeedbackSDK.listNotifications()
            val announcementResult = FeedbackSDK.listAnnouncements()

            var anyFailed = false
            if (notificationResult is SdkResult.Success) {
                activityItems.clear()
                activityItems.addAll(notificationResult.data.notifications)
            } else {
                anyFailed = true
            }
            if (announcementResult is SdkResult.Success) {
                announcementItems.clear()
                announcementItems.addAll(announcementResult.data.announcements)
            } else {
                anyFailed = true
            }

            progress.visibility = View.GONE
            lastLoadFailed = anyFailed
            refreshBanner(ConnectivityMonitor.isOnline)
            renderCurrent()

            if (anyFailed && activityItems.isEmpty() && announcementItems.isEmpty()) {
                val msg = (notificationResult as? SdkResult.Error)?.message
                    ?: (announcementResult as? SdkResult.Error)?.message
                    ?: "Failed to load"
                Toast.makeText(this@NotificationsActivity, msg, Toast.LENGTH_LONG).show()
            }
        }
    }

    /** Swap the adapter's data source based on the active tab. */
    private fun renderCurrent() {
        unifiedAdapter.setItems(
            when (currentTab) {
                Tab.ACTIVITY -> activityItems.map { Row.Activity(it) }
                Tab.ANNOUNCEMENTS -> announcementItems.map { Row.Announce(it) }
            }
        )
        val empty = when (currentTab) {
            Tab.ACTIVITY -> activityItems.isEmpty()
            Tab.ANNOUNCEMENTS -> announcementItems.isEmpty()
        }
        emptyState.visibility = if (empty) View.VISIBLE else View.GONE
        emptyState.findViewById<TextView>(R.id.tvEmptyTitle)?.setText(
            if (currentTab == Tab.ACTIVITY) R.string.sdk_no_notifications
            else R.string.sdk_no_announcements
        )
        emptyState.findViewById<TextView>(R.id.tvEmptySubtitle)?.setText(
            if (currentTab == Tab.ACTIVITY) R.string.sdk_no_notifications_subtitle
            else R.string.sdk_no_announcements_subtitle
        )
    }

    private fun markAnnouncementsSeen() {
        val newest = announcementItems.maxByOrNull { it.createdAt }?.createdAt ?: return
        UnreadStore.markAnnouncementsSeenUpTo(newest)
    }

    private fun markAllRead() {
        lifecycleScope.launch {
            FeedbackSDK.markAllNotificationsRead()
            markAnnouncementsSeen()
            load()
        }
    }

    private fun handleActivityClick(n: Notification) {
        lifecycleScope.launch {
            if (!n.isRead) FeedbackSDK.markNotificationRead(n.id)
            val link = n.link ?: return@launch
            val ticketMatch = Regex("/tickets/([^/]+)").find(link)
            val feedbackMatch = Regex("/feedbacks/([^/]+)").find(link)
            when {
                ticketMatch != null -> FeedbackSDK.openTicketDetail(this@NotificationsActivity, ticketMatch.groupValues[1])
                feedbackMatch != null -> FeedbackSDK.openFeedbackDetail(this@NotificationsActivity, feedbackMatch.groupValues[1])
            }
        }
    }

    private fun handleAnnouncementClick(a: Announcement) {
        val link = a.link?.trim().orEmpty()
        if (link.isEmpty()) return
        // Absolute URL → hand off to the system. Relative paths we interpret
        // the same way as Activity links (ticket/feedback deep links).
        if (link.startsWith("http", ignoreCase = true)) {
            try {
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(link)))
            } catch (_: Exception) { /* no browser available — silent */ }
            return
        }
        val ticketMatch = Regex("/tickets/([^/]+)").find(link)
        val feedbackMatch = Regex("/feedbacks/([^/]+)").find(link)
        when {
            ticketMatch != null -> FeedbackSDK.openTicketDetail(this, ticketMatch.groupValues[1])
            feedbackMatch != null -> FeedbackSDK.openFeedbackDetail(this, feedbackMatch.groupValues[1])
        }
    }

    private inner class UnifiedAdapter : RecyclerView.Adapter<UnifiedAdapter.VH>() {

        private val rows = mutableListOf<Row>()

        fun setItems(items: List<Row>) {
            rows.clear()
            rows.addAll(items)
            notifyDataSetChanged()
        }

        inner class VH(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvTitle)
            val tvBody: TextView = view.findViewById(R.id.tvBody)
            val tvTime: TextView = view.findViewById(R.id.tvTime)
            val unreadDot: View = view.findViewById(R.id.unreadDot)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
            val v = LayoutInflater.from(parent.context)
                .inflate(R.layout.sdk_item_notification, parent, false)
            return VH(v)
        }

        override fun onBindViewHolder(holder: VH, position: Int) {
            when (val row = rows[position]) {
                is Row.Activity -> {
                    val n = row.n
                    holder.tvTitle.text = n.title
                    holder.tvBody.text = n.message
                    holder.tvTime.text = formatTime(n.createdAt)
                    holder.unreadDot.visibility = if (n.isRead) View.GONE else View.VISIBLE
                    holder.itemView.alpha = if (n.isRead) 0.7f else 1f
                    holder.itemView.setOnClickListener { handleActivityClick(n) }
                }
                is Row.Announce -> {
                    val a = row.a
                    val seenAt = UnreadStore.lastAnnouncementSeenAt()
                    val unread = seenAt == null || a.createdAt > seenAt
                    holder.tvTitle.text = a.title
                    holder.tvBody.text = a.body
                    holder.tvTime.text = formatTime(a.createdAt)
                    holder.unreadDot.visibility = if (unread) View.VISIBLE else View.GONE
                    holder.itemView.alpha = if (unread) 1f else 0.75f
                    holder.itemView.setOnClickListener { handleAnnouncementClick(a) }
                }
            }
        }

        override fun getItemCount(): Int = rows.size
    }

    companion object {
        internal fun formatTime(dateStr: String): String = try {
            val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            input.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val date = input.parse(dateStr.substringBefore('.'))?.time ?: return dateStr
            val diff = System.currentTimeMillis() - date
            when {
                diff < 60_000 -> "Just now"
                diff < 3600_000 -> "${diff / 60_000}m ago"
                diff < 86400_000 -> "${diff / 3600_000}h ago"
                diff < 7L * 86400_000 -> "${diff / 86400_000}d ago"
                else -> SimpleDateFormat("MMM dd", Locale.getDefault()).format(java.util.Date(date))
            }
        } catch (_: Exception) {
            dateStr.substringBefore('T')
        }
    }
}
