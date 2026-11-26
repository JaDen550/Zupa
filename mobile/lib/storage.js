import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Auth token goes in the OS keychain/keystore on devices; plain storage on web preview.
const secure = Platform.OS !== 'web';

export async function getToken() {
  try { return (secure ? await SecureStore.getItemAsync('lm_token') : await AsyncStorage.getItem('lm_token')) || ''; }
  catch { return ''; }
}
export async function setTokenStored(t) {
  try {
    if (secure) { t ? await SecureStore.setItemAsync('lm_token', t) : await SecureStore.deleteItemAsync('lm_token'); }
    else { t ? await AsyncStorage.setItem('lm_token', t) : await AsyncStorage.removeItem('lm_token'); }
  } catch { /* ignore */ }
}
export async function getJSON(key, fallback) {
  try { const v = await AsyncStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
export async function setJSON(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
