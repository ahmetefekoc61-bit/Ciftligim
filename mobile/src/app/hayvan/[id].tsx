import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { animalTitle } from '@/components/AnimalRow';
import { colors } from '@/components/theme';
import {
  Badge, Body, Button, Card, Chips, Empty, ErrorBox, InfoRow, ListItem, Loading, Muted, Row, Screen, Section,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { daysUntil, fmtAge, fmtDate, fmtDateTime, fmtNumber } from '@/lib/format';
import { locationLabel, sexLabel, speciesIcon, statusLabel, treatmentLabel } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { AnimalDetail, AnimalHistory } from '@/lib/types';

type Tab = 'treatments' | 'weights' | 'locations' | 'births';

export default function HayvanDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = useFarmId();
  const base = `/api/farms/${farmId}/animals/${id}`;
  const animal = useQuery<AnimalDetail>(farmId && id ? base : null);
  const history = useQuery<AnimalHistory>(farmId && id ? `${base}/history` : null);
  const [tab, setTab] = useState<Tab>('treatments');

  const refresh = () => { void animal.refresh(); void history.reload(); };
  const a = animal.data;

  const removeRecord = (kind: string, recordId: string) =>
    Alert.alert('Kaydı sil', 'Bu kayıt silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try { await api.del(`${base}/${kind}/${recordId}`); refresh(); }
          catch (e) { Alert.alert('Silinemedi', errorMessage(e)); }
        },
      },
    ]);

  const restore = async () => {
    try { await api.post(`${base}/restore`); refresh(); }
    catch (e) { Alert.alert('Hata', errorMessage(e)); }
  };

  const deleteAnimal = () =>
    Alert.alert(
      'Hayvanı tamamen sil',
      'Bu yalnızca yanlış girilen kayıtlar içindir; tüm geçmişi de silinir. Satılan/ölen hayvan için "Sürüden çıkış" kullan.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive', onPress: async () => {
            try { await api.del(base); router.back(); }
            catch (e) { Alert.alert('Silinemedi', errorMessage(e)); }
          },
        },
      ]);

  if (animal.loading) return <Screen><Loading /></Screen>;
  if (animal.error || !a) return <Screen><ErrorBox message={animal.error ?? 'Hayvan bulunamadı.'} onRetry={animal.reload} /></Screen>;

  const h = history.data;
  const recordParams = { animalId: a.id, speciesId: String(a.speciesId) };

  return (
    <Screen refreshing={animal.refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: animalTitle(a) }} />

      {/* Kimlik kartı */}
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 44 }}>{speciesIcon[a.speciesId] ?? '🐾'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{animalTitle(a)}</Text>
            <Muted>{[a.breedName ?? a.speciesName, sexLabel[a.sex], fmtAge(a.ageMonths)].join(' · ')}</Muted>
            <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Badge text={statusLabel[a.status]} tone={a.status === 'active' ? 'green' : 'red'} />
              {a.currentLocation && <Badge text={locationLabel[a.currentLocation]} tone="blue" />}
              {a.herdName && <Badge text={a.herdName} />}
            </Row>
          </View>
        </Row>
      </Card>

      {/* Arınma uyarısı */}
      {(a.meatWithdrawalUntil || a.milkWithdrawalUntil) && (
        <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
          <Body style={{ fontWeight: '700' }}>⚠️ Arınma süresinde</Body>
          {a.meatWithdrawalUntil && <Body>Et: {fmtDate(a.meatWithdrawalUntil)} tarihine kadar kesilemez ({daysUntil(a.meatWithdrawalUntil)} gün)</Body>}
          {a.milkWithdrawalUntil && <Body>Süt: {fmtDate(a.milkWithdrawalUntil)} tarihine kadar satılamaz ({daysUntil(a.milkWithdrawalUntil)} gün)</Body>}
        </Card>
      )}

      {/* Hızlı kayıt */}
      {a.canAddRecords && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Button title="Aşı / İlaç" icon="medkit" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/kayit/tedavi', params: recordParams })} />
          <Button title="Tartım" icon="speedometer" variant="secondary" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/kayit/tartim', params: recordParams })} />
          <Button title="Konum" icon="location" variant="secondary" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/kayit/konum', params: recordParams })} />
          {a.sex === 'female' && (
            <Button title="Yavrulama" icon="heart" variant="secondary" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/kayit/yavrulama', params: recordParams })} />
          )}
        </View>
      )}

      {/* Bilgiler */}
      <Section title="Bilgiler">
        <Card>
          <InfoRow label="Küpe no" value={a.earTag ?? '—'} />
          <InfoRow label="Tür / ırk" value={`${a.speciesName}${a.breedName ? ` / ${a.breedName}` : ''}`} />
          <InfoRow label="Doğum tarihi" value={a.birthDate ? `${fmtDate(a.birthDate)}${a.birthDateEstimated ? ' (tahmini)' : ''}` : '—'} />
          <InfoRow label="Son tartım" value={a.lastWeightKg != null ? `${fmtNumber(a.lastWeightKg)} kg · ${fmtDate(a.lastWeighedOn)}` : '—'} />
          <InfoRow label="Konum" value={a.currentLocation ? `${locationLabel[a.currentLocation]} · ${fmtDate(a.locationSince)}` : '—'} />
          {a.microchip && <InfoRow label="Mikroçip" value={a.microchip} />}
          {a.colorMarks && <InfoRow label="Renk / işaret" value={a.colorMarks} />}
          {a.acquiredOn && <InfoRow label="Alış tarihi" value={fmtDate(a.acquiredOn)} />}
          {a.exitedOn && <InfoRow label="Çıkış tarihi" value={fmtDate(a.exitedOn)} />}
          {a.notes && <InfoRow label="Notlar" value={a.notes} />}
        </Card>
      </Section>

      {/* Soy */}
      {(a.mother || a.father || a.offspring.length > 0) && (
        <Section title="Soy">
          {a.mother && <ListItem title={`Anne: ${animalTitle(a.mother)}`} onPress={() => router.push({ pathname: '/hayvan/[id]', params: { id: a.mother!.id } })} />}
          {a.father && <ListItem title={`Baba: ${animalTitle(a.father)}`} onPress={() => router.push({ pathname: '/hayvan/[id]', params: { id: a.father!.id } })} />}
          {a.offspring.map((o) => (
            <ListItem key={o.id} title={`Yavru: ${animalTitle(o)}`} onPress={() => router.push({ pathname: '/hayvan/[id]', params: { id: o.id } })} />
          ))}
        </Section>
      )}

      {/* Geçmiş */}
      <Section title="Geçmiş">
        <Chips
          options={[
            { value: 'treatments', label: `Sağlık (${h?.treatments.length ?? 0})` },
            { value: 'weights', label: `Tartım (${h?.weights.length ?? 0})` },
            { value: 'locations', label: `Konum (${h?.locations.length ?? 0})` },
            ...(a.sex === 'female' ? [{ value: 'births' as Tab, label: `Doğum (${h?.births.length ?? 0})` }] : []),
          ]}
          value={tab}
          onChange={(v) => v && setTab(v)}
        />
        {history.loading ? <Loading /> : history.error ? <ErrorBox message={history.error} onRetry={history.reload} /> : h && (
          <>
            {tab === 'treatments' && (h.treatments.length === 0 ? <Empty icon="medkit-outline" title="Sağlık kaydı yok" /> :
              h.treatments.map((t) => (
                <Card key={t.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Badge text={treatmentLabel[t.type]} tone="blue" />
                    <Muted>{fmtDateTime(t.administeredAt)}</Muted>
                  </Row>
                  <Body style={{ fontWeight: '700', marginTop: 6 }}>
                    {t.title}{t.dose != null ? ` — ${fmtNumber(t.dose, 3)} ${t.doseUnit ?? ''}` : ''}
                  </Body>
                  {t.route && <Muted>Uygulama: {t.route}</Muted>}
                  {t.description && t.description !== t.title && <Body>{t.description}</Body>}
                  {t.meatWithdrawalUntil && <Muted>Et arınma: {fmtDate(t.meatWithdrawalUntil)}</Muted>}
                  {t.milkWithdrawalUntil && <Muted>Süt arınma: {fmtDate(t.milkWithdrawalUntil)}</Muted>}
                  <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                    <Muted>{t.batchId ? 'Toplu uygulama · ' : ''}{t.recordedByName}</Muted>
                    {t.canDelete && <Button title="Sil" variant="ghost" style={{ minHeight: 32 }} onPress={() => removeRecord('treatments', t.id)} />}
                  </Row>
                </Card>
              )))}
            {tab === 'weights' && (h.weights.length === 0 ? <Empty icon="speedometer-outline" title="Tartım kaydı yok" /> :
              h.weights.map((w, i) => {
                const prev = h.weights[i + 1];
                const diff = prev ? w.weightKg - prev.weightKg : null;
                return (
                  <ListItem
                    key={w.id}
                    title={`${fmtNumber(w.weightKg)} kg${diff != null ? `  (${diff >= 0 ? '+' : ''}${fmtNumber(diff)})` : ''}`}
                    subtitle={`${fmtDate(w.weighedOn)} · ${w.recordedByName}${w.notes ? ` · ${w.notes}` : ''}`}
                    right={w.canDelete ? <Button title="Sil" variant="ghost" style={{ minHeight: 32 }} onPress={() => removeRecord('weights', w.id)} /> : <View />}
                  />
                );
              }))}
            {tab === 'locations' && (h.locations.length === 0 ? <Empty icon="location-outline" title="Konum kaydı yok" /> :
              h.locations.map((l) => (
                <ListItem
                  key={l.id}
                  title={locationLabel[l.location]}
                  subtitle={`${fmtDateTime(l.since)} · ${l.recordedByName}${l.notes ? ` · ${l.notes}` : ''}`}
                  right={l.canDelete ? <Button title="Sil" variant="ghost" style={{ minHeight: 32 }} onPress={() => removeRecord('locations', l.id)} /> : <View />}
                />
              )))}
            {tab === 'births' && (h.births.length === 0 ? <Empty icon="heart-outline" title="Doğum kaydı yok" /> :
              h.births.map((b) => (
                <ListItem
                  key={b.id}
                  title={`${b.offspringCount} yavru${b.aliveCount != null ? ` (${b.aliveCount} canlı)` : ''}`}
                  subtitle={`${fmtDate(b.birthDate)}${b.difficulty ? ` · ${b.difficulty}` : ''} · ${b.recordedByName}${b.notes ? ` · ${b.notes}` : ''}`}
                  right={b.canDelete ? <Button title="Sil" variant="ghost" style={{ minHeight: 32 }} onPress={() => removeRecord('births', b.id)} /> : <View />}
                />
              )))}
          </>
        )}
      </Section>

      {/* Yönetim */}
      {a.canEdit && (
        <Section title="Yönetim">
          <View style={{ gap: 8 }}>
            <Button title="Bilgileri düzenle" icon="create-outline" variant="secondary" onPress={() => router.push({ pathname: '/hayvan/form', params: { id: a.id } })} />
            {a.status === 'active'
              ? <Button title="Sürüden çıkış (satış / ölüm / kesim)" icon="exit-outline" variant="secondary" onPress={() => router.push({ pathname: '/kayit/cikis', params: { animalId: a.id } })} />
              : <Button title="Çıkışı geri al (aktif yap)" icon="refresh" variant="secondary" onPress={restore} />}
            <Button title="Hayvanı sil (yanlış kayıt)" icon="trash-outline" variant="danger" onPress={deleteAnimal} />
          </View>
        </Section>
      )}
      <Muted style={{ marginTop: 16, textAlign: 'center' }}>Kayıt: {fmtDate(a.createdAt)}</Muted>
    </Screen>
  );
}
