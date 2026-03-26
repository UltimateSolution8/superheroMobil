import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useActiveTask } from '../state/ActiveTaskContext';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nProvider';
import { theme } from './theme';

export function ActiveTaskBubble() {
  const { activeTaskId } = useActiveTask();
  const { user, status } = useAuth();
  const { t } = useI18n();
  const navigation = useNavigation<any>();

  const onPress = useCallback(() => {
    if (!activeTaskId || !user) return;
    if (user.role === 'BUYER') {
      navigation.navigate('BuyerTask', { taskId: activeTaskId });
      return;
    }
    if (user.role === 'HELPER') {
      navigation.navigate('HelperTask', { taskId: activeTaskId });
    }
  }, [activeTaskId, navigation, user]);

  if (status !== 'signedIn' || !activeTaskId || !user) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable onPress={onPress} style={styles.bubble}>
        <Text style={styles.title}>{t('active_task.title')}</Text>
        <Text style={styles.sub}>{t('active_task.tap')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: theme.space.lg,
    bottom: theme.space.lg + 20,
    zIndex: 20,
  },
  bubble: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.glow,
    ...theme.shadow.lifted,
  },
  title: { color: theme.colors.primaryText, fontWeight: '900', fontSize: 12 },
  sub: { color: theme.colors.primaryText, fontSize: 10, fontWeight: '700' },
});
