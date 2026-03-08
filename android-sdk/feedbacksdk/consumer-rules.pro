# Keep SDK public API
-keep class com.feedbacksdk.FeedbackSDK { *; }
-keep class com.feedbacksdk.FeedbackFirebaseService { *; }
-keep class com.feedbacksdk.models.** { *; }
-keep class com.feedbacksdk.internal.SdkResult { *; }
-keep class com.feedbacksdk.internal.SdkResult$* { *; }

# Keep Retrofit interfaces
-keep,allowobfuscation interface com.feedbacksdk.api.FeedbackApi
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# Gson models
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.feedbacksdk.models.** { *; }
