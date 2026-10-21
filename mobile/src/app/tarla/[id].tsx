import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { FarmMap } from '@/components/FarmMap';
import { WeatherCard } from '@/components/WeatherCard';
import {
  Badge, Body, Button, Card, Chips, Empty, ErrorBox, InfoRow, ListItem, Loading, Muted, Row, Screen, Section,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, fmtNumber } from '@/lib/format';
import { fmtArea, operationIcon, operationLabel, ownershipLabel, parcelTitle } from '@/lib/labels';
import { useFarmId } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { ParcelDetail } from '@/lib/types';

type Tab = 'seasons' | 'operations' | 'leases';

export default function TarlaDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const farmId = useFarmId();
  const base = `/api/farms/${farmId}/parcels/${id}`;
  const q = useQuery<ParcelDetail>(farmId && id ? base : null);
  const [tab, setTab] = useState<Tab>('seasons');
  const p = q.data;

  const del = (kind: string, rid: string) =>
    Alert.alert('Kaydı sil', 'Bu kayıt silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.del(`${base}/${kind}/${rid}`); void q.reload(); } catch (e) { Alert.alert('Silinemedi', errorMessage(e)); }
      } },
    ]);

  const deleteParcel = () =>
    Alert.alert('Tarlayı sil', 'Tarla ve tüm ekim/işlem/kira kayıtları silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.del(base); router.back(); } catch (e) { Alert.alert('Silinemedi', errorMessage(e)); }
      } },
    ]);

  if (q.loading) return <Screen><Loading /></Screen>;
  if (q.error || !p) return <Screen><ErrorBox message={q.error ?? 'Tarla bulunamadı.'} onRetry={q.reload} /></Screen>;

  const params = { parcelId: p.id, areaM2: p.areaM2 != null ? String(p.areaM2) : '' };
  const hasLocation = p.centerLat != null && p.centerLon != null;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      <Stack.Screen options={{ title: parcelTitle(p) }} />

      {(p.boundaryGeoJson || hasLocation) ? (
        <FarmMap
          parcels={[{ id: p.id, title: `${p.blockNo}/${p.parcelNo}`, geojson: p.boundaryGeoJson, lat: p.centerLat, lon: p.centerLon }]}
          focusId={p.id}
          style={{ marginBottom: 12 }}
        />
      ) : (
        <Card><Muted>Bu tarlanın harita sınırı yok. Düzenle → "TKGM'den getir" ile eklenebilir.</Muted></Card>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body style={{ fontWeight: '800', fontSize: 20, flex: 1 }}>{parcelTitle(p)}</Body>
          <Badge text={ownershipLabel[p.ownership]} tone={p.ownership === 'owned' ? 'green' : 'amber'} />
        </Row>
        <Muted>{p.province} / {p.district} / {p.neighborhood}</Muted>
        <InfoRow label="Ada / parsel" value={`${p.blockNo} / ${p.parcelNo}`} />
        <InfoRow label="Alan" value={`${fmtArea(p.areaM2)}${p.areaM2 ? ` (${fmtNumber(p.areaM2, 0)} m²)` : ''}`} />
        {p.locality && <InfoRow label="Mevki" value={p.locality} />}
        {p.quality && <InfoRow label="Nitelik" value={p.quality} />}
        {p.ownership === 'shared' && p.shareNumerator && <InfoRow label="Hisse" value={`${p.shareNumerator}/${p.shareDenominator}`} />}
        {p.titleOwner && <InfoRow label="Tapu maliki" value={p.titleOwner} />}
        {p.notes && <InfoRow label="Not" value={p.notes} />}
        {p.tkgmFetchedAt && <Muted style={{ marginTop: 6 }}>TKGM'den alındı: {fmtDate(p.tkgmFetchedAt)}</Muted>}
      </Card>

      {p.canEdit && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <Button title="Ekim / verim" icon="leaf" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/kayit/sezon', params })} />
          <Button title="İşlem ekle" icon="construct" variant="secondary" style={{ flexGrow: 1 }} onPress={() => router.push({ pathname: '/kayit/islem', params })} />
        </View>
      )}

      {hasLocation && (
        <Section title="Hava durumu">
          <WeatherCard lat={p.centerLat!} lon={p.centerLon!} />
        </Section>
      )}

      <Section title="Kayıtlar">
        <Chips
          options={[
            { value: 'seasons', label: `Ekim (${p.seasons.length})` },
            { value: 'operations', label: `İşlemler (${p.operations.length})` },
            { value: 'leases', label: `Kira (${p.leases.length})` },
          ]}
          value={tab}
          onChange={(v) => v && setTab(v)}
        />

        {tab === 'seasons' && (p.seasons.length === 0 ? <Empty icon="leaf-outline" title="Ekim kaydı yok" /> :
          p.seasons.map((s) => (
            <Card key={s.id} onPress={p.canEdit ? () => router.push({ pathname: '/kayit/sezon', params: { ...params, seasonId: s.id, data: JSON.stringify(s) } }) : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ fontWeight: '800' }}>{s.year} · {s.cropName}{s.variety ? ` (${s.variety})` : ''}</Body>
                {s.yieldKgPerDecare != null && <Badge text={`${fmtNumber(s.yieldKgPerDecare)} kg/da`} tone="green" />}
              </Row>
              {s.yieldKg != null && <Body>Verim: {fmtNumber(s.yieldKg, 0)} kg</Body>}
              {s.plantedAreaM2 != null && <Muted>Ekilen alan: {fmtArea(s.plantedAreaM2)}</Muted>}
              {(s.sowingDate || s.harvestDate) && <Muted>Ekim: {fmtDate(s.sowingDate)} · Hasat: {fmtDate(s.harvestDate)}</Muted>}
              {s.notes && <Muted>{s.notes}</Muted>}
              {p.canEdit && (
                <Row style={{ justifyContent: 'flex-end' }}>
                  <Button title="Sil" variant="ghost" style={{ minHeight: 32 }} onPress={() => del('seasons', s.id)} />
                </Row>
              )}
            </Card>
          )))}

        {tab === 'operations' && (p.operations.length === 0 ? <Empty icon="construct-outline" title="İşlem kaydı yok" /> :
          p.operations.map((o) => (
            <ListItem
              key={o.id}
              left={<Body style={{ fontSize: 24 }}>{operationIcon[o.type]}</Body>}
              title={`${operationLabel[o.type]}${o.product ? ` · ${o.product}` : ''}`}
              subtitle={[
                fmtDate(o.performedOn),
                o.quantity != null ? `${fmtNumber(o.quantity, 2)} ${o.unit ?? ''}` : null,
                o.cost != null ? `${fmtNumber(o.cost, 0)} TL` : null,
                o.description,
              ].filter(Boolean).join(' · ')}
              right={p.canEdit ? <Button title="Sil" variant="ghost" style={{ minHeight: 32 }} onPress={() => del('operations', o.id)} /> : <View />}
            />
          )))}

        {tab === 'leases' && (
          <>
            {p.leases.length === 0 ? <Empty icon="document-text-outline" title="Sözleşme yok" /> :
              p.leases.map((l) => (
                <Card key={l.id} onPress={p.canEdit ? () => router.push({ pathname: '/kayit/kira', params: { parcelId: p.id, leaseId: l.id, data: JSON.stringify(l) } }) : undefined}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body style={{ fontWeight: '700' }}>{l.counterparty}</Body>
                    <Badge text={l.active ? 'Geçerli' : 'Bitti'} tone={l.active ? 'green' : 'neutral'} />
                  </Row>
                  <Muted>{fmtDate(l.startDate)} – {l.endDate ? fmtDate(l.endDate) : 'süresiz'}</Muted>
                  {l.terms && <Body>{l.terms}</Body>}
                  {l.amount != null && <Body>{fmtNumber(l.amount, 0)} TL</Body>}
                  {p.canEdit && <Row style={{ justifyContent: 'flex-end' }}><Button title="Sil" variant="ghost" style={{ minHeight: 32 }} onPress={() => del('leases', l.id)} /></Row>}
                </Card>
              ))}
            {p.canEdit && <Button title="Sözleşme ekle" icon="add" variant="secondary" onPress={() => router.push({ pathname: '/kayit/kira', params: { parcelId: p.id } })} />}
          </>
        )}
      </Section>

      {p.canEdit && (
        <Section title="Yönetim">
          <View style={{ gap: 8 }}>
            <Button title="Tarlayı düzenle" icon="create-outline" variant="secondary" onPress={() => router.push({ pathname: '/tarla/form', params: { id: p.id } })} />
            <Button title="Tarlayı sil" icon="trash-outline" variant="danger" onPress={deleteParcel} />
          </View>
        </Section>
      )}
    </Screen>
  );
}
