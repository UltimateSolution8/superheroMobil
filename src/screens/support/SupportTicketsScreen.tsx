import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import type { SupportTicket } from '../../api/types';
import { ApiError } from '../../api/http';
import { useAuth } from '../../auth/AuthContext';
import { useIsOnline } from '../../hooks/useIsOnline';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';

type Props = NativeStackScreenProps<any, any>;

function TicketRow({ item, onOpen }: { item: SupportTicket; onOpen: (id: string) => void }) {
  return (
    <Pressable onPress={() => onOpen(item.id)} style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle}>{item.subject ?? item.category}</Text>
        <Text style={styles.pill}>{item.status}</Text>
      </View>
      <Text style={styles.rowMeta}>{item.category}</Text>
      <Text style={styles.rowMeta}>{new Date(item.lastMessageAt).toLocaleString()}</Text>
    </Pressable>
  );
}

export function SupportTicketsScreen({ navigation }: Props) {
  const { withAuth } = useAuth();
  const online = useIsOnline();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await withAuth((t) => api.listSupportTickets(t));
      setTickets(res);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      setError('Could not load tickets.');
    } finally {
      setLoading(false);
    }
  }, [withAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const onOpen = useCallback(
    (id: string) => {
      navigation.navigate('SupportTicket', { ticketId: id });
    },
    [navigation],
  );

  const onNew = useCallback(() => {
    navigation.navigate('SupportNewTicket');
  }, [navigation]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.topBar}>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          Back
        </Text>
        <Text style={styles.h1}>Support</Text>
        <Text onPress={onNew} style={styles.link}>
          New
        </Text>
      </View>

      {!online ? <Notice kind="warning" text="You are offline." /> : null}
      {error ? <Notice kind="danger" text={error} /> : null}

      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TicketRow item={item} onOpen={onOpen} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.muted}>{loading ? 'Loading…' : 'No tickets yet.'}</Text>
        }
        initialNumToRender={10}
        windowSize={8}
        removeClippedSubviews
      />

      <PrimaryButton label="Create new ticket" onPress={onNew} style={styles.bottomCta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl, gap: theme.space.md },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  list: { gap: 10, paddingBottom: 10 },
  muted: { color: theme.colors.muted, textAlign: 'center', marginTop: 12 },
  row: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    gap: 6,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowTitle: { color: theme.colors.text, fontWeight: '900', flex: 1 },
  rowMeta: { color: theme.colors.muted, fontSize: 12 },
  pill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text,
  },
  bottomCta: { marginTop: 6 },
});

