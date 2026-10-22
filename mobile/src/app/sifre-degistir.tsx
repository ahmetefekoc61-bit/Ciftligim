import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '@/components/theme';
import { Button, Card, ErrorBox, Muted, Screen, s } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

function PasswordInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <View style={{ marginBottom: 12, justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor="#9AA096"
          style={[s.input, { paddingRight: 48 }]}
        />
        <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} style={{ position: 'absolute', right: 12, padding: 4 }}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
        </Pressable>
      </View>
    </>
  );
}

export default function SifreDegistir() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!current) return setError('Mevcut şifreni yaz.');
    if (next.length < 8) return setError('Yeni şifre en az 8 karakter olmalı.');
    setBusy(true);
    try {
      await api.post('/api/auth/change', { currentPassword: current, newPassword: next });
      Alert.alert('Şifren değişti', 'Bir dahaki girişte yeni şifreni kullan.', [{ text: 'Tamam', onPress: () => router.back() }]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Muted style={{ marginBottom: 12 }}>Yöneticiden geçici şifre aldıysan "mevcut şifre" kısmına onu yaz.</Muted>
        <PasswordInput label="Mevcut şifre" value={current} onChange={setCurrent} />
        <PasswordInput label="Yeni şifre" value={next} onChange={setNext} placeholder="En az 8 karakter" />
        {error && <ErrorBox message={error} />}
        <Button title="Şifreyi değiştir" icon="key-outline" onPress={save} loading={busy} />
      </Card>
    </Screen>
  );
}
