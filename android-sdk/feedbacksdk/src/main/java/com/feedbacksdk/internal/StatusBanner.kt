package com.feedbacksdk.internal

import android.content.res.ColorStateList
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import com.feedbacksdk.R

/**
 * Helper that turns a bare LinearLayout stub (see @layout/sdk_banner_stub)
 * into a themed status banner. Three flavors:
 *
 *   - [showOffline] — "No internet connection"
 *   - [showError]   — "Couldn't reach server · Retry"
 *   - [hide]        — gone
 *
 * We reuse the same container so the banner doesn't jump between flavors; the
 * host layout just needs to include a LinearLayout with @+id/statusBanner.
 */
internal object StatusBanner {

    fun showOffline(container: LinearLayout) {
        ensureInflated(container)
        val icon = container.findViewById<android.widget.ImageView>(R.id.bannerIcon)
        val text = container.findViewById<TextView>(R.id.bannerText)
        val action = container.findViewById<TextView>(R.id.bannerAction)

        icon.setImageResource(R.drawable.sdk_ic_wifi_off)
        icon.imageTintList = ColorStateList.valueOf(
            container.context.resolveThemeColor(com.google.android.material.R.attr.colorOnSurfaceVariant)
        )
        text.setText(R.string.sdk_offline_banner)
        action.visibility = View.GONE
        container.visibility = View.VISIBLE
    }

    fun showError(container: LinearLayout, onRetry: () -> Unit) {
        ensureInflated(container)
        val icon = container.findViewById<android.widget.ImageView>(R.id.bannerIcon)
        val text = container.findViewById<TextView>(R.id.bannerText)
        val action = container.findViewById<TextView>(R.id.bannerAction)

        icon.setImageResource(R.drawable.sdk_ic_wifi_off)
        // Don't depend on a theme-specific error attr — renders consistently
        // across dark/light without adding a new SDK attr just for this banner.
        icon.imageTintList = ColorStateList.valueOf(0xFFDC2626.toInt())
        text.setText(R.string.sdk_server_unreachable)
        action.setText(R.string.sdk_retry)
        action.visibility = View.VISIBLE
        action.setOnClickListener { onRetry() }
        container.visibility = View.VISIBLE
    }

    fun hide(container: LinearLayout) {
        container.visibility = View.GONE
    }

    private fun ensureInflated(container: LinearLayout) {
        if (container.childCount > 0) return
        val inflater = android.view.LayoutInflater.from(container.context)
        inflater.inflate(R.layout.sdk_banner_content, container, true)
    }
}
