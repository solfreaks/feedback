package com.feedbacksdk.ui

import android.graphics.Canvas
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ItemTouchHelper
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
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.tabs.TabLayout
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class NotificationsActivity : AppCompatActivity() {

    private enum class Tab { ACTIVITY, ANNOUNCEMENTS }

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            val sdkResult = FeedbackSDK.handleGoogleSignInResult(result.data)
            if (sdkResult is SdkResult.Success) {
                load()
            } else {
                val msg = (sdkResult as? SdkResult.Error)?.message ?: getString(R.string.sdk_error_not_logged_in)
                Toast.makeText(this@NotificationsActivity, msg, Toast.LENGTH_LONG).show()
            }
        }
    }

    private lateinit var recycler: RecyclerView
    private lateinit var shimmerContainer: com.facebook.shimmer.ShimmerFrameLayout
    private lateinit var swipeRefresh: androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    private lateinit var emptyState: View
    private lateinit var tvEmptyTitle: TextView
    private lateinit var tvEmptySubtitle: TextView
    private lateinit var ivEmptyIcon: ImageView
    private lateinit var statusBanner: android.widget.LinearLayout
    private lateinit var tabs: TabLayout
    private lateinit var toolbar: MaterialToolbar

    private val activityItems = mutableListOf<Notification>()
    private val announcementItems = mutableListOf<Announcement>()

    private sealed class Row {
        data class Header(val label: String) : Row()
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
        toolbar = findViewById(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }
        toolbar.inflateMenu(R.menu.sdk_notifications_menu)
        toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_mark_all_read) { markAllRead(); true } else false
        }
        val bottomNav = findViewById<BottomNavigationView>(R.id.bottomNav)
        applySystemBarInsets(topView = appBar, bottomView = bottomNav)
        bottomNav.selectedItemId = R.id.nav_notifications
        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_tickets -> { FeedbackSDK.openTicketList(this); true }
                R.id.nav_feedback -> { FeedbackSDK.openFeedbackList(this); true }
                else -> true
            }
        }

        recycler = findViewById(R.id.recyclerView)
        shimmerContainer = findViewById<View>(R.id.shimmerContainer) as com.facebook.shimmer.ShimmerFrameLayout
        swipeRefresh = findViewById<View>(R.id.swipeRefresh) as androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        swipeRefresh.setOnRefreshListener { load() }

        // Keep list items visible above the bottom nav
        ViewCompat.setOnApplyWindowInsetsListener(recycler) { v, insets ->
            val nav = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom
            v.updatePadding(bottom = nav + resources.getDimensionPixelSize(R.dimen.sdk_fab_margin))
            insets
        }

        emptyState = findViewById(R.id.emptyState)
        tvEmptyTitle = emptyState.findViewById(R.id.tvEmptyTitle)
        tvEmptySubtitle = emptyState.findViewById(R.id.tvEmptySubtitle)
        ivEmptyIcon = emptyState.findViewById(R.id.ivEmptyIcon)
        emptyState.findViewById<View>(R.id.btnEmptyRefresh)?.setOnClickListener { load() }

        statusBanner = findViewById(R.id.statusBanner)
        tabs = findViewById(R.id.tabs)
        ConnectivityMonitor.addListener(connectivityListener)

        recycler.layoutManager = LinearLayoutManager(this)
        recycler.adapter = unifiedAdapter
        attachSwipeToDismiss()

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

    override fun onResume() {
        super.onResume()
        if (!FeedbackSDK.isLoggedIn) {
            showLoginPrompt()
            return
        }
        load()
    }

    private fun showLoginPrompt() {
        shimmerContainer.visibility = View.GONE
        recycler.visibility = View.GONE
        emptyState.visibility = View.VISIBLE
        tvEmptyTitle.setText(R.string.sdk_login_required_title)
        tvEmptySubtitle.setText(R.string.sdk_login_required_subtitle)
        ivEmptyIcon.setImageResource(R.drawable.sdk_ic_circle_user)
        val btnRefresh = emptyState.findViewById<com.google.android.material.button.MaterialButton>(R.id.btnEmptyRefresh)
        btnRefresh?.setText(R.string.sdk_sign_in)
        btnRefresh?.setOnClickListener {
            googleSignInLauncher.launch(FeedbackSDK.getGoogleSignInIntent(this))
        }
    }

    private fun refreshBanner(online: Boolean) {
        when {
            !online -> StatusBanner.showOffline(statusBanner)
            lastLoadFailed -> StatusBanner.showError(statusBanner) { load() }
            else -> StatusBanner.hide(statusBanner)
        }
    }

    private fun load() {
        lifecycleScope.launch {
            val firstLoad = activityItems.isEmpty() && announcementItems.isEmpty()
            val swipe = swipeRefresh.isRefreshing
            if (firstLoad && !swipe) {
                shimmerContainer.visibility = View.VISIBLE
                shimmerContainer.startShimmer()
                recycler.visibility = View.GONE
                emptyState.visibility = View.GONE
            } else if (!swipe) {
                // keep list visible, just show progress in toolbar
            }

            val notificationResult = FeedbackSDK.listNotifications()
            val announcementResult = FeedbackSDK.listAnnouncements()

            var anyFailed = false
            if (notificationResult is SdkResult.Success) {
                activityItems.clear()
                activityItems.addAll(notificationResult.data.notifications)
            } else anyFailed = true

            if (announcementResult is SdkResult.Success) {
                announcementItems.clear()
                announcementItems.addAll(announcementResult.data.announcements)
            } else anyFailed = true

            shimmerContainer.stopShimmer()
            shimmerContainer.visibility = View.GONE
            recycler.visibility = View.VISIBLE
            swipeRefresh.isRefreshing = false
            lastLoadFailed = anyFailed
            refreshBanner(ConnectivityMonitor.isOnline)
            updateTabBadges()
            updateMarkAllReadVisibility()
            renderCurrent()

            if (anyFailed && activityItems.isEmpty() && announcementItems.isEmpty()) {
                val msg = (notificationResult as? SdkResult.Error)?.message
                    ?: (announcementResult as? SdkResult.Error)?.message
                    ?: getString(R.string.sdk_server_unreachable)
                Toast.makeText(this@NotificationsActivity, msg, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun updateTabBadges() {
        val unreadCount = activityItems.count { !it.isRead }
        val activityTab = tabs.getTabAt(0)
        if (unreadCount > 0) {
            val badge = tabs.getTabAt(0)?.orCreateBadge ?: return
            badge.isVisible = true
            badge.number = unreadCount
            badge.maxCharacterCount = 3
        } else {
            activityTab?.removeBadge()
        }
        val seenAt = UnreadStore.lastAnnouncementSeenAt()
        val unreadAnnouncements = announcementItems.count { seenAt == null || it.createdAt > seenAt }
        val announceTab = tabs.getTabAt(1)
        if (unreadAnnouncements > 0) {
            val badge = tabs.getTabAt(1)?.orCreateBadge ?: return
            badge.isVisible = true
            badge.number = unreadAnnouncements
            badge.maxCharacterCount = 3
        } else {
            announceTab?.removeBadge()
        }
    }

    private fun updateMarkAllReadVisibility() {
        val hasUnread = activityItems.any { !it.isRead }
        toolbar.menu.findItem(R.id.action_mark_all_read)?.isVisible = hasUnread
    }

    private fun renderCurrent() {
        val rows: List<Row> = when (currentTab) {
            Tab.ACTIVITY -> buildGroupedRows(activityItems.map { Row.Activity(it) }) { (it as Row.Activity).n.createdAt }
            Tab.ANNOUNCEMENTS -> buildGroupedRows(announcementItems.map { Row.Announce(it) }) { (it as Row.Announce).a.createdAt }
        }
        unifiedAdapter.setItems(rows)

        val empty = when (currentTab) {
            Tab.ACTIVITY -> activityItems.isEmpty()
            Tab.ANNOUNCEMENTS -> announcementItems.isEmpty()
        }
        emptyState.visibility = if (empty) View.VISIBLE else View.GONE
        recycler.visibility = if (empty) View.GONE else View.VISIBLE

        if (currentTab == Tab.ACTIVITY) {
            tvEmptyTitle.setText(R.string.sdk_no_notifications)
            tvEmptySubtitle.setText(R.string.sdk_no_notifications_subtitle)
            ivEmptyIcon.setImageResource(R.drawable.sdk_ic_bell)
        } else {
            tvEmptyTitle.setText(R.string.sdk_no_announcements)
            tvEmptySubtitle.setText(R.string.sdk_no_announcements_subtitle)
            ivEmptyIcon.setImageResource(R.drawable.sdk_ic_megaphone)
        }
    }

    private fun buildGroupedRows(items: List<Row>, dateOf: (Row) -> String): List<Row> {
        if (items.isEmpty()) return emptyList()
        val result = mutableListOf<Row>()
        var lastHeader = ""
        items.forEach { row ->
            val header = dateHeader(dateOf(row))
            if (header != lastHeader) {
                result.add(Row.Header(header))
                lastHeader = header
            }
            result.add(row)
        }
        return result
    }

    private fun dateHeader(isoDate: String): String {
        return try {
            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            fmt.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val date = fmt.parse(isoDate.substringBefore('.')) ?: return isoDate.substringBefore('T')
            val cal = Calendar.getInstance().apply { time = date }
            val today = Calendar.getInstance()
            val yesterday = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
            when {
                isSameDay(cal, today) -> getString(R.string.sdk_date_today)
                isSameDay(cal, yesterday) -> getString(R.string.sdk_date_yesterday)
                else -> SimpleDateFormat("MMMM d", Locale.getDefault()).format(date)
            }
        } catch (_: Exception) { isoDate.substringBefore('T') }
    }

    private fun isSameDay(a: Calendar, b: Calendar) =
        a.get(Calendar.YEAR) == b.get(Calendar.YEAR) &&
        a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR)

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

    private fun dismissNotification(position: Int) {
        val row = unifiedAdapter.getItem(position) as? Row.Activity ?: return
        val n = row.n
        unifiedAdapter.removeAt(position)
        activityItems.remove(n)
        updateTabBadges()
        updateMarkAllReadVisibility()
        if (!n.isRead) {
            lifecycleScope.launch { FeedbackSDK.markNotificationRead(n.id) }
        }
    }

    private fun attachSwipeToDismiss() {
        val callback = object : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT or ItemTouchHelper.RIGHT) {
            override fun getMovementFlags(recycler: RecyclerView, viewHolder: RecyclerView.ViewHolder): Int {
                if (viewHolder is UnifiedAdapter.HeaderVH) return 0
                if (currentTab != Tab.ACTIVITY) return 0
                return super.getMovementFlags(recycler, viewHolder)
            }
            override fun onMove(rv: RecyclerView, vh: RecyclerView.ViewHolder, target: RecyclerView.ViewHolder) = false
            override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
                dismissNotification(viewHolder.bindingAdapterPosition)
            }
            override fun onChildDraw(
                c: Canvas, recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder,
                dX: Float, dY: Float, actionState: Int, isCurrentlyActive: Boolean
            ) {
                val alpha = 1f - (Math.abs(dX) / viewHolder.itemView.width.toFloat()).coerceIn(0f, 1f)
                viewHolder.itemView.alpha = alpha
                super.onChildDraw(c, recyclerView, viewHolder, dX, dY, actionState, isCurrentlyActive)
            }
            override fun clearView(recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder) {
                super.clearView(recyclerView, viewHolder)
                viewHolder.itemView.alpha = 1f
            }
        }
        ItemTouchHelper(callback).attachToRecyclerView(recycler)
    }

    private fun handleActivityClick(n: Notification) {
        lifecycleScope.launch {
            if (!n.isRead) {
                FeedbackSDK.markNotificationRead(n.id)
                val idx = activityItems.indexOfFirst { it.id == n.id }
                if (idx >= 0) activityItems[idx] = n.copy(isRead = true)
                updateTabBadges()
                updateMarkAllReadVisibility()
                renderCurrent()
            }
            val link = n.link ?: return@launch
            navigateFromLink(link)
        }
    }

    private fun handleAnnouncementClick(a: Announcement) {
        val link = a.link?.trim().orEmpty()
        if (link.isEmpty()) return
        if (link.startsWith("http", ignoreCase = true)) {
            try {
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(link)))
            } catch (_: Exception) {}
            return
        }
        navigateFromLink(link)
    }

    private fun navigateFromLink(link: String) {
        // Server uses both /feedback/<id> (reply) and /feedbacks/<id> (new feedback)
        val feedbackMatch = Regex("/feedbacks?/([^/?#]+)").find(link)
        val ticketMatch = Regex("/tickets/([^/?#]+)").find(link)
        when {
            feedbackMatch != null -> FeedbackSDK.openFeedbackDetail(this, feedbackMatch.groupValues[1])
            ticketMatch != null -> FeedbackSDK.openTicketDetail(this, ticketMatch.groupValues[1])
        }
    }

    private inner class UnifiedAdapter : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

        private val rows = mutableListOf<Row>()

        fun setItems(items: List<Row>) {
            rows.clear()
            rows.addAll(items)
            notifyDataSetChanged()
        }

        fun getItem(position: Int): Row = rows[position]

        fun removeAt(position: Int) {
            if (position !in rows.indices) return
            rows.removeAt(position)
            notifyItemRemoved(position)
        }

        inner class HeaderVH(view: View) : RecyclerView.ViewHolder(view) {
            val tvLabel: TextView = view.findViewById(R.id.tvDateHeader)
        }

        inner class NotifVH(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvTitle)
            val tvBody: TextView = view.findViewById(R.id.tvBody)
            val tvTime: TextView = view.findViewById(R.id.tvTime)
            val unreadDot: View = view.findViewById(R.id.unreadDot)
            val ivIcon: ImageView = view.findViewById(R.id.ivIcon)
        }

        override fun getItemViewType(position: Int) = when (rows[position]) {
            is Row.Header -> 0
            else -> 1
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == 0) {
                HeaderVH(inflater.inflate(R.layout.sdk_item_date_header, parent, false))
            } else {
                NotifVH(inflater.inflate(R.layout.sdk_item_notification, parent, false))
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            when (val row = rows[position]) {
                is Row.Header -> (holder as HeaderVH).tvLabel.text = row.label
                is Row.Activity -> bindNotif(holder as NotifVH, row.n)
                is Row.Announce -> bindAnnouncement(holder as NotifVH, row.a)
            }
        }

        private fun bindNotif(holder: NotifVH, n: Notification) {
            holder.tvTitle.text = n.title
            holder.tvBody.text = n.message
            holder.tvTime.text = formatTime(n.createdAt)
            holder.unreadDot.visibility = if (n.isRead) View.INVISIBLE else View.VISIBLE

            // Bold title for unread
            holder.tvTitle.setTypeface(null,
                if (n.isRead) android.graphics.Typeface.NORMAL else android.graphics.Typeface.BOLD)
            holder.itemView.alpha = if (n.isRead) 0.72f else 1f

            // Icon based on notification type hint from title/link
            val iconRes = iconForNotification(n)
            holder.ivIcon.setImageResource(iconRes)

            holder.itemView.setOnClickListener { handleActivityClick(n) }
            holder.itemView.contentDescription = buildString {
                if (!n.isRead) append(getString(R.string.sdk_unread_indicator) + ". ")
                append(n.title)
                append(". ")
                append(n.message)
            }
        }

        private fun bindAnnouncement(holder: NotifVH, a: Announcement) {
            holder.tvTitle.text = a.title
            holder.tvBody.text = a.body
            holder.tvTime.text = formatTime(a.createdAt)
            val seenAt = UnreadStore.lastAnnouncementSeenAt()
            val unread = seenAt == null || a.createdAt > seenAt
            holder.unreadDot.visibility = if (unread) View.VISIBLE else View.INVISIBLE
            holder.tvTitle.setTypeface(null,
                if (unread) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
            holder.itemView.alpha = if (unread) 1f else 0.72f
            holder.ivIcon.setImageResource(R.drawable.sdk_ic_megaphone)
            holder.itemView.setOnClickListener { handleAnnouncementClick(a) }
            holder.itemView.contentDescription = buildString {
                if (unread) append(getString(R.string.sdk_unread_indicator) + ". ")
                append(a.title)
                append(". ")
                append(a.body)
            }
        }

        private fun iconForNotification(n: Notification): Int {
            val hint = (n.title + " " + (n.link ?: "")).lowercase()
            return when {
                "ticket" in hint -> R.drawable.sdk_ic_ticket
                "feedback" in hint -> R.drawable.sdk_ic_megaphone
                "comment" in hint || "reply" in hint -> R.drawable.sdk_ic_chat
                else -> R.drawable.sdk_ic_bell
            }
        }

        override fun getItemCount(): Int = rows.size
    }

    companion object {
        internal fun formatTime(dateStr: String): String {
            return try {
                val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                input.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val date = input.parse(dateStr.substringBefore('.'))?.time ?: return dateStr
                val diff = System.currentTimeMillis() - date
                when {
                    diff < 60_000 -> "Just now"
                    diff < 3_600_000 -> "${diff / 60_000}m ago"
                    diff < 86_400_000 -> "${diff / 3_600_000}h ago"
                    diff < 7L * 86_400_000 -> "${diff / 86_400_000}d ago"
                    else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(date))
                }
            } catch (_: Exception) {
                dateStr.substringBefore('T')
            }
        }
    }
}
