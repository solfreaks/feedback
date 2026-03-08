package com.feedbacksdk

import com.feedbacksdk.api.ApiClient
import com.feedbacksdk.internal.TokenStore
import com.feedbacksdk.models.DeviceTokenRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Optional Firebase Messaging service for auto-registering device tokens.
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
 * Or extend this class in your own service and call super methods.
 */
open class FeedbackFirebaseService : com.google.firebase.messaging.FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
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
}
