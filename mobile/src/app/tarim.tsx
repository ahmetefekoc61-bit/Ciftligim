import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Body, Card, ErrorBox, H1, Loading, Muted, Row, Screen, Section, Tile } from '@/components/ui';
import { fmtNumber } from '@/lib/format';
import { fmtArea } from '@/lib/labels';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { ParcelSummary } from '@/lib/types';

export default function Tarim() {
  const farmId = useFarmId();
  const { canManage } = useSession();
  const q = useQuery<ParcelSummary>(farmId ? `/api/farms/${farmId}/parcels/summary` : null);
  const d = q.data;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : d && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Muted>Toplam arazi</Muted>
              <H1>{fmtArea(d.totalAreaM2)}</H1>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Badge text={`${d.parcelCount} tarla`} tone="green" />
              {d.leasedAreaM2 > 0 && <Badge text={`Kira/ortak: ${fmtArea(d.leasedAreaM2)}`} tone="amber" />}
            </View>
          </Row>
          {d.cropsThisYear.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Muted>{d.year} ekimi</Muted>
              {d.cropsThisYear.map((c) => (
                <Body key={c.cropName}>🌾 {c.cropName}: <Body style={{ fontWeight: '700' }}>{fmtArea(c.areaM2)}</Body> ({c.parcelCount} tarla)</Body>
              ))}
            </View>
          )}
          {d.operationCostThisYear > 0 && (
            <Muted style={{ marginTop: 8 }}>Bu yıl işlem masrafı: {fmtNumber(d.operationCostThisYear, 0)} TL</Muted>
          )}
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Tile icon="grid" title="Tarlalar" subtitle="Liste, ekim, işlemler" onPress={() => router.push('/tarlalar')} tone="amber" />
        <Tile icon="map" title="Harita" subtitle="Uydu görüntüsü, parsel bul" onPress={() => router.push('/harita')} tone="blue" />
        {canManage && <Tile icon="add-circle" title="Tarla ekle" subtitle="TKGM'den ada/parsel ile" onPress={() => router.push('/tarla/form')} />}
      </View>

      <Section title="Bilgi">
        <Card>
          <Muted>
            Parsel bilgileri TKGM Parsel Sorgu'dan alınır. Bu resmi bir hizmet değildir; TKGM erişimi değiştirirse bilgiler elle girilebilir.
          </Muted>
        </Card>
      </Section>
    </Screen>
  );
}
