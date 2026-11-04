import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memory = new Map();

export async function getStoredItem(key) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return memory.get(key) || null;
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setStoredItem(key, value) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      memory.set(key, value);
      return;
    }
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteStoredItem(key) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      memory.delete(key);
      return;
    }
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
