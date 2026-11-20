import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.areta.sport',
  appName: 'SynFit',
  webDir: 'dist',
  server: {
    url: 'https://synfitgym.web.app',
    cleartext: true
  }
};

export default config;
