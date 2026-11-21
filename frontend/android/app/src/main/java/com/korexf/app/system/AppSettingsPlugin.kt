package com.korexf.app.system

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Opens this app's notification settings: when the user denied the permission in the system,
 * only the system can turn it back on (Ajustes → Notificaciones → "Avisos en el teléfono").
 */
@CapacitorPlugin(name = "AppSettings")
class AppSettingsPlugin : Plugin() {

    @PluginMethod
    fun openNotificationSettings(call: PluginCall) {
        val ctx = context
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(Uri.fromParts("package", ctx.packageName, null))
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            ctx.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Could not open the notification settings", "UNAVAILABLE")
        }
    }
}
