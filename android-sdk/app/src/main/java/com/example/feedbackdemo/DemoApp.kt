package com.example.feedbackdemo

import android.app.Application
import com.feedbacksdk.FeedbackSDK

class DemoApp : Application() {
    override fun onCreate() {
        super.onCreate()

        // Replace with your own values. See android-sdk/README.md for details.
        FeedbackSDK.initialize(
            context = this,
            baseUrl = BuildConfig.FEEDBACK_BASE_URL,
            apiKey = BuildConfig.FEEDBACK_API_KEY,
            googleClientId = BuildConfig.FEEDBACK_GOOGLE_CLIENT_ID,
            debug = BuildConfig.DEBUG,
        )
    }
}
