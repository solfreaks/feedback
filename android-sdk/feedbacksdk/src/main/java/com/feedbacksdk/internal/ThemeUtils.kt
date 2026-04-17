package com.feedbacksdk.internal

import android.content.Context
import android.util.TypedValue
import androidx.annotation.AttrRes
import androidx.annotation.ColorInt
import androidx.core.content.ContextCompat
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
