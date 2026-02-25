import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface NotificationPreferences {
    payment: boolean;
    daily: boolean;
    bank: boolean;
    milestones: boolean;
    weekly: boolean;
}

interface NotificationContextType {
    permission: NotificationPermission;
    preferences: NotificationPreferences;
    requestPermission: () => Promise<NotificationPermission>;
    updatePreference: (key: keyof NotificationPreferences, value: boolean) => void;
    sendNotification: (title: string, body: string, icon?: string) => void;
    isSupported: boolean;
}

const STORAGE_KEY = "korex-notification-prefs";
const defaultPreferences: NotificationPreferences = {
    payment: true,
    daily: false,
    bank: true,
    milestones: true,
    weekly: false,
};

const NotificationContext = createContext<NotificationContextType | null>(null);

function loadPreferences(): NotificationPreferences {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return { ...defaultPreferences, ...JSON.parse(stored) };
    } catch {
        // Ignore parse errors
    }
    return defaultPreferences;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const isSupported = typeof window !== "undefined" && "Notification" in window;
    const [permission, setPermission] = useState<NotificationPermission>(
        isSupported ? Notification.permission : "denied"
    );
    const [preferences, setPreferences] = useState<NotificationPreferences>(loadPreferences);

    // Persist preferences to localStorage on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }, [preferences]);

    const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!isSupported) return "denied";
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
    }, [isSupported]);

    const updatePreference = useCallback(
        (key: keyof NotificationPreferences, value: boolean) => {
            setPreferences((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    const sendNotification = useCallback(
        (title: string, body: string, icon?: string) => {
            if (!isSupported || permission !== "granted") return;
            try {
                new Notification(title, {
                    body,
                    icon: icon || "/favicon.ico",
                    badge: "/favicon.ico",
                    tag: `korex-${Date.now()}`,
                });
            } catch (err) {
                console.warn("Failed to send notification:", err);
            }
        },
        [isSupported, permission]
    );

    return (
        <NotificationContext.Provider
            value={{
                permission,
                preferences,
                requestPermission,
                updatePreference,
                sendNotification,
                isSupported,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotificationContext() {
    const ctx = useContext(NotificationContext);
    if (!ctx) {
        throw new Error("useNotificationContext must be used within NotificationProvider");
    }
    return ctx;
}
