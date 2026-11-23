package com.korexf.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.korexf.app.billing.PlayBillingPlugin;
import com.korexf.app.system.AppSettingsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app plugins are registered before the bridge starts
        registerPlugin(PlayBillingPlugin.class);
        registerPlugin(AppSettingsPlugin.class);
        super.onCreate(savedInstanceState);
        createPushChannel();
    }

    /** "Avisos de KoreX", high importance (heads-up). Idempotent: re-creating only refreshes the
     * name and description; the user's own choices for the channel are kept by Android. */
    private void createPushChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            getString(R.string.push_channel_id),
            getString(R.string.push_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(getString(R.string.push_channel_description));
        channel.enableLights(true);
        channel.setLightColor(getColor(R.color.korex_amber));
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
}
