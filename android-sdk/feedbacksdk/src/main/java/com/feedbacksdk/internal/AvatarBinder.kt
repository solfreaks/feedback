package com.feedbacksdk.internal

import android.view.View
import android.widget.ImageView
import coil.load
import coil.transform.CircleCropTransformation
import com.feedbacksdk.R
import com.feedbacksdk.models.User

internal object AvatarBinder {
    fun bind(row: View, user: User?) {
        val placeholder = row.findViewById<ImageView>(R.id.ivAvatarPlaceholder) ?: return
        val avatar = row.findViewById<ImageView>(R.id.ivAvatar) ?: return
        val url = user?.avatarUrl
        if (url.isNullOrBlank()) {
            avatar.visibility = View.GONE
            placeholder.visibility = View.VISIBLE
            return
        }
        placeholder.visibility = View.GONE
        avatar.visibility = View.VISIBLE
        avatar.load(url) {
            crossfade(true)
            transformations(CircleCropTransformation())
            placeholder(R.drawable.sdk_ic_circle_user)
            error(R.drawable.sdk_ic_circle_user)
        }
    }
}
