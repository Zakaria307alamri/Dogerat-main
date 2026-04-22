package willi.fiend.Utils

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.karumi.dexter.Dexter
import com.karumi.dexter.MultiplePermissionsReport
import com.karumi.dexter.PermissionToken
import com.karumi.dexter.listener.PermissionRequest
import com.karumi.dexter.listener.multi.MultiplePermissionsListener

class AppPermission(private val context: Context) {
    
    fun getPerms(onPermissionsChecked: () -> Unit) {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ (API 33+) permissions
            listOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO,
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.SEND_SMS,
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.INTERNET,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.POST_NOTIFICATIONS
            )
        } else {
            // Android 12 and below permissions
            listOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.SEND_SMS,
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.INTERNET,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        }
        
        Dexter
            .withContext(context)
            .withPermissions(permissions)
            .withListener(object : MultiplePermissionsListener {
                override fun onPermissionsChecked(p0: MultiplePermissionsReport?) {
                    onPermissionsChecked()
                }

                override fun onPermissionRationaleShouldBeShown(
                    p0: MutableList<PermissionRequest>?,
                    p1: PermissionToken?
                ) {}
            }).check()
    }

    fun checkReadExternalStorage(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // For Android 13+, check media permissions
            context.checkCallingOrSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) == granted ||
            context.checkCallingOrSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) == granted ||
            context.checkCallingOrSelfPermission(Manifest.permission.READ_MEDIA_AUDIO) == granted
        } else {
            val requiredPermission = Manifest.permission.READ_EXTERNAL_STORAGE
            val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
            checkPrem == granted
        }
    }

    fun checkWriteExternalStorage(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ uses scoped storage, no WRITE_EXTERNAL_STORAGE needed for app directories
            true
        } else {
            val requiredPermission = Manifest.permission.WRITE_EXTERNAL_STORAGE
            val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
            checkPrem == granted
        }
    }

    fun checkReadSms(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission2 = Manifest.permission.READ_SMS
        val checkPrem2: Int = context.checkCallingOrSelfPermission(requiredPermission2)
        return checkPrem2 == granted
    }

    fun checkReceiveSms(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission = Manifest.permission.RECEIVE_SMS
        val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
        return checkPrem == granted
    }

    fun checkSendSms(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission3 = Manifest.permission.SEND_SMS
        val checkPrem3: Int = context.checkCallingOrSelfPermission(requiredPermission3)
        return checkPrem3 == granted
    }

    fun checkReadCallLog(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission = Manifest.permission.READ_CALL_LOG
        val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
        return checkPrem == granted
    }

    fun checkReadContacts(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission = Manifest.permission.READ_CONTACTS
        val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
        return checkPrem == granted
    }
    
    fun checkCaptureMic(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission = Manifest.permission.RECORD_AUDIO
        val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
        return checkPrem == granted
    }
    
    fun checkCaptureCam(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission = Manifest.permission.CAMERA
        val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
        return checkPrem == granted
    }
    
    fun checkGetLocation(): Boolean {
        val granted = PackageManager.PERMISSION_GRANTED
        val requiredPermission = Manifest.permission.ACCESS_FINE_LOCATION
        val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
        return checkPrem == granted
    }
    
    fun checkPostNotifications(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = PackageManager.PERMISSION_GRANTED
            val requiredPermission = Manifest.permission.POST_NOTIFICATIONS
            val checkPrem: Int = context.checkCallingOrSelfPermission(requiredPermission)
            checkPrem == granted
        } else {
            true // Not required for Android 12 and below
        }
    }
}
