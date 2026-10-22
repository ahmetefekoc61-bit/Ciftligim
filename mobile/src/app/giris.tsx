import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/components/theme';
import { Button, Card, Chips, ErrorBox, Field, Muted, Screen, s } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { CLOUD_URL, useSession } from '@/lib/session';
import type { AuthResponse } from '@/lib/types';

type Mode = 'login' | 'register';

export default function Giris() {
  const session = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!login.trim() || !password) return setError('E-posta/telefon ve şifre gerekli.');
    setBusy(true);
    try {
      const server = CLOUD_URL;
      if (session.serverUrl !== server) await session.setServerUrl(server);
      const isEmail = login.includes('@');
      const res = mode === 'login'
        ? await api.postTo<AuthResponse>(server, '/api/auth/login', { login: login.trim(), password })
        : await api.postTo<AuthResponse>(server, '/api/auth/register', {
            fullName: fullName.trim(),
            email: isEmail ? login.trim() : null,
            phone: isEmail ? null : login.trim(),
            password,
          });
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
        <View style={{ alignItems: 'center', marginVertical: 16 }}>
          <Text style={{ fontSize: 48 }}>🐑🌾</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.primaryDark, marginTop: 6 }}>Çiftliğim</Text>
          <Muted>Tarla ve sürü kayıtların cebinde</Muted>
        </View>

        <Card>
          <Chips
            options={[{ value: 'login', label: 'Giriş yap' }, { value: 'register', label: 'Kayıt ol' }]}
            value={mode}
            onChange={(v) => v && setMode(v)}
          />
          {mode === 'register' && (
            <Field label="Ad soyad" value={fullName} onChangeText={setFullName} placeholder="Ahmet Yılmaz" />
          )}
          <Field
            label="E-posta ya da telefon"
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="ornek@mail.com / 05xx..."
          />
          <Text style={s.label}>Şifre</Text>
          <View style={{ marginBottom: 12, justifyContent: 'center' }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={mode === 'register' ? 'En az 8 karakter' : ''}
              placeholderTextColor="#9AA096"
              style={[s.input, { paddingRight: 48 }]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={10}
              style={{ position: 'absolute', right: 12, padding: 4 }}
              accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
            </Pressable>
          </View>
          {error && <ErrorBox message={error} />}
          <Button title={mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'} onPress={submit} loading={busy} />
          {mode === 'login' && (
            <Button
              title="Şifremi unuttum"
              variant="ghost"
              onPress={() => router.push({ pathname: '/sifre-yenile', params: { email: login.trim() } })}
              style={{ marginTop: 6 }}
            />
          )}
        </Card>

        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 8, opacity: 0.9 }}>
          <Image source={require('../../assets/aek-logo.png')} style={{ width: 150, height: 98 }} resizeMode="contain" />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
