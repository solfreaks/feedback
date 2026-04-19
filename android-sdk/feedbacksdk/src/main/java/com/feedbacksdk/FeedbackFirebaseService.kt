package com.feedbacksdk

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.TaskStackBuilder
import com.feedbacksdk.api.ApiClient
import com.feedbacksdk.internal.TokenStore
import com.feedbacksdk.models.DeviceTokenRequest
import com.feedbacksdk.ui.FeedbackDetailActivity
import com.feedbacksdk.ui.NotificationsActivity
import com.feedbacksdk.ui.TicketDetailActivity
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Optional Firebase Messaging service for auto-registering device tokens AND
 * rendering incoming server pushes so taps deep-link into the right screen.
 *
 * The server sends data-only FCM messages (no top-level `notification` block);
 * that's what makes `onMessageReceived` fire reliably even when the app is
 * backgrounded. We build the local notification here and attach a
 * PendingIntent that routes based on the `type` + id fields in the payload.
 *
 * Add to your app's AndroidManifest.xml:
 * ```xml
 * <service
 *     android:name="com.feedbacksdk.FeedbackFirebaseService"
 *     android:exported="false">
 *     <intent-filter>
 *         <action android:name="com.google.firebase.MESSAGING_EVENT" />
 *     </intent-filter>
 * </service>
 * ```
 *
 * Subclass if you want to route certain message types elsewhere — override
 * [onMessageReceived] and either handle the message yourself or call
 * `super.onMessageReceived(message)` to fall back to SDK behavior.
 */
open class FeedbackFirebaseService : com.google.firebase.messaging.FirebaseMessagingService() {

    companion object {
        // Foreground channel — default importance so the user sees a heads-up
        // and hears the default sound. Consumer apps can pre-create a channel
        // with this id and different settings if they want to override.
        const val CHANNEL_ID = "feedbacksdk_default"
        private const val CHANNEL_NAME = "Support updates"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Re-subscribe the announcements topic every time the device token
        // rolls — topic subscriptions live on the device but a token swap
        // usually means Firebase cleared them.
        FeedbackSDK.maybeSubscribeAnnouncementTopic()

        if (TokenStore.isLoggedIn) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    ApiClient.getApi().registerDeviceToken(DeviceTokenRequest(token, "android"))
                } catch (_: Exception) {
                    // Will retry on next app launch
                }
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        // Server bundles title/body into `data` since we're data-only. Fall
        // back to `message.notification` in case an upstream sender (Firebase
        // console test push, etc.) used the mixed format.
        val title = data["title"] ?: message.notification?.title ?: "Notification"
        val body = data["body"] ?: message.notification?.body.orEmpty()
        val type = data["type"].orEmpty()

        val tapIntent = buildTapIntent(type, data)
        showNotification(title, body, tapIntent, message.messageId ?: data["notificationId"])
    }

    /**
     * Build the Intent that opens when the user taps the notification.
     * Routing rules by `type`:
     *   - feedback_reply / new_feedback    → FeedbackDetailActivity for the feedbackId
     *   - ticket_update / new_comment / mention / new_ticket → TicketDetailActivity
     *   - announcement                     → NotificationsActivity (Announcements tab)
     *   - anything else / missing ids      → NotificationsActivity (Activity tab)
     */
    private fun buildTapIntent(type: String, data: Map<String, String>): Intent {
        val feedbackId = data["feedbackId"]
        val ticketId = data["ticketId"]

        return when {
            (type == "feedback_reply" || type == "new_feedback") && !feedbackId.isNullOrEmpty() ->
                Intent(this, FeedbackDetailActivity::class.java).apply {
                    putExtra("feedback_id", feedbackId)
                }

            (type == "ticket_update" || type == "new_comment" || type == "new_ticket" || type == "mention")
                && !ticketId.isNullOrEmpty() ->
                Intent(this, TicketDetailActivity::class.java).apply {
                    putExtra("ticket_id", ticketId)
                }

            else -> Intent(this, NotificationsActivity::class.java)
        }
    }

    private fun showNotification(title: String, body: String, tapIntent: Intent, idKey: String?) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT)
                )
            }
        }

        // Use a TaskStackBuilder so pressing Back from the detail screen
        // returns to NotificationsActivity (expected behavior for deep links).
        val pendingIntent = TaskStackBuilder.create(this)
            .addNextIntentWithParentStack(tapIntent)
            .getPendingIntent(
                0,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

        // Stable-ish id derived from messageId so repeat sends replace instead
        // of stacking. Falls back to current-millis for truly unique messages.
        val notifId = (idKey?.hashCode() ?: System.currentTimeMillis().toInt())

        val icon = applicationInfo.icon.takeIf { it != 0 }
            ?: android.R.drawable.ic_dialog_info

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        nm.notify(notifId, notification)
    }
}
