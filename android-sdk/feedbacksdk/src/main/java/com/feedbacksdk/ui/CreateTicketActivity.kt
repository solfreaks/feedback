package com.feedbacksdk.ui

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.ChipGroup
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.launch

class CreateTicketActivity : AppCompatActivity() {

    private lateinit var editTitle: TextInputEditText
    private lateinit var editDescription: TextInputEditText
    private lateinit var chipGroupPriority: ChipGroup
    private lateinit var btnSubmit: MaterialButton
    private lateinit var progressBar: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_create_ticket)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        editTitle = findViewById(R.id.editTitle)
        editDescription = findViewById(R.id.editDescription)
        chipGroupPriority = findViewById(R.id.chipGroupPriority)
        btnSubmit = findViewById(R.id.btnSubmit)
        progressBar = findViewById(R.id.progressBar)

        btnSubmit.setOnClickListener { submitTicket() }
    }

    private fun submitTicket() {
        val title = editTitle.text?.toString()?.trim() ?: ""
        val description = editDescription.text?.toString()?.trim() ?: ""

        if (title.isEmpty()) {
            editTitle.error = getString(R.string.sdk_error_title_required)
            return
        }
        if (description.isEmpty()) {
            editDescription.error = getString(R.string.sdk_error_desc_required)
            return
        }

        val priority = when (chipGroupPriority.checkedChipId) {
            R.id.chipLow -> "low"
            R.id.chipHigh -> "high"
            R.id.chipCritical -> "critical"
            else -> "medium"
        }

        setLoading(true)

        lifecycleScope.launch {
            when (val result = FeedbackSDK.createTicket(title, description, priority = priority)) {
                is SdkResult.Success -> {
                    Toast.makeText(this@CreateTicketActivity, R.string.sdk_ticket_created, Toast.LENGTH_SHORT).show()
                    setResult(RESULT_OK)
                    finish()
                }
                is SdkResult.Error -> {
                    setLoading(false)
                    Toast.makeText(this@CreateTicketActivity, result.message, Toast.LENGTH_LONG).show()
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
