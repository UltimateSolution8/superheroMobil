import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as api from '../api/client';

const STORAGE_PREFIX = 'superheroo.pushToken';
const RE_REGISTER_MS = 24 * 60 * 60 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(accessToken: string, userId?: string | null): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Tasks',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }
    if (status !== 'granted') return;

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data;
    if (!token) return;

    const storageKey = `${STORAGE_PREFIX}.${userId ?? 'unknown'}`;
    const cachedRaw = await AsyncStorage.getItem(storageKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as { token?: string; at?: number };
        const stillFresh =
          cached?.token === token &&
          typeof cached?.at === 'number' &&
          Date.now() - cached.at < RE_REGISTER_MS;
        if (stillFresh) return;
      } catch {
        // ignore corrupted cache
      }
    }

    await api.registerPushToken(accessToken, { token, platform: Platform.OS });
    await AsyncStorage.setItem(storageKey, JSON.stringify({ token, at: Date.now() }));
  } catch {
    // best-effort
  }
}
