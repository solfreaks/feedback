package com.feedbacksdk.internal

import android.content.Context
import android.content.SharedPreferences
import com.feedbacksdk.models.User
import com.google.gson.Gson

internal object TokenStore {

    private const val PREF_NAME = "feedback_sdk_prefs"
    private const val KEY_AUTH_TOKEN = "auth_token"
    private const val KEY_USER = "current_user"

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()
        }

    var currentUser: User?
        get() {
            val json = prefs.getString(KEY_USER, null) ?: return null
            return try { gson.fromJson(json, User::class.java) } catch (_: Exception) { null }
        }
        set(value) {
            prefs.edit().putString(KEY_USER, value?.let { gson.toJson(it) }).apply()
        }

    val isLoggedIn: Boolean
        get() = authToken != null

    fun clear() {
        prefs.edit().clear().apply()
    }
}
