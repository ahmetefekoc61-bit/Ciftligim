import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { colors } from '@/components/theme';
import { Button, Card, Chips, ErrorBox, Field, Muted, Row, Screen } from '@/components/ui';
import { api, errorMessage, normalizeUrl } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AuthResponse } from '@/lib/types';

type Mode = 'login' | 'register';

export default function Giris() {
  const session = useSession();
  const [server, setServer] = useState(session.serverUrl);
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setServer(session.serverUrl); }, [session.serverUrl]);

  const testServer = async () => {
    setTesting(true);
    try {
      await api.ping(server);
      await session.setServerUrl(server);
      Alert.alert('Bağlantı tamam', `Sunucuya ulaşıldı:\n${normalizeUrl(server)}`);
    } catch (e) {
      Alert.alert('Bağlanılamadı', errorMessage(e));
    } finally {
      setTesting(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!server.trim()) return setError('Önce sunucu adresini girin.');
    if (!login.trim() || !password) return setError('E-posta/telefon ve şifre gerekli.');
    setBusy(true);
    try {
      await session.setServerUrl(server);
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
          <Field
            label="Sunucu adresi"
            value={server}
            onChangeText={setServer}
            placeholder="ör. 192.168.1.35"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            hint="Bulut sunucu adresi ya da evdeki bilgisayarın IP'si. Sunucu uyuyorsa ilk bağlantı 1 dakika kadar sürebilir."
          />
          <Button title="Bağlantıyı test et" variant="secondary" icon="wifi" onPress={testServer} loading={testing} />
        </Card>

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
          <Field
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={mode === 'register' ? 'En az 8 karakter' : ''}
          />
          {error && <ErrorBox message={error} />}
          <Button title={mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'} onPress={submit} loading={busy} />
        </Card>

        <Row style={{ justifyContent: 'center' }}>
          <Muted>Telefon ile bilgisayar aynı Wi-Fi ağında olmalı.</Muted>
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
