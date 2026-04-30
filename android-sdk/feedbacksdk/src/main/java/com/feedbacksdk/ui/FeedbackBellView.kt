package com.feedbacksdk.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.util.AttributeSet
import android.view.LayoutInflater
import android.widget.FrameLayout
import android.widget.TextView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Drop-in bell widget the consumer can place anywhere (toolbar, nav drawer,
 * settings row). Polls [FeedbackSDK.getUnreadNotificationCount] on
 * `onResume`-equivalent events and renders a badge. Tapping opens the built-in
 * [NotificationsActivity].
 *
 * Simplest integration:
 *   <com.feedbacksdk.ui.FeedbackBellView
 *       android:layout_width="48dp"
 *       android:layout_height="48dp" />
 *
 * Consumer code can call [refresh] to force a re-fetch (e.g. after dismissing
 * a notification sheet); otherwise this polls itself on window attach and when
 * the hosting Activity resumes.
 */
class FeedbackBellView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : FrameLayout(context, attrs, defStyleAttr) {

    private val badge: TextView

    // Single long-lived scope tied to the view's attach/detach lifecycle.
    // All refresh jobs run as children of this scope so cancelling it is enough.
    private val viewScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var refreshJob: Job? = null
    private var lifecycleObserver: LifecycleEventObserver? = null

    init {
        LayoutInflater.from(context).inflate(R.layout.sdk_view_bell, this, true)
        badge = findViewById(R.id.bellBadge)
        isClickable = true
        isFocusable = true
        if (background == null) {
            val ta = context.obtainStyledAttributes(intArrayOf(android.R.attr.selectableItemBackgroundBorderless))
            background = ta.getDrawable(0)
            ta.recycle()
        }
        setOnClickListener {
            val host = findActivity()
            if (host != null) FeedbackSDK.openNotifications(host)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        refresh()
        val owner = findLifecycleOwner()
        if (owner != null) {
            lifecycleObserver = LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_RESUME) refresh()
            }.also { owner.lifecycle.addObserver(it) }
        }
    }

    override fun onDetachedFromWindow() {
        // Cancel all coroutines owned by this view — no leaks possible after this.
        viewScope.cancel()
        lifecycleObserver?.let { obs ->
            findLifecycleOwner()?.lifecycle?.removeObserver(obs)
        }
        lifecycleObserver = null
        super.onDetachedFromWindow()
    }

    /** Force a badge re-fetch. Safe to call from any thread. */
    fun refresh() {
        refreshJob?.cancel()
        if (!FeedbackSDK.isLoggedIn) {
            applyCount(0)
            return
        }
        refreshJob = viewScope.launch(Dispatchers.IO) {
            val result = FeedbackSDK.getUnreadNotificationCount()
            withContext(Dispatchers.Main) {
                applyCount(if (result is SdkResult.Success) result.data else 0)
            }
        }
    }

    private fun applyCount(count: Int) {
        if (count <= 0) {
            badge.visibility = GONE
            return
        }
        badge.visibility = VISIBLE
        badge.text = if (count > 99) context.getString(R.string.sdk_badge_overflow) else count.toString()
    }

    private fun findActivity(): Activity? {
        var ctx: Context? = context
        while (ctx is ContextWrapper) {
            if (ctx is Activity) return ctx
            ctx = ctx.baseContext
        }
        return null
    }

    private fun findLifecycleOwner(): LifecycleOwner? {
        var ctx: Context? = context
        while (ctx is ContextWrapper) {
            if (ctx is LifecycleOwner) return ctx
            ctx = ctx.baseContext
        }
        return null
    }
}
