package com.feedbacksdk.internal

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.feedbacksdk.api.ApiClient
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Copies a picked content URI into a cache file the SDK can hand to Retrofit's
 * multipart upload. We avoid depending on the picker giving us a real File — on
 * modern Android, most content URIs are not backed by a filesystem path, so this
 * copy is effectively mandatory.
 *
 * Returns null if reading the URI fails (e.g. the picker returned a transient
 * permission that has since been revoked).
 */
internal fun Context.uriToCacheFile(uri: Uri): File? {
    val displayName = queryDisplayName(uri) ?: "attachment_${UUID.randomUUID()}"
    val safeName = displayName.replace(Regex("[^A-Za-z0-9._-]"), "_")
    val extension = safeName.substringAfterLast('.', "")
        .ifEmpty { mimeTypeExtension(uri) ?: "bin" }
    val baseName = safeName.substringBeforeLast('.', safeName)
    val outFile = File(cacheDir, "sdk_attachments/${UUID.randomUUID()}_$baseName.$extension")
    outFile.parentFile?.mkdirs()

    return try {
        contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        } ?: return null
        outFile
    } catch (_: Exception) {
        null
    }
}

private fun Context.queryDisplayName(uri: Uri): String? {
    return contentResolver.query(
        uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null
    )?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0) else null
    }
}

private fun Context.mimeTypeExtension(uri: Uri): String? {
    val mime = contentResolver.getType(uri) ?: return null
    return MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)
}

/**
 * Convert a server-relative attachment path (e.g. "/uploads/abc.png") into an
 * absolute URL Coil / ACTION_VIEW can load. Returns the input unchanged if it
 * already starts with "http".
 */
internal fun absoluteAttachmentUrl(fileUrl: String): String {
    if (fileUrl.startsWith("http", ignoreCase = true)) return fileUrl
    val base = ApiClient.baseUrl.trimEnd('/')
    // Strip `/api` suffix if present — uploads are served at server root, not under /api.
    val root = if (base.endsWith("/api", ignoreCase = true)) {
        base.removeSuffix("/api").removeSuffix("/API")
    } else {
        base
    }
    return root + (if (fileUrl.startsWith("/")) fileUrl else "/$fileUrl")
}

/** Best-effort guess at whether an attachment filename is a previewable image. */
internal fun String.isImageFileName(): Boolean {
    val ext = substringAfterLast('.', "").lowercase()
    return ext in setOf("jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif")
}

/** Returns a MIME type for a filename extension, e.g. "application/pdf" for "doc.pdf". */
internal fun mimeTypeForFileName(fileName: String): String {
    val ext = fileName.substringAfterLast('.', "").lowercase()
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: ""
}
