package com.feedbacksdk.internal

import com.feedbacksdk.api.ApiClient
import com.google.gson.Gson
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

/**
 * Thin WebSocket client used by the SDK's live-update features. Connects to
 * the server's existing `/ws?token=<jwt>` endpoint with the currently logged-in
 * user's token. Listeners receive parsed envelopes; the transport layer handles
 * reconnect-with-backoff so callers don't have to.
 *
 * One connection is shared across the process so opening multiple detail
 * screens doesn't open multiple sockets.
 */
internal object SdkWebSocket {

    interface Listener {
        fun onMessage(envelope: Envelope)
    }

    data class Envelope(
        val type: String,
        val ticketId: String? = null,
        val feedbackId: String? = null,
        val userId: String? = null,
        val userName: String? = null,
        val data: Map<String, Any?>? = null,
    )

    private val gson = Gson()
    private val listeners = mutableSetOf<Listener>()
    private var socket: WebSocket? = null
    private var client: OkHttpClient? = null
    private var reconnectAttempts = 0
    private var lastToken: String? = null
    private var lastBaseUrl: String? = null
    private var explicitlyClosed = false

    /** Open the shared socket. Safe to call repeatedly; idempotent. */
    fun connect() {
        val token = ApiClient.authToken ?: return
        val base = ApiClient.baseUrl
        if (socket != null && token == lastToken && base == lastBaseUrl) return
        disconnect() // close stale connection if auth/base changed
        lastToken = token
        lastBaseUrl = base
        explicitlyClosed = false
        openNow(token, base)
    }

    private fun openNow(token: String, base: String) {
        // ApiClient normalizes to a trailing slash and strips /api only for
        // attachment URLs. The WS endpoint lives at the server root — same
        // rule we use in AttachmentUtils.
        val root = base.trimEnd('/')
            .let { if (it.endsWith("/api", ignoreCase = true)) it.removeSuffix("/api").removeSuffix("/API") else it }
        val wsUrl = root.replaceFirst("http://", "ws://", ignoreCase = true)
            .replaceFirst("https://", "wss://", ignoreCase = true) + "/ws?token=$token"

        val c = client ?: OkHttpClient.Builder()
            .pingInterval(20, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build().also { client = it }

        socket = c.newWebSocket(Request.Builder().url(wsUrl).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                reconnectAttempts = 0
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val env = gson.fromJson(text, Envelope::class.java) ?: return
                    synchronized(listeners) {
                        // Iterate over a copy; listeners can unregister themselves.
                        for (l in listeners.toList()) l.onMessage(env)
                    }
                } catch (_: Exception) { /* ignore malformed */ }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                socket = null
                if (!explicitlyClosed) scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                socket = null
                if (!explicitlyClosed && code !in setOf(4001, 4002)) scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        val token = lastToken ?: return
        val base = lastBaseUrl ?: return
        reconnectAttempts++
        // Exponential backoff, capped. Runs off OkHttp's dispatcher thread so
        // we don't need our own thread pool.
        val delayMs = (1000L shl minOf(reconnectAttempts, 5)).coerceAtMost(30_000L)
        Thread {
            try { Thread.sleep(delayMs) } catch (_: InterruptedException) { return@Thread }
            if (!explicitlyClosed) openNow(token, base)
        }.also { it.isDaemon = true }.start()
    }

    fun send(payload: Map<String, Any?>): Boolean {
        val s = socket ?: return false
        return s.send(gson.toJson(payload))
    }

    fun addListener(l: Listener) {
        synchronized(listeners) { listeners.add(l) }
    }

    fun removeListener(l: Listener) {
        synchronized(listeners) { listeners.remove(l) }
    }

    /** Close and stop auto-reconnecting. Called on logout. */
    fun disconnect() {
        explicitlyClosed = true
        socket?.close(1000, "bye")
        socket = null
        lastToken = null
        lastBaseUrl = null
        reconnectAttempts = 0
    }
}
