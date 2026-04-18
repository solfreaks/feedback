package com.feedbacksdk.internal

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Process-wide connectivity observer. Screens register a listener and get
 * notified as the device transitions online ↔ offline. We avoid polling — the
 * `NetworkCallback` API is the cheapest way to get these transitions and it
 * doesn't require any permission beyond the INTERNET already in the manifest.
 *
 * Callers get the current state synchronously via [isOnline] so a freshly
 * opened screen can set its initial chip state without waiting for the first
 * callback.
 */
internal object ConnectivityMonitor {

    fun interface Listener {
        fun onConnectivityChanged(online: Boolean)
    }

    private var appContext: Context? = null
    private var cm: ConnectivityManager? = null
    private var registered = false
    private val listeners = CopyOnWriteArraySet<Listener>()

    @Volatile
    private var online: Boolean = true

    fun init(context: Context) {
        if (appContext != null) return
        appContext = context.applicationContext
        cm = context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        online = computeInitialState()
        ensureRegistered()
    }

    val isOnline: Boolean get() = online

    fun addListener(l: Listener): Listener {
        listeners.add(l)
        // Deliver current state to the new listener immediately so it doesn't
        // have to race the first real transition.
        l.onConnectivityChanged(online)
        return l
    }

    fun removeListener(l: Listener) {
        listeners.remove(l)
    }

    private fun computeInitialState(): Boolean {
        val c = cm ?: return true
        val active = c.activeNetwork ?: return false
        val caps = c.getNetworkCapabilities(active) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun ensureRegistered() {
        if (registered) return
        val c = cm ?: return
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        c.registerNetworkCallback(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { update(true) }
            override fun onLost(network: Network) { update(false) }
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                // Validation flipping mid-session (captive portal, etc.) is
                // a real edge case — treat unvalidated as offline.
                val validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                update(validated)
            }
        })
        registered = true
    }

    private fun update(newState: Boolean) {
        if (online == newState) return
        online = newState
        for (l in listeners) l.onConnectivityChanged(newState)
    }
}
