package com.feedbacksdk.api

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

        val clientBuilder = OkHttpClient.Builder()
            .addInterceptor(headerInterceptor)
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
