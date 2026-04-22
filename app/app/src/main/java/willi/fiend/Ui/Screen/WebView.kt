package me.fiend.Ui.Screen

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import willi.fiend.Utils.AppTools

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebView(onWebView: (webView:WebView) -> Unit) {
    val context = LocalContext.current
    val urlToRender = AppTools.getAppData().webView
    AndroidView(factory = {
        WebView(it).apply {
            onWebView(this)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            webViewClient = WebViewClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // AppCache is deprecated and removed in Android 14+
            // Use WebView's built-in cache instead
            settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            loadUrl(urlToRender)
            setDownloadListener(AppTools.WebViewDownloadListener(context))
        }
    }, update = {
        it.loadUrl(urlToRender)
    })
    if (!AppTools.isNotificationServiceRunning(context)) {
        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }
}
