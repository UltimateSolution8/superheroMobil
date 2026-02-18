import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../auth/AuthContext';
import { useI18n } from '../../i18n/I18nProvider';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { theme } from '../../ui/theme';
import type { BuyerStackParamList, HelperStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BuyerStackParamList & HelperStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { lang, setLang } = useI18n();
  const { signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.h1}>Settings</Text>
        <Text onPress={() => navigation.goBack()} style={styles.link}>
          Back
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Language</Text>
        <Segmented
          value={lang}
          onChange={(v) => setLang(v as 'en' | 'hi' | 'te')}
          options={[
            { key: 'en', label: 'EN' },
            { key: 'hi', label: 'हिं' },
            { key: 'te', label: 'తెల' },
          ]}
        />
        <PrimaryButton label="Sign out" variant="danger" onPress={signOut} />
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
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '800' },
});
