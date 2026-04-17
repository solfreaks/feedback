package com.feedbacksdk.internal

import android.content.Context
import android.util.TypedValue
import android.view.View
import androidx.annotation.AttrRes
import androidx.annotation.ColorInt
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.feedbacksdk.R

/** Resolve a theme color attribute to a concrete `@ColorInt`. Falls back to opaque gray. */
@ColorInt
internal fun Context.resolveThemeColor(@AttrRes attrRes: Int): Int {
    val tv = TypedValue()
    return if (theme.resolveAttribute(attrRes, tv, true)) {
        if (tv.resourceId != 0) ContextCompat.getColor(this, tv.resourceId) else tv.data
    } else {
        0xFF64748B.toInt()
    }
}

/** Color for a ticket or feedback status string. Ticket: open, in_progress, resolved, closed. Feedback: new, acknowledged, in_progress, resolved. */
@ColorInt
internal fun Context.statusColor(status: String): Int = resolveThemeColor(
    when (status) {
        "open", "new" -> R.attr.sdkColorStatusOpen
        "acknowledged", "in_progress" -> R.attr.sdkColorStatusInProgress
        "resolved" -> R.attr.sdkColorStatusResolved
        "closed" -> R.attr.sdkColorStatusClosed
        else -> R.attr.sdkColorStatusClosed
    }
)

/** Color for a ticket priority string (low / medium / high / critical). */
@ColorInt
internal fun Context.priorityColor(priority: String): Int = resolveThemeColor(
    when (priority) {
        "low" -> R.attr.sdkColorPriorityLow
        "medium" -> R.attr.sdkColorPriorityMedium
        "high" -> R.attr.sdkColorPriorityHigh
        "critical" -> R.attr.sdkColorPriorityCritical
        else -> R.attr.sdkColorPriorityMedium
    }
)

/**
 * Apply system-bar insets to the given top and bottom views. Top gets status-bar
 * padding, bottom gets navigation-bar padding. Intended for edge-to-edge activities
 * where the root is a CoordinatorLayout that draws behind the bars.
 */
internal fun applySystemBarInsets(topView: View?, bottomView: View?) {
    if (topView != null) {
        ViewCompat.setOnApplyWindowInsetsListener(topView) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.updatePadding(top = bars.top)
            insets
        }
    }
    if (bottomView != null) {
        ViewCompat.setOnApplyWindowInsetsListener(bottomView) { v, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()
            )
            v.updatePadding(bottom = bars.bottom)
            insets
        }
    }
}
