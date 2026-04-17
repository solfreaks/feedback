package com.feedbacksdk.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import coil.load
import com.feedbacksdk.R
import com.feedbacksdk.internal.absoluteAttachmentUrl
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.internal.isImageFileName
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton

/**
 * Full-screen attachment viewer. Shows images inline with pinch-zoom; for
 * non-image types shows a "Open externally" button that fires ACTION_VIEW so
 * the user's installed viewer (browser, PDF reader, etc.) can take over.
 */
class AttachmentViewerActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_attachment_viewer)

        val fileUrl = intent.getStringExtra(EXTRA_URL) ?: run {
            finish()
            return
        }
        val fileName = intent.getStringExtra(EXTRA_NAME) ?: ""

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar).apply {
            title = fileName
            setNavigationOnClickListener { finish() }
        }
        applySystemBarInsets(topView = appBar, bottomView = null)

        val absoluteUrl = absoluteAttachmentUrl(fileUrl)
        val image = findViewById<ZoomableImageView>(R.id.imageView)
        val nonImage = findViewById<LinearLayout>(R.id.nonImageState)
        val openBtn = findViewById<MaterialButton>(R.id.btnOpenExternal)
        val progress = findViewById<View>(R.id.progressBar)
        val tvFileName = findViewById<TextView>(R.id.tvFileName)

        if (fileName.isImageFileName() || fileUrl.isImageFileName()) {
            image.visibility = ImageView.VISIBLE
            nonImage.visibility = LinearLayout.GONE
            progress.visibility = View.VISIBLE
            image.load(absoluteUrl) {
                crossfade(true)
                listener(
                    onSuccess = { _, _ -> progress.visibility = View.GONE },
                    onError = { _, _ ->
                        progress.visibility = View.GONE
                        Toast.makeText(
                            this@AttachmentViewerActivity,
                            R.string.sdk_attachment_load_failed,
                            Toast.LENGTH_LONG
                        ).show()
                    }
                )
            }
        } else {
            image.visibility = ImageView.GONE
            nonImage.visibility = LinearLayout.VISIBLE
            tvFileName.text = fileName.ifEmpty { absoluteUrl }
            openBtn.setOnClickListener { openExternally(absoluteUrl) }
        }
    }

    private fun openExternally(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        try {
            startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(this, R.string.sdk_no_app_to_open, Toast.LENGTH_LONG).show()
        }
    }

    companion object {
        const val EXTRA_URL = "file_url"
        const val EXTRA_NAME = "file_name"
    }
}
