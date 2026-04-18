package com.feedbacksdk.ui

import android.net.Uri
import android.os.Bundle
import android.view.View
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

class CreateTicketActivity : AppCompatActivity() {

    private companion object {
        const val DRAFT_TITLE = "create_ticket.title"
        const val DRAFT_DESCRIPTION = "create_ticket.description"
    }

    private lateinit var editTitle: TextInputEditText
    private lateinit var editDescription: TextInputEditText
    private lateinit var chipGroupPriority: ChipGroup
    private lateinit var btnSubmit: MaterialButton
    private lateinit var btnAttach: MaterialButton
    private lateinit var rvAttachments: RecyclerView
    private lateinit var progressBar: View

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
        setContentView(R.layout.sdk_activity_create_ticket)

        val appBar = findViewById<AppBarLayout>(R.id.appBar)
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }
        applySystemBarInsets(topView = appBar, bottomView = findViewById(R.id.bottomBar))

        editTitle = findViewById(R.id.editTitle)
        editDescription = findViewById(R.id.editDescription)
        chipGroupPriority = findViewById(R.id.chipGroupPriority)
        btnSubmit = findViewById(R.id.btnSubmit)
        btnAttach = findViewById(R.id.btnAttach)
        rvAttachments = findViewById(R.id.rvAttachments)
        progressBar = findViewById(R.id.progressBar)

        pendingAdapter = PendingAttachmentAdapter(pendingFiles) { index ->
            pendingFiles.removeAt(index)
            refreshAttachments()
        }
        rvAttachments.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)
        rvAttachments.adapter = pendingAdapter

        btnAttach.setOnClickListener { pickAttachments.launch("*/*") }
        btnSubmit.setOnClickListener { submitTicket() }

        // Restore any draft from a previous session. Attachments aren't
        // persisted — they live in cache files and re-hydrating them would be
        // brittle (cache can be evicted any time).
        editTitle.setText(DraftStore.getString(DRAFT_TITLE))
        editDescription.setText(DraftStore.getString(DRAFT_DESCRIPTION))
    }

    override fun onPause() {
        super.onPause()
        val title = editTitle.text?.toString()?.trim().orEmpty()
        val description = editDescription.text?.toString()?.trim().orEmpty()
        if (title.isEmpty() && description.isEmpty()) {
            DraftStore.remove(DRAFT_TITLE, DRAFT_DESCRIPTION)
        } else {
            DraftStore.putString(DRAFT_TITLE, title)
            DraftStore.putString(DRAFT_DESCRIPTION, description)
        }
    }

    private fun refreshAttachments() {
        pendingAdapter.notifyDataSetChanged()
        rvAttachments.visibility = if (pendingFiles.isEmpty()) View.GONE else View.VISIBLE
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
                    val ticketId = result.data.id
                    var uploadFailed = false
                    pendingFiles.forEach { file ->
                        val uploadResult = FeedbackSDK.uploadTicketAttachment(ticketId, file)
                        if (uploadResult is SdkResult.Error) uploadFailed = true
                    }
                    val msg = if (uploadFailed) R.string.sdk_ticket_created_attach_failed
                              else R.string.sdk_ticket_created
                    Toast.makeText(this@CreateTicketActivity, msg, Toast.LENGTH_SHORT).show()
                    // Submitted → drop the draft so the next open starts clean.
                    DraftStore.remove(DRAFT_TITLE, DRAFT_DESCRIPTION)
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
        btnAttach.isEnabled = !loading
        btnSubmit.visibility = if (loading) View.INVISIBLE else View.VISIBLE
    }
}
