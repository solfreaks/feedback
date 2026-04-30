package com.feedbacksdk.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import coil.load
import com.feedbacksdk.R
import com.feedbacksdk.internal.absoluteAttachmentUrl
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.internal.isImageFileName
import com.feedbacksdk.internal.mimeTypeForFileName
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

        val fileUrl = intent.getStringExtra(EXTRA_URL) ?: run { finish(); return }
        val fileName = intent.getStringExtra(EXTRA_NAME) ?: ""

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        findViewById<MaterialToolbar>(R.id.toolbar).apply {
            title = fileName
            setNavigationOnClickListener { finish() }
        }
        applySystemBarInsets(topView = appBar, bottomView = null)

        val absoluteUrl = absoluteAttachmentUrl(fileUrl)
        val image = findViewById<ZoomableImageView>(R.id.imageView)
        val nonImage = findViewById<LinearLayout>(R.id.nonImageState)
        val imageError = findViewById<LinearLayout>(R.id.imageErrorState)
        val btnRetry = findViewById<MaterialButton>(R.id.btnRetryImage)
        val openBtn = findViewById<MaterialButton>(R.id.btnOpenExternal)
        val progress = findViewById<View>(R.id.progressBar)
        val tvFileName = findViewById<TextView>(R.id.tvFileName)

        if (fileName.isImageFileName() || fileUrl.isImageFileName()) {
            nonImage.visibility = ImageView.GONE
            loadImage(image, imageError, btnRetry, progress, absoluteUrl)
        } else {
            image.visibility = ImageView.GONE
            nonImage.visibility = LinearLayout.VISIBLE
            tvFileName.text = fileName.ifEmpty { absoluteUrl }
            openBtn.setOnClickListener { openExternally(absoluteUrl, fileName) }
        }
    }

    private fun loadImage(
        image: ZoomableImageView,
        errorState: LinearLayout,
        retryBtn: MaterialButton,
        progress: View,
        url: String,
    ) {
        image.visibility = View.VISIBLE
        errorState.visibility = View.GONE
        progress.visibility = View.VISIBLE
        image.load(url) {
            crossfade(true)
            listener(
                onSuccess = { _, _ ->
                    progress.visibility = View.GONE
                },
                onError = { _, _ ->
                    progress.visibility = View.GONE
                    image.visibility = View.GONE
                    errorState.visibility = View.VISIBLE
                    retryBtn.setOnClickListener {
                        loadImage(image, errorState, retryBtn, progress, url)
                    }
                }
            )
        }
    }

    private fun openExternally(url: String, fileName: String) {
        val mime = mimeTypeForFileName(fileName).ifEmpty { "application/octet-stream" }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            setDataAndType(Uri.parse(url), mime)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            startActivity(intent)
        } catch (_: Exception) {
            // Fallback: try again without type hint — some apps match on URI alone.
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            } catch (_: Exception) {
                android.widget.Toast.makeText(this, R.string.sdk_no_app_to_open, android.widget.Toast.LENGTH_LONG).show()
            }
        }
    }

    companion object {
        const val EXTRA_URL = "file_url"
        const val EXTRA_NAME = "file_name"
    }
}
