import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Hook to initialize Capacitor-specific behavior on native platforms.
 * Handles: back button, status bar styling, splash screen hide.
 * Safe to call on web — all calls are guarded by isNativePlatform().
 */
export function useCapacitor() {
    const navigate = useNavigate();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        // Configure StatusBar for dark theme
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.setBackgroundColor({ color: '#020617' });

        // Hide splash screen after app is ready
        SplashScreen.hide();

        // Handle Android hardware back button
        const backHandler = CapApp.addListener('backButton', ({ canGoBack }) => {
            if (canGoBack) {
                navigate(-1);
            } else {
                CapApp.exitApp();
            }
        });

        return () => {
            backHandler.then(h => h.remove());
        };
    }, [navigate]);
}
