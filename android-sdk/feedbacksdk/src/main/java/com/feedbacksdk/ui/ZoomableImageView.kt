package com.feedbacksdk.ui

import android.content.Context
import android.graphics.Matrix
import android.graphics.PointF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import androidx.appcompat.widget.AppCompatImageView

/**
 * Minimal pinch-zoom + pan ImageView. Avoids pulling in PhotoView / Subsampling
 * libraries since this SDK already carries a lot of transitive deps. Enough for
 * viewing an attachment full-screen.
 */
internal class ZoomableImageView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0,
) : AppCompatImageView(context, attrs, defStyleAttr) {

    private val imageMatrix = Matrix()
    private val savedMatrix = Matrix()
    private var scale = 1f
    private val minScale = 1f
    private val maxScale = 6f

    private var mode = NONE
    private val lastTouch = PointF()
    private val startTouch = PointF()

    private val scaleDetector = ScaleGestureDetector(
        context,
        object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                val factor = detector.scaleFactor
                val newScale = (scale * factor).coerceIn(minScale, maxScale)
                val appliedFactor = newScale / scale
                scale = newScale
                imageMatrix.postScale(appliedFactor, appliedFactor, detector.focusX, detector.focusY)
                setImageMatrix(imageMatrix)
                return true
            }
        }
    )

    init {
        scaleType = ScaleType.MATRIX
    }

    override fun setImageMatrix(matrix: Matrix?) {
        super.setImageMatrix(matrix)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                savedMatrix.set(imageMatrix)
                startTouch.set(event.x, event.y)
                lastTouch.set(event.x, event.y)
                mode = DRAG
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                mode = ZOOM
            }
            MotionEvent.ACTION_MOVE -> {
                if (mode == DRAG && !scaleDetector.isInProgress && scale > minScale) {
                    val dx = event.x - lastTouch.x
                    val dy = event.y - lastTouch.y
                    imageMatrix.postTranslate(dx, dy)
                    setImageMatrix(imageMatrix)
                    lastTouch.set(event.x, event.y)
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                mode = NONE
            }
        }
        return true
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (changed || imageMatrix.isIdentity) {
            fitCenter()
        }
    }

    private fun fitCenter() {
        val drawable = drawable ?: return
        val viewW = (width - paddingLeft - paddingRight).toFloat()
        val viewH = (height - paddingTop - paddingBottom).toFloat()
        val dW = drawable.intrinsicWidth.toFloat()
        val dH = drawable.intrinsicHeight.toFloat()
        if (viewW <= 0 || viewH <= 0 || dW <= 0 || dH <= 0) return

        val s = minOf(viewW / dW, viewH / dH)
        val tx = (viewW - dW * s) / 2f + paddingLeft
        val ty = (viewH - dH * s) / 2f + paddingTop

        imageMatrix.reset()
        imageMatrix.postScale(s, s)
        imageMatrix.postTranslate(tx, ty)
        setImageMatrix(imageMatrix)
        scale = 1f
    }

    private companion object {
        const val NONE = 0
        const val DRAG = 1
        const val ZOOM = 2
    }
}
