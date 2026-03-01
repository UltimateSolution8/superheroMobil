import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';

const TERMS_TEXT = [
  'Superheroo is a hyperlocal help platform. We connect buyers who need quick help with verified helpers.',
  'Banned tasks: illegal activities, weapons, drugs, adult services, harassment, medical procedures, financial fraud, gambling, or anything unsafe.',
  'Safety rules: always meet in public or monitored spaces, avoid sharing OTPs or bank details, and verify the task details before starting.',
  'Payments: demo escrow holds buyer funds until completion and approval. Platform fees may apply.',
  'Photo/selfie policy: selfies are used for arrival and completion verification. Do not share or misuse images.',
  'We may suspend or remove accounts for policy violations or abusive behavior.',
  'By using the app, you consent to limited location use for matching and safety.',
];

export function TermsScreen() {
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.h1}>Terms & Safety</Text>
        <ScrollView>
          {TERMS_TEXT.map((line, idx) => (
            <Text key={idx} style={styles.line}>
              • {line}
            </Text>
          ))}
        </ScrollView>
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
  h1: { color: theme.colors.text, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  line: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
});
