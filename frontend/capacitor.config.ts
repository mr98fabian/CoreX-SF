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
      launchShowDuration: 2000,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      backgroundColor: '#020617',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#020617',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
