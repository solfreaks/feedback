package com.feedbacksdk.ui

import android.os.Bundle
import android.view.View
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.ChipGroup
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

class FeedbackActivity : AppCompatActivity() {

    private lateinit var stars: List<ImageView>
    private lateinit var tvRatingLabel: TextView
    private lateinit var chipGroupCategory: ChipGroup
    private lateinit var editComment: TextInputEditText
    private lateinit var btnSubmit: MaterialButton
    private lateinit var progressBar: View

    private var selectedRating = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_feedback)

        findViewById<MaterialToolbar>(R.id.toolbar).setNavigationOnClickListener { finish() }

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
        progressBar = findViewById(R.id.progressBar)

        stars.forEachIndexed { index, imageView ->
            imageView.setOnClickListener {
                selectedRating = index + 1
                updateStars(animateIndex = index)
            }
        }

        btnSubmit.setOnClickListener { submitFeedback() }
    }

    private fun updateStars(animateIndex: Int) {
        stars.forEachIndexed { index, imageView ->
            imageView.setImageResource(
                if (index < selectedRating) R.drawable.sdk_ic_star_filled
                else R.drawable.sdk_ic_star_outline
            )
        }
        // Little pop on the tapped star.
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
                    Toast.makeText(this@FeedbackActivity, R.string.sdk_feedback_submitted, Toast.LENGTH_SHORT).show()
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
        btnSubmit.visibility = if (loading) View.INVISIBLE else View.VISIBLE
    }
}
