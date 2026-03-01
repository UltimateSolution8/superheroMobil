import React, { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthContext';
import { Screen } from '../../ui/Screen';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Notice } from '../../ui/Notice';
import { theme } from '../../ui/theme';
import * as api from '../../api/client';

const SOS_NUMBER = '7842541414';

export function SosScreen() {
  const { withAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const triggerSos = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await withAuth((t) => api.createSupportTicket(t, {
        category: 'SAFETY',
        subject: 'SOS emergency',
        message: 'SOS triggered from mobile app. Please call the user immediately.',
      }));
      setSuccess('SOS sent to support. Calling now…');
      await Linking.openURL(`tel:${SOS_NUMBER}`);
    } catch {
      setError('Could not send SOS. Try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, withAuth]);

  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.h1}>Emergency SOS</Text>
        <Text style={styles.sub}>
          This sends an urgent alert to the support team and opens a call to {SOS_NUMBER}.
        </Text>

        {error ? <Notice kind="danger" text={error} /> : null}
        {success ? <Notice kind="success" text={success} /> : null}

        <PrimaryButton label="Send SOS & Call" onPress={triggerSos} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  h1: { color: theme.colors.text, fontSize: 22, fontWeight: '900' },
  sub: { color: theme.colors.muted, fontSize: 13, lineHeight: 18 },
});
