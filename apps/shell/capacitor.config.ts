import type { CapacitorConfig } from '@capacitor/cli'

/**
 * AlbaGo store shell (master plan APP-2) — remote URL mode.
 *
 * The webview loads the production site directly, so the product updates
 * continuously on the web side and the shell only changes when the native
 * bridge does. webDir/www holds only the offline fallback used before the
 * first successful load.
 */
const config: CapacitorConfig = {
  appId: 'org.albago.app',
  appName: 'AlbaGo',
  webDir: 'www',
  server: {
    url: 'https://www.albago.org',
    androidScheme: 'https',
  },
  backgroundColor: '#050505',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#050505',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
