package com.feedbacksdk.api

import com.feedbacksdk.internal.TokenStore
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

internal object ApiClient {

    private var retrofit: Retrofit? = null
    private var api: FeedbackApi? = null

    var baseUrl: String = ""
        private set
    var apiKey: String = ""
        private set
    var authToken: String? = null

    // Fires on the main thread when the server rejects the stored token (401).
    // The SDK clears the token before invoking this — the consumer decides
    // whether to prompt for re-auth.
    internal var onAuthInvalidated: (() -> Unit)? = null

    fun initialize(baseUrl: String, apiKey: String, debug: Boolean = false) {
        this.baseUrl = baseUrl.trimEnd('/')  + "/"
        this.apiKey = apiKey

        val headerInterceptor = Interceptor { chain ->
            val builder = chain.request().newBuilder()
                .addHeader("x-api-key", this.apiKey)

            authToken?.let {
                builder.addHeader("Authorization", "Bearer $it")
            }

            chain.proceed(builder.build())
        }

        // Auth-expiry interceptor: if the server 401s while we have a token,
        // the token is either expired or revoked. Clear it so subsequent calls
        // go out unauthenticated (and fail fast) instead of looping 401s, and
        // notify the host app so it can trigger sign-in.
        val authExpiryInterceptor = Interceptor { chain ->
            val request = chain.request()
            val response = chain.proceed(request)
            val hadToken = request.header("Authorization") != null
            // Skip the sign-in endpoint itself — a 401 there means the id_token
            // was bad, not that our session expired.
            val isSignInCall = request.url.encodedPath.endsWith("/auth/google")
            if (response.code == 401 && hadToken && !isSignInCall) {
                TokenStore.clear()
                authToken = null
                onAuthInvalidated?.let { cb ->
                    android.os.Handler(android.os.Looper.getMainLooper()).post { cb() }
                }
            }
            response
        }

        val clientBuilder = OkHttpClient.Builder()
            .addInterceptor(headerInterceptor)
            .addInterceptor(authExpiryInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)

        if (debug) {
            val logging = HttpLoggingInterceptor()
            logging.level = HttpLoggingInterceptor.Level.BODY
            clientBuilder.addInterceptor(logging)
        }

        retrofit = Retrofit.Builder()
            .baseUrl(this.baseUrl)
            .client(clientBuilder.build())
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        api = retrofit!!.create(FeedbackApi::class.java)
    }

    fun getApi(): FeedbackApi {
        return api ?: throw IllegalStateException(
            "FeedbackSDK not initialized. Call FeedbackSDK.initialize() first."
        )
    }
}
