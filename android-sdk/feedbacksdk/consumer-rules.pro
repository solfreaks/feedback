# =============================================================================
# FeedbackSDK Consumer ProGuard/R8 Rules
# Applied automatically to consumer apps that depend on this AAR.
# =============================================================================

# -----------------------------------------------------------------------------
# Attributes — must come first
# -----------------------------------------------------------------------------

# Preserve generic type signatures (required for Gson + Retrofit generic types)
-keepattributes Signature

# Preserve all annotations (Gson @SerializedName, Retrofit @GET/@POST, etc.)
-keepattributes *Annotation*

# Preserve source file names and line numbers for readable crash stack traces
-keepattributes SourceFile,LineNumberTable

# Keep exception types readable
-keepattributes Exceptions

# -----------------------------------------------------------------------------
# Public API entry point
# -----------------------------------------------------------------------------

-keep class com.feedbacksdk.FeedbackSDK { *; }

# Inner data classes returned by FeedbackSDK public methods
-keep class com.feedbacksdk.FeedbackSDK$* { *; }

# -----------------------------------------------------------------------------
# Firebase messaging service (compileOnly dep — consumer must add runtime dep)
# -----------------------------------------------------------------------------

-keep class com.feedbacksdk.FeedbackFirebaseService { *; }

# -----------------------------------------------------------------------------
# Sealed result type exposed to consumers
# -----------------------------------------------------------------------------

-keep class com.feedbacksdk.internal.SdkResult { *; }
-keep class com.feedbacksdk.internal.SdkResult$* { *; }

# -----------------------------------------------------------------------------
# Gson models — all fields must survive shrinking/obfuscation
# -----------------------------------------------------------------------------

-keep class com.feedbacksdk.models.** { *; }

# WebSocket envelope deserialized by Gson at runtime
-keep class com.feedbacksdk.internal.SdkWebSocket$Envelope { *; }

# -----------------------------------------------------------------------------
# Retrofit interface
# -----------------------------------------------------------------------------

# Keep the interface name (Retrofit uses reflection to find it)
-keep,allowobfuscation interface com.feedbacksdk.api.FeedbackApi

# Preserve all methods annotated with @retrofit2.http.* (GET, POST, etc.)
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# -----------------------------------------------------------------------------
# UI activities (referenced by Android manifest — must keep constructors)
# -----------------------------------------------------------------------------

-keep class com.feedbacksdk.ui.CreateTicketActivity { public <init>(); }
-keep class com.feedbacksdk.ui.TicketListActivity { public <init>(); }
-keep class com.feedbacksdk.ui.TicketDetailActivity { public <init>(); }
-keep class com.feedbacksdk.ui.FeedbackActivity { public <init>(); }
-keep class com.feedbacksdk.ui.FeedbackListActivity { public <init>(); }
-keep class com.feedbacksdk.ui.FeedbackDetailActivity { public <init>(); }
-keep class com.feedbacksdk.ui.NotificationsActivity { public <init>(); }
-keep class com.feedbacksdk.ui.AttachmentViewerActivity { public <init>(); }

# -----------------------------------------------------------------------------
# Custom views — may be inflated from XML (requires 2-arg and 3-arg constructors)
# -----------------------------------------------------------------------------

-keep class com.feedbacksdk.ui.FeedbackBellView {
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

-keep class com.feedbacksdk.ui.ZoomableImageView {
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# -----------------------------------------------------------------------------
# RecyclerView adapters / ViewHolders inside UI activities
# (inner classes referenced via reflection by RecyclerView)
# -----------------------------------------------------------------------------

-keep class com.feedbacksdk.ui.TicketListActivity$* { *; }
-keep class com.feedbacksdk.ui.FeedbackListActivity$* { *; }
-keep class com.feedbacksdk.ui.NotificationsActivity$* { *; }
-keep class com.feedbacksdk.ui.AttachmentAdapters { *; }
-keep class com.feedbacksdk.ui.AttachmentAdapters$* { *; }
