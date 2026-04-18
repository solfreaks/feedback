package com.feedbacksdk.internal

import android.content.Context
import android.content.SharedPreferences

/**
 * Tiny key/value wrapper backing SDK draft persistence. Keeps a separate
 * SharedPreferences file from TokenStore / UnreadStore so clearing drafts
 * on submit doesn't accidentally touch auth or unread state.
 *
 * Drafts are scoped per-user when possible so a user can't see another
 * account's draft after switching accounts on the same device.
 */
internal object DraftStore {

    private const val PREFS = "feedbacksdk_drafts"
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    private fun scopedKey(key: String): String {
        val uid = TokenStore.currentUser?.id ?: "_"
        return "${uid}__$key"
    }

    fun putString(key: String, value: String?) {
        if (!::prefs.isInitialized) return
        val e = prefs.edit()
        if (value.isNullOrEmpty()) e.remove(scopedKey(key)) else e.putString(scopedKey(key), value)
        e.apply()
    }

    fun getString(key: String): String? {
        if (!::prefs.isInitialized) return null
        return prefs.getString(scopedKey(key), null)
    }

    fun putInt(key: String, value: Int) {
        if (!::prefs.isInitialized) return
        prefs.edit().putInt(scopedKey(key), value).apply()
    }

    fun getInt(key: String, default: Int): Int {
        if (!::prefs.isInitialized) return default
        return prefs.getInt(scopedKey(key), default)
    }

    fun remove(vararg keys: String) {
        if (!::prefs.isInitialized) return
        val e = prefs.edit()
        for (k in keys) e.remove(scopedKey(k))
        e.apply()
    }
}
