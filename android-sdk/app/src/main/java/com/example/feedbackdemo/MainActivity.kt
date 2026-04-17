package com.example.feedbackdemo

import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.feedbackdemo.databinding.ActivityMainBinding
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.internal.SdkResult
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        lifecycleScope.launch {
            when (val r = FeedbackSDK.handleGoogleSignInResult(result.data)) {
                is SdkResult.Success -> {
                    toast("Signed in as ${r.data.user.name ?: r.data.user.email}")
                    refreshAuthState()
                }
                is SdkResult.Error -> toast("Sign-in failed: ${r.message}")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnSignIn.setOnClickListener {
            runCatching { FeedbackSDK.getGoogleSignInIntent(this) }
                .onSuccess { googleSignInLauncher.launch(it) }
                .onFailure { toast(it.message ?: "Unable to start sign-in") }
        }

        binding.btnCreateTicket.setOnClickListener {
            FeedbackSDK.openCreateTicket(this)
        }

        binding.btnMyTickets.setOnClickListener {
            FeedbackSDK.openTicketList(this)
        }

        binding.btnFeedback.setOnClickListener {
            FeedbackSDK.openFeedback(this)
        }

        binding.btnMyFeedback.setOnClickListener {
            FeedbackSDK.openFeedbackList(this)
        }

        binding.btnLogout.setOnClickListener {
            FeedbackSDK.logout()
            refreshAuthState()
            toast("Logged out")
        }

        refreshAuthState()
    }

    override fun onResume() {
        super.onResume()
        refreshAuthState()
    }

    private fun refreshAuthState() {
        val user = FeedbackSDK.currentUser
        binding.tvStatus.text = if (user != null) {
            "Logged in as ${user.name}"
        } else {
            "Not signed in"
        }
        val loggedIn = FeedbackSDK.isLoggedIn
        binding.btnSignIn.isEnabled = !loggedIn
        binding.btnLogout.isEnabled = loggedIn
        binding.btnCreateTicket.isEnabled = loggedIn
        binding.btnMyTickets.isEnabled = loggedIn
        binding.btnFeedback.isEnabled = loggedIn
        binding.btnMyFeedback.isEnabled = loggedIn
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }
}
