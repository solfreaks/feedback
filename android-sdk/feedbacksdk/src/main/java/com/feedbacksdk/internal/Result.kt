package com.feedbacksdk.internal

import com.feedbacksdk.models.ErrorResponse
import com.google.gson.Gson
import retrofit2.Response

sealed class SdkResult<out T> {
    data class Success<T>(val data: T) : SdkResult<T>()
    data class Error(val message: String, val code: Int = 0) : SdkResult<Nothing>()
}

internal fun <T> Response<T>.toResult(): SdkResult<T> {
    return if (isSuccessful && body() != null) {
        SdkResult.Success(body()!!)
    } else {
        val errorBody = errorBody()?.string()
        val message = try {
            Gson().fromJson(errorBody, ErrorResponse::class.java).error
        } catch (_: Exception) {
            errorBody ?: "Unknown error"
        }
        SdkResult.Error(message, code())
    }
}
