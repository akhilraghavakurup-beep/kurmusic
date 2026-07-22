package expo.modules.apkinstaller

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
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

        AsyncFunction("installApk") { fileUriString: String, promise: Promise ->
            try {
                // Remove 'file://' prefix to get pure filepath
                val cleanPath = fileUriString.replace("file://", "")
                val file = File(cleanPath)

                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "APK file not found at path: $cleanPath", null)
                    return@AsyncFunction
                }

                val intent = Intent(Intent.ACTION_VIEW).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    val apkUri: Uri = FileProvider.getUriForFile(
                        context,
                        context.packageName + ".provider",
                        file
                    )
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
