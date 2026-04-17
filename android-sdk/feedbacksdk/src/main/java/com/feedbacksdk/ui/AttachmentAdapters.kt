package com.feedbacksdk.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.feedbacksdk.R
import com.feedbacksdk.internal.absoluteAttachmentUrl
import com.feedbacksdk.internal.isImageFileName
import com.feedbacksdk.models.Attachment
import java.io.File

/**
 * Read-only horizontal list of saved attachments on a ticket or feedback detail.
 * Tapping an item invokes [onClick] with the Attachment so the host can open
 * the viewer.
 */
internal class AttachmentAdapter(
    private val items: List<Attachment>,
    private val onClick: (Attachment) -> Unit,
) : RecyclerView.Adapter<AttachmentAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val ivThumb: ImageView = view.findViewById(R.id.ivThumb)
        val nonImage: LinearLayout = view.findViewById(R.id.nonImagePlaceholder)
        val tvFileName: TextView = view.findViewById(R.id.tvFileName)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.sdk_item_attachment, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        if (item.fileName.isImageFileName() || item.fileUrl.isImageFileName()) {
            holder.ivThumb.visibility = View.VISIBLE
            holder.nonImage.visibility = View.GONE
            holder.ivThumb.load(absoluteAttachmentUrl(item.fileUrl)) {
                crossfade(true)
            }
        } else {
            holder.ivThumb.visibility = View.GONE
            holder.nonImage.visibility = View.VISIBLE
            holder.tvFileName.text = item.fileName
        }
        holder.itemView.setOnClickListener { onClick(item) }
    }

    override fun getItemCount(): Int = items.size
}

/**
 * Horizontal list of not-yet-uploaded files picked on the create-ticket or
 * create-feedback screen. Each item has an (x) button to remove it before
 * submission.
 */
internal class PendingAttachmentAdapter(
    private val items: MutableList<File>,
    private val onRemove: (Int) -> Unit,
) : RecyclerView.Adapter<PendingAttachmentAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val ivThumb: ImageView = view.findViewById(R.id.ivThumb)
        val nonImage: LinearLayout = view.findViewById(R.id.nonImagePlaceholder)
        val tvFileName: TextView = view.findViewById(R.id.tvFileName)
        val btnRemove: ImageView = view.findViewById(R.id.btnRemove)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.sdk_item_pending_attachment, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val file = items[position]
        if (file.name.isImageFileName()) {
            holder.ivThumb.visibility = View.VISIBLE
            holder.nonImage.visibility = View.GONE
            holder.ivThumb.load(file) { crossfade(true) }
        } else {
            holder.ivThumb.visibility = View.GONE
            holder.nonImage.visibility = View.VISIBLE
            holder.tvFileName.text = file.name
        }
        holder.btnRemove.setOnClickListener {
            val pos = holder.bindingAdapterPosition
            if (pos != RecyclerView.NO_POSITION) onRemove(pos)
        }
    }

    override fun getItemCount(): Int = items.size
}
