package com.feedbacksdk.ui

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.DraftStore
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.internal.applySystemBarInsets
import com.feedbacksdk.internal.uriToCacheFile
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.ChipGroup
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch
import java.io.File

class FeedbackActivity : AppCompatActivity() {

    private companion object {
        const val DRAFT_RATING = "feedback.rating"
        const val DRAFT_COMMENT = "feedback.comment"
    }

    private lateinit var stars: List<ImageView>
    private lateinit var tvRatingLabel: TextView
    private lateinit var chipGroupCategory: ChipGroup
    private lateinit var editComment: TextInputEditText
    private lateinit var btnSubmit: MaterialButton
    private lateinit var btnAttach: MaterialButton
    private lateinit var rvAttachments: RecyclerView
    private lateinit var progressBar: View

    private var selectedRating = 0

    private val pendingFiles = mutableListOf<File>()
    private lateinit var pendingAdapter: PendingAttachmentAdapter

    private val pickAttachments = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        if (uris.isEmpty()) return@registerForActivityResult
        lifecycleScope.launch {
            uris.forEach { uri ->
                uriToCacheFile(uri)?.let { pendingFiles.add(it) }
            }
            refreshAttachments()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_feedback)

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        findViewById<MaterialToolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }
        applySystemBarInsets(topView = appBar, bottomView = findViewById(R.id.bottomBar))

        val scrollView = findViewById<androidx.core.widget.NestedScrollView>(R.id.scrollView)
        val basePadBottom = scrollView.paddingBottom
        androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(scrollView) { v, insets ->
            val ime = insets.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime()).bottom
            v.setPadding(v.paddingLeft, v.paddingTop, v.paddingRight, basePadBottom + ime)
            insets
        }

        stars = listOf(
            findViewById(R.id.star1),
            findViewById(R.id.star2),
            findViewById(R.id.star3),
            findViewById(R.id.star4),
            findViewById(R.id.star5),
        )
        tvRatingLabel = findViewById(R.id.tvRatingLabel)
        chipGroupCategory = findViewById(R.id.chipGroupCategory)
        editComment = findViewById(R.id.editComment)
        btnSubmit = findViewById(R.id.btnSubmit)
        btnAttach = findViewById(R.id.btnAttach)
        rvAttachments = findViewById(R.id.rvAttachments)
        progressBar = findViewById(R.id.progressBar)

        stars.forEachIndexed { index, imageView ->
            imageView.setOnClickListener {
                selectedRating = index + 1
                updateStars(animateIndex = index)
            }
        }

        pendingAdapter = PendingAttachmentAdapter(pendingFiles) { position ->
            pendingFiles.removeAt(position)
            refreshAttachments()
        }
        rvAttachments.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)
        rvAttachments.adapter = pendingAdapter

        btnAttach.setOnClickListener { pickAttachments.launch("*/*") }
        btnSubmit.setOnClickListener { submitFeedback() }

        // Restore draft. Rating snaps the stars back; comment rehydrates the
        // text field. Category chip intentionally isn't persisted because
        // rating + comment are the costly inputs to re-enter.
        val savedRating = DraftStore.getInt(DRAFT_RATING, 0)
        if (savedRating in 1..5) {
            selectedRating = savedRating
            updateStars(animateIndex = savedRating - 1)
        }
        DraftStore.getString(DRAFT_COMMENT)?.let { editComment.setText(it) }
    }

    override fun onPause() {
        super.onPause()
        val comment = editComment.text?.toString()?.trim().orEmpty()
        if (selectedRating == 0 && comment.isEmpty()) {
            DraftStore.remove(DRAFT_RATING, DRAFT_COMMENT)
        } else {
            DraftStore.putInt(DRAFT_RATING, selectedRating)
            DraftStore.putString(DRAFT_COMMENT, comment)
        }
    }

    private fun refreshAttachments() {
        pendingAdapter.notifyDataSetChanged()
        rvAttachments.visibility = if (pendingFiles.isEmpty()) View.GONE else View.VISIBLE
    }

    private fun updateStars(animateIndex: Int) {
        stars.forEachIndexed { index, imageView ->
            imageView.setImageResource(
                if (index < selectedRating) R.drawable.sdk_ic_star_filled
                else R.drawable.sdk_ic_star_outline
            )
        }
        stars[animateIndex].animate()
            .scaleX(1.25f).scaleY(1.25f)
            .setDuration(120)
            .withEndAction {
                stars[animateIndex].animate()
                    .scaleX(1f).scaleY(1f)
                    .setInterpolator(OvershootInterpolator())
                    .setDuration(180)
                    .start()
            }
            .start()

        tvRatingLabel.setText(
            when (selectedRating) {
                1 -> R.string.sdk_rating_1
                2 -> R.string.sdk_rating_2
                3 -> R.string.sdk_rating_3
                4 -> R.string.sdk_rating_4
                5 -> R.string.sdk_rating_5
                else -> R.string.sdk_tap_to_rate
            }
        )
    }

    private fun submitFeedback() {
        if (selectedRating == 0) {
            Toast.makeText(this, R.string.sdk_error_rating_required, Toast.LENGTH_SHORT).show()
            return
        }

        val category = when (chipGroupCategory.checkedChipId) {
            R.id.chipBug -> "bug_report"
            R.id.chipFeature -> "feature_request"
            R.id.chipSuggestion -> "suggestion"
            R.id.chipComplaint -> "complaint"
            else -> "general"
        }
        val comment = editComment.text?.toString()?.trim()?.ifEmpty { null }

        setLoading(true)

        lifecycleScope.launch {
            when (val result = FeedbackSDK.submitFeedback(selectedRating, category, comment)) {
                is SdkResult.Success -> {
                    val feedbackId = result.data.id
                    var uploadFailed = false
                    pendingFiles.forEach { file ->
                        val uploadResult = FeedbackSDK.uploadFeedbackAttachment(feedbackId, file)
                        if (uploadResult is SdkResult.Error) uploadFailed = true
                    }
                    val msg = if (uploadFailed) R.string.sdk_feedback_submitted_attach_failed
                              else R.string.sdk_feedback_submitted
                    Toast.makeText(this@FeedbackActivity, msg, Toast.LENGTH_SHORT).show()
                    DraftStore.remove(DRAFT_RATING, DRAFT_COMMENT)
                    setResult(RESULT_OK)
                    finish()
                }
                is SdkResult.Error -> {
                    setLoading(false)
                    Toast.makeText(this@FeedbackActivity, result.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !loading
        btnAttach.isEnabled = !loading
        btnSubmit.visibility = if (loading) View.INVISIBLE else View.VISIBLE
    }
}
