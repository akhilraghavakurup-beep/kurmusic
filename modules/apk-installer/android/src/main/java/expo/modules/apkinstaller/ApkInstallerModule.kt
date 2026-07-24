package expo.modules.apkinstaller

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.File

class ApkInstallerModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context is null")

    override fun definition() = ModuleDefinition {
        Name("ApkInstaller")

        AsyncFunction("canInstallApk") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.packageManager.canRequestPackageInstalls()
            } else {
                true
            }
        }

        AsyncFunction("openUnknownAppSourcesSettings") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                true
            } else {
                false
            }
        }

        AsyncFunction("installApk") { fileUriString: String, promise: Promise ->
            try {
                // Remove 'file://' prefix to get pure filepath
                val cleanPath = fileUriString.replace("file://", "")
                val file = File(cleanPath)

                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "APK file not found at path: $cleanPath", null)
                    return@AsyncFunction
                }

                // On Android 8.0+ (Oreo), check if permission to install unknown apps is granted
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
                    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                    promise.reject("PERMISSION_DENIED", "Install unknown apps permission required. Please grant permission in settings and try again.", null)
                    return@AsyncFunction
                }

                val intent = Intent(Intent.ACTION_VIEW).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    val authority = context.packageName + ".provider"
                    val apkUri: Uri = FileProvider.getUriForFile(context, authority, file)
                    intent.setDataAndType(apkUri, "application/vnd.android.package-archive")
                } else {
                    intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive")
                }

                context.startActivity(intent)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("INSTALL_FAILED", e.message ?: "Failed to install APK", e)
            }
        }
    }
}
