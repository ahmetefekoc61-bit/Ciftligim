import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/components/theme';
import { Badge, Button, Muted, Row, Screen } from '@/components/ui';
import { roleLabel } from '@/lib/labels';
import { useSession } from '@/lib/session';

// Giriş ekranı: Tarım / Hayvancılık
export default function Ana() {
  const { farm, user } = useSession();
  if (!farm) return null;

  return (
    <Screen>
      <Stack.Screen options={{
        title: farm.name,
        headerRight: () => <Button title="Değiştir" variant="ghost" onPress={() => router.push('/isletmeler')} style={{ minHeight: 36 }} />,
      }} />
      <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <Muted>Hoş geldin, {user?.fullName}</Muted>
        <Badge text={roleLabel[farm.role]} tone="green" />
      </Row>

      <BigChoice
        emoji="🐑"
        title="Hayvancılık"
        text="Sürüler, hayvan kartları, aşı/ilaç, tartım, yavrulama"
        color={colors.primary}
        onPress={() => router.push('/hayvancilik')}
      />
      <BigChoice
        emoji="🌾"
        title="Tarım"
        text="Tarlalar, ada/parsel, ekim ve verim geçmişi"
        color={colors.accent}
        onPress={() => router.push('/tarim')}
      />
    </Screen>
  );
}

function BigChoice({ emoji, title, text, color, onPress }: {
  emoji: string; title: string; text: string; color: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.big, { borderColor: color }, pressed && { opacity: 0.8 }]}>
      <Text style={{ fontSize: 56 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[st.bigTitle, { color }]}>{title}</Text>
        <Text style={st.bigText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={26} color={color} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  big: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.card, borderRadius: radius + 4, borderWidth: 2, padding: 20, marginBottom: 16, minHeight: 140 },
  bigTitle: { fontSize: 24, fontWeight: '800' },
  bigText: { fontSize: 15, color: colors.muted, marginTop: 4 },
});
