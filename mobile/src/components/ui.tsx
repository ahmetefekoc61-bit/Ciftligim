import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet,
  Switch, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fmtDate, fromIsoDate, toIsoDate } from '@/lib/format';
import { colors, gap, radius } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- yerleşim

export function Screen({ children, refreshing, onRefresh, padded = true, footer }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; padded?: boolean; footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={s.screen} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[padded && s.padded, { paddingBottom: footer ? 100 : 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        ) : undefined}
      >
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, style, pressed && s.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

export function Section({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

// ---------------------------------------------------------------- metin

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}
export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}
export function Body({ children, style, numberOfLines }: { children: ReactNode; style?: object; numberOfLines?: number }) {
  return <Text style={[s.body, style]} numberOfLines={numberOfLines}>{children}</Text>;
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number'
        ? <Text style={s.infoValue}>{value}</Text>
        : value}
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  const map = {
    neutral: [colors.border, colors.text], green: [colors.primarySoft, colors.primaryDark],
    amber: [colors.accentSoft, '#7A5313'], red: [colors.dangerSoft, colors.danger], blue: [colors.infoSoft, colors.info],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- durumlar

export function Loading() {
  return <View style={{ padding: 40 }}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.errorBox}>
      <Row><Ionicons name="alert-circle" size={20} color={colors.danger} /><Text style={s.errorText}>{message}</Text></Row>
      {onRetry && <Button title="Tekrar dene" variant="ghost" onPress={onRetry} style={{ marginTop: 8 }} />}
    </View>
  );
}

export function Empty({ icon = 'leaf-outline', title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color={colors.muted} />
      <Text style={[s.body, { marginTop: 8, fontWeight: '600' }]}>{title}</Text>
      {hint && <Text style={[s.muted, { textAlign: 'center', marginTop: 4 }]}>{hint}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------- düğmeler

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const v = {
    primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
    secondary: { bg: colors.card, fg: colors.primary, border: colors.primary },
    danger: { bg: colors.card, fg: colors.danger, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.button, { backgroundColor: v.bg, borderColor: v.border }, off && { opacity: 0.5 }, pressed && s.pressed, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <Row>
          {icon && <Ionicons name={icon} size={18} color={v.fg} />}
          <Text style={[s.buttonText, { color: v.fg }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function Fab({ icon = 'add', label, onPress }: { icon?: IconName; label?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.fab, pressed && s.pressed]}>
      <Ionicons name={icon} size={24} color="#fff" />
      {label && <Text style={s.fabText}>{label}</Text>}
    </Pressable>
  );
}

export function Tile({ icon, title, subtitle, onPress, tone = 'green' }: {
  icon: IconName; title: string; subtitle?: string; onPress: () => void; tone?: 'green' | 'amber' | 'blue';
}) {
  const bg = { green: colors.primarySoft, amber: colors.accentSoft, blue: colors.infoSoft }[tone];
  const fg = { green: colors.primaryDark, amber: '#7A5313', blue: colors.info }[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.tile, pressed && s.pressed]}>
      <View style={[s.tileIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={22} color={fg} /></View>
      <Text style={s.tileTitle}>{title}</Text>
      {subtitle ? <Text style={s.muted} numberOfLines={2}>{subtitle}</Text> : null}
    </Pressable>
  );
}

export function ListItem({ title, subtitle, left, right, onPress }: {
  title: string; subtitle?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.listItem, pressed && s.pressed]}>
      {left}
      <View style={{ flex: 1 }}>
        <Text style={s.listTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.muted} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

// ---------------------------------------------------------------- form

export function Field({ label, hint, half, ...props }: TextInputProps & { label: string; hint?: string; half?: boolean }) {
  return (
    <View style={[{ marginBottom: gap }, half && { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA096" style={[s.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }]} {...props} />
      {hint ? <Text style={[s.muted, { marginTop: 4 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string | number>({ label, options, value, onChange, allowNone }: {
  label?: string; options: { value: T; label: string }[]; value: T | null;
  onChange: (v: T | null) => void; allowNone?: boolean;
}) {
  return (
    <View style={{ marginBottom: gap }}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={s.chips}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(on && allowNone ? null : o.value)}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[s.infoRow, { marginBottom: gap }]}>
      <Text style={s.body}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

/** Tarih seçici. value: "YYYY-MM-DD" ya da null */
export function DateField({ label, value, onChange, optional, maxToday = true }: {
  label: string; value: string | null; onChange: (v: string | null) => void; optional?: boolean; maxToday?: boolean;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const current = value ? fromIsoDate(value) : new Date();
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current, mode: 'date', maximumDate: maxToday ? new Date() : undefined,
        onChange: (event, d) => { if (event.type === 'set' && d) onChange(toIsoDate(d)); },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };
  return (
    <View style={{ marginBottom: gap }}>
      <Text style={s.label}>{label}</Text>
      <Row>
        <Pressable onPress={open} style={[s.input, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <Text style={[s.body, !value && { color: '#9AA096' }]}>{value ? fmtDate(value) : 'Tarih seçin'}</Text>
        </Pressable>
        {optional && value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable>
        )}
      </Row>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={current} mode="date" display="inline" maximumDate={maxToday ? new Date() : undefined}
          onChange={(_, d) => { if (d) onChange(toIsoDate(d)); }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------- stiller

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: 16 },
  pressed: { opacity: 0.75 },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: gap },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  h1: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 12 },
  infoLabel: { fontSize: 15, color: colors.muted },
  infoValue: { fontSize: 15, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius, padding: 14, marginBottom: gap },
  errorText: { color: colors.danger, fontSize: 15, flex: 1 },
  empty: { alignItems: 'center', padding: 32 },
  button: { minHeight: 48, borderRadius: radius, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  fab: { position: 'absolute', right: 20, bottom: 28, backgroundColor: colors.primary, borderRadius: 999, minWidth: 56, height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: radius, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 6 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  listTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text, minHeight: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 15, color: colors.text },
  chipTextOn: { color: '#fff', fontWeight: '700' },
});
