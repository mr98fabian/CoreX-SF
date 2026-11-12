import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.korexf.app',
  appName: 'KoreX',
  webDir: 'dist',
  server: {
    // Production: loads bundled assets from /dist
    // Dev: uncomment the lines below and replace with your local IP for live reload
    // url: 'http://192.168.x.x:5173',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      backgroundColor: '#020617',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#020617',
    },
    Keyboard: {
      // Shell móvil parte 3: resizeOnFullScreen shrank the whole view to
      // "screen − keyboard" and only restored it on the keyboard's close
      // animation → the app stayed cut in half (Home / focus loss / sheet
      // closed with the keyboard up). The web engine decides the height now
      // (index.html: interactive-widget=resizes-content). `resize` is iOS-only.
      resizeOnFullScreen: false,
    },
  },
};

export default config;
