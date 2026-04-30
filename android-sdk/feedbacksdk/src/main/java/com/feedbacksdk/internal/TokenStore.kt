package com.feedbacksdk.internal

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.feedbacksdk.models.User
import com.google.gson.Gson

internal object TokenStore {

    private const val PREF_NAME = "feedback_sdk_secure_prefs"
    private const val KEY_AUTH_TOKEN = "auth_token"
    private const val KEY_USER = "current_user"

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()

    fun init(context: Context) {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        prefs = try {
            EncryptedSharedPreferences.create(
                context,
                PREF_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } catch (_: Exception) {
            // Fallback: if the keystore is unavailable (emulator quirks, corrupted
            // key) wipe the file and recreate plain — user just needs to log in again.
            context.deleteSharedPreferences(PREF_NAME)
            context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        }
    }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) {
            prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()
        }

    var currentUser: User?
        get() {
            val json = prefs.getString(KEY_USER, null) ?: return null
            return try {
                gson.fromJson(json, User::class.java)
            } catch (_: Exception) {
                // Corrupted entry — clear it so we don't keep retrying bad data.
                prefs.edit().remove(KEY_USER).apply()
                null
            }
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
