import { Platform } from 'react-native';

// Default API address. Override at build time with EXPO_PUBLIC_API_URL,
// or at runtime from Account → Server address (handy while developing).
//  - Android emulator reaches your computer at 10.0.2.2
//  - iOS simulator / web use localhost
//  - A physical phone needs your computer's LAN IP, e.g. http://192.168.0.10:3000
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
export const DEFAULT_API_URL = (process.env.EXPO_PUBLIC_API_URL || fallback).replace(/\/+$/, '');

// Shown to customers choosing "Bank transfer" (same details as the web store)
export const BANK = {
  name: 'ZUPA Ltd',
  bank: 'Rokel Commercial Bank',
  account: 'SL01 RCBL 0000 1234 5678'
};
