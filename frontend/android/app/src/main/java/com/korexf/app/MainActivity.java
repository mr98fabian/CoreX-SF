package com.korexf.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.korexf.app.billing.PlayBillingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app plugins are registered before the bridge starts
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
