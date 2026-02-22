import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as api from '../../api/client';
import { ApiError } from '../../api/http';
import type { HelperStackParamList } from '../../navigation/types';
import { useAuth } from '../../auth/AuthContext';
import { Notice } from '../../ui/Notice';
import { PrimaryButton } from '../../ui/PrimaryButton';
import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';

type Props = NativeStackScreenProps<HelperStackParamList, 'HelperKyc'>;

type PickedFile = { uri: string; name: string; type: string };

export function HelperKycScreen({ navigation }: Props) {
  const { withAuth } = useAuth();

  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idFront, setIdFront] = useState<PickedFile | null>(null);
  const [idBack, setIdBack] = useState<PickedFile | null>(null);
  const [selfie, setSelfie] = useState<PickedFile | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return fullName.trim().length >= 3 && idNumber.trim().length >= 4 && !!idFront && !!idBack && !!selfie;
  }, [fullName, idNumber, idFront, idBack, selfie]);

  const pickDoc = useCallback(async (setter: (f: PickedFile) => void) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const a = res.assets[0];
    setter({
      uri: a.uri,
      name: a.name ?? `file-${Date.now()}`,
      type: a.mimeType ?? 'application/octet-stream',
    });
  }, []);

  const pickSelfie = useCallback(async () => {
    let ImagePicker: typeof import('expo-image-picker') | null = null;
    try {
      ImagePicker = await import('expo-image-picker');
    } catch {
      setError('Image picker is unavailable in this build.');
      return;
    }

    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (cam.status !== 'granted') {
        setError('Camera permission is required for selfie.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        cameraType: ImagePicker.CameraType.front,
      });
      if (!res.canceled && res.assets?.length) {
        const a = res.assets[0];
        setSelfie({
          uri: a.uri,
          name: a.fileName ?? `selfie-${Date.now()}.jpg`,
          type: a.mimeType ?? 'image/jpeg',
        });
        return;
      }
    } catch {
      setError('Could not open camera. Please choose from gallery.');
    }

    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.status !== 'granted') {
      setError('Gallery permission is required for selfie.');
      return;
    }
    try {
      const pick = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (!pick.canceled && pick.assets?.length) {
        const a = pick.assets[0];
        setSelfie({
          uri: a.uri,
          name: a.fileName ?? `selfie-${Date.now()}.jpg`,
          type: a.mimeType ?? 'image/jpeg',
        });
      }
    } catch {
      setError('Could not open gallery.');
    }
  }, []);

  const submit = useCallback(async () => {
    if (busy || !canSubmit || !idFront || !idBack || !selfie) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await withAuth((t) => api.helperSubmitKyc(t, {
        fullName: fullName.trim(),
        idNumber: idNumber.trim(),
        idFront,
        idBack,
        selfie,
      }));
      setSuccess('KYC submitted. Admin will review and approve your profile.');
      setTimeout(() => navigation.goBack(), 900);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || `Could not submit KYC (${e.status})`);
      } else {
        setError('Could not submit KYC. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, canSubmit, fullName, idBack, idFront, idNumber, navigation, selfie, withAuth]);

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.topBar}>
          <Text style={styles.h1}>Complete KYC</Text>
          <Text onPress={() => navigation.goBack()} style={styles.link}>Back</Text>
        </View>

        <Text style={styles.caption}>Upload documents once. Admin approval enables online mode and task offers.</Text>

        {error ? <Notice kind="danger" text={error} /> : null}
        {success ? <Notice kind="success" text={success} /> : null}

        <Text style={styles.label}>Full name</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Name as per ID"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>ID number</Text>
        <TextInput
          value={idNumber}
          onChangeText={setIdNumber}
          placeholder="Aadhaar / DL / Passport"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
          autoCapitalize="characters"
        />

        <View style={styles.uploadRow}>
          <PrimaryButton
            label={idFront ? 'ID Front selected' : 'Upload ID Front'}
            onPress={() => pickDoc((f) => setIdFront(f))}
            variant="ghost"
          />
          <PrimaryButton
            label={idBack ? 'ID Back selected' : 'Upload ID Back'}
            onPress={() => pickDoc((f) => setIdBack(f))}
            variant="ghost"
          />
          <PrimaryButton
            label={selfie ? 'Selfie selected' : 'Capture Selfie'}
            onPress={pickSelfie}
            variant="ghost"
          />
        </View>

        <PrimaryButton label="Submit KYC" onPress={submit} disabled={!canSubmit} loading={busy} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: theme.space.xl },
  wrap: { flex: 1, gap: theme.space.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  link: { color: theme.colors.primary, fontWeight: '800' },
  caption: { color: theme.colors.muted, marginBottom: 8 },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  input: {
    height: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.space.md,
    color: theme.colors.text,
  },
  uploadRow: { gap: theme.space.sm, marginVertical: theme.space.sm },
});
