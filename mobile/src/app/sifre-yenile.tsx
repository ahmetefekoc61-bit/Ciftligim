import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/components/theme';
import { Body, Button, Card, ErrorBox, Field, Muted, Screen, s } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { CLOUD_URL, useSession } from '@/lib/session';
import type { AuthResponse } from '@/lib/types';

export default function SifreYenile() {
  const session = useSession();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email && params.email.includes('@') ? params.email : '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) return setError('Kayıt olduğun e-posta adresini yaz.');
    setBusy(true);
    try {
      const res = await api.postTo<{ mesaj: string }>(CLOUD_URL, '/api/auth/forgot', { email: mail });
      setInfo(res.mesaj);
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) return setError('E-postadaki 6 haneli kodu yaz.');
    if (password.length < 8) return setError('Yeni şifre en az 8 karakter olmalı.');
    setBusy(true);
    try {
      const res = await api.postTo<AuthResponse>(CLOUD_URL, '/api/auth/reset', {
        email: email.trim().toLowerCase(), code: code.trim(), newPassword: password,
      });
      if (session.serverUrl !== CLOUD_URL) await session.setServerUrl(CLOUD_URL);
      await session.signIn({ userId: res.userId, fullName: res.fullName, token: res.token });
      router.replace('/isletmeler');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <Ionicons name="key-outline" size={40} color={colors.primary} />
          <Body style={{ fontWeight: '800', fontSize: 20, marginTop: 6 }}>Şifreni yenile</Body>
          <Muted style={{ textAlign: 'center', marginTop: 4 }}>
            {step === 'email'
              ? 'Kayıt olduğun e-postaya 6 haneli bir kod göndereceğiz.'
              : 'E-postana gelen kodu ve yeni şifreni yaz.'}
          </Muted>
        </View>

        <Card>
          <Field
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            editable={step === 'email'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="ornek@mail.com"
          />

          {step === 'code' && (
            <>
              {info && <Muted style={{ marginBottom: 12 }}>{info}</Muted>}
              <Field
                label="Kod"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="______"
                maxLength={6}
                style={[s.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
              />
              <Text style={s.label}>Yeni şifre</Text>
              <View style={{ marginBottom: 12, justifyContent: 'center' }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="En az 8 karakter"
                  placeholderTextColor="#9AA096"
                  style={[s.input, { paddingRight: 48 }]}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} style={{ position: 'absolute', right: 12, padding: 4 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
                </Pressable>
              </View>
            </>
          )}

          {error && <ErrorBox message={error} />}
          {step === 'email'
            ? <Button title="Kod gönder" icon="mail-outline" onPress={sendCode} loading={busy} />
            : <Button title="Şifreyi değiştir ve giriş yap" icon="checkmark" onPress={reset} loading={busy} />}
          {step === 'code' && (
            <Button title="Kodu tekrar gönder" variant="ghost" onPress={sendCode} disabled={busy} style={{ marginTop: 8 }} />
          )}
        </Card>

        <Muted style={{ textAlign: 'center', marginTop: 8 }}>
          Telefon numarasıyla kayıt olduysan işletme sahibinden yardım iste.
        </Muted>
      </Screen>
    </KeyboardAvoidingView>
  );
}
