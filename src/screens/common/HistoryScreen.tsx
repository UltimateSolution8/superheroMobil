import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import * as api from '../../api/client';
import type { Task } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import type { BuyerStackParamList, HelperStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList, 'History'>;

export function HistoryScreen({ navigation }: Props) {
  const { user, withAuth } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const list = await withAuth((t) => api.listMyTasks(t));
      setTasks(list || []);
    } catch {
      setError('Could not load task history.');
    } finally {
      setBusy(false);
    }
  }, [withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );

  const onOpen = useCallback(
    (taskId: string) => {
      if (!user) return;
      if (user.role === 'HELPER') {
        navigation.navigate('HelperTask', { taskId });
      } else {
        navigation.navigate('BuyerTask', { taskId });
      }
    },
    [navigation, user],
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>History</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          Back
        </Text>
      </View>

      {error ? <Notice kind="danger" text={error} /> : null}

      <View style={styles.card}>
        <PrimaryButton label="Refresh" onPress={load} loading={busy} variant="ghost" />
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onOpen(item.id)}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              <Text style={styles.meta}>Budget: INR {(item.budgetPaise / 100).toFixed(0)}</Text>
              {item.addressText ? <Text style={styles.meta}>{item.addressText}</Text> : null}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.muted}>No tasks yet.</Text>}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  list: { gap: 10, paddingTop: 8 },
  row: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    backgroundColor: theme.colors.card,
    gap: 4,
  },
  title: { color: theme.colors.text, fontWeight: '800' },
  meta: { color: theme.colors.muted, fontSize: 12 },
  muted: { color: theme.colors.muted, textAlign: 'center', paddingVertical: 12 },
});
