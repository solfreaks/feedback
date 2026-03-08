package com.feedbacksdk.ui

import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.feedbacksdk.FeedbackSDK
import com.feedbacksdk.R
import com.feedbacksdk.internal.SdkResult
import com.feedbacksdk.models.Ticket
import com.google.android.material.appbar.MaterialToolbar
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class TicketListActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var tvEmpty: TextView
    private val tickets = mutableListOf<Ticket>()
    private lateinit var adapter: TicketAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.FeedbackSDK_Theme)
        setContentView(R.layout.sdk_activity_ticket_list)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        recyclerView = findViewById(R.id.recyclerView)
        progressBar = findViewById(R.id.progressBar)
        tvEmpty = findViewById(R.id.tvEmpty)

        adapter = TicketAdapter(tickets) { ticket ->
            FeedbackSDK.openTicketDetail(this, ticket.id)
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        loadTickets()
    }

    override fun onResume() {
        super.onResume()
        loadTickets()
    }

    private fun loadTickets() {
        lifecycleScope.launch {
            progressBar.visibility = View.VISIBLE
            when (val result = FeedbackSDK.listTickets()) {
                is SdkResult.Success -> {
                    tickets.clear()
                    tickets.addAll(result.data.tickets)
                    adapter.notifyDataSetChanged()
                    progressBar.visibility = View.GONE
                    tvEmpty.visibility = if (tickets.isEmpty()) View.VISIBLE else View.GONE
                }
                is SdkResult.Error -> {
                    progressBar.visibility = View.GONE
                    Toast.makeText(this@TicketListActivity, result.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private class TicketAdapter(
        private val tickets: List<Ticket>,
        private val onClick: (Ticket) -> Unit
    ) : RecyclerView.Adapter<TicketAdapter.ViewHolder>() {

        class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(R.id.tvTitle)
            val tvStatus: TextView = view.findViewById(R.id.tvStatus)
            val tvPriority: TextView = view.findViewById(R.id.tvPriority)
            val tvDate: TextView = view.findViewById(R.id.tvDate)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.sdk_item_ticket, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val ticket = tickets[position]
            holder.tvTitle.text = ticket.title
            holder.tvStatus.text = ticket.status.replace("_", " ")
            holder.tvStatus.setBackgroundColor(getStatusColor(ticket.status))
            holder.tvPriority.text = "Priority: ${ticket.priority}"
            holder.tvDate.text = formatDate(ticket.createdAt)
            holder.itemView.setOnClickListener { onClick(ticket) }
        }

        override fun getItemCount() = tickets.size

        private fun getStatusColor(status: String): Int {
            return when (status) {
                "open" -> Color.parseColor("#3B82F6")
                "in_progress" -> Color.parseColor("#F59E0B")
                "resolved" -> Color.parseColor("#10B981")
                "closed" -> Color.parseColor("#6B7280")
                else -> Color.parseColor("#6B7280")
            }
        }

        private fun formatDate(dateStr: String): String {
            return try {
                val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                val output = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                val date = input.parse(dateStr.substringBefore('.'))
                date?.let { output.format(it) } ?: dateStr
            } catch (_: Exception) {
                dateStr.substringBefore('T')
            }
        }
    }
}
