import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Card, ErrorBox, H1, ListItem, Loading, Muted, Row, Screen, Section, Tile, Body } from '@/components/ui';
import { colors } from '@/components/theme';
import { fmtDate } from '@/lib/format';
import { speciesIcon } from '@/lib/labels';
import { useFarmId, useSession } from '@/lib/session';
import { useQuery } from '@/lib/useQuery';
import type { FarmSummary } from '@/lib/types';

export default function Hayvancilik() {
  const farmId = useFarmId();
  const { canManage, canWrite } = useSession();
  const q = useQuery<FarmSummary>(farmId ? `/api/farms/${farmId}/summary` : null);
  const d = q.data;

  return (
    <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? <Loading /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : d && (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Muted>Aktif hayvan</Muted>
                <H1>{d.activeAnimals}</H1>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge text={`${d.herdCount} sürü`} tone="green" />
                {d.inWithdrawal > 0 && <Badge text={`${d.inWithdrawal} arınmada`} tone="amber" />}
                {d.birthsLast30Days > 0 && <Badge text={`30 günde ${d.birthsLast30Days} doğum`} tone="blue" />}
              </View>
            </Row>
            {d.bySpecies.length > 0 && (
              <Row style={{ flexWrap: 'wrap', marginTop: 12, gap: 12 }}>
                {d.bySpecies.map((sp) => (
                  <Body key={sp.speciesId}>{speciesIcon[sp.speciesId] ?? '🐾'} {sp.speciesName}: <Body style={{ fontWeight: '700' }}>{sp.count}</Body></Body>
                ))}
              </Row>
            )}
          </Card>
        </>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Tile icon="paw" title="Hayvanlar" subtitle="Liste, arama, profil" onPress={() => router.push('/hayvanlar')} />
        <Tile icon="scan" title="Küpe okut" subtitle="Kamerayla hayvanı bul" onPress={() => router.push('/tara')} tone="blue" />
        <Tile icon="albums" title="Sürüler" subtitle="Sürü ve çoban ataması" onPress={() => router.push('/suruler')} />
        {canWrite && <Tile icon="medkit" title="Toplu işlem" subtitle="Sürüye aşı/ilaç, meraya çıkış" onPress={() => router.push('/toplu')} tone="amber" />}
        <Tile icon="warning" title="Arınma" subtitle="Kesilemez / sütü satılamaz" onPress={() => router.push('/arinma')} tone="amber" />
        <Tile icon="flask" title="İlaçlar" subtitle="Katalog ve arınma süreleri" onPress={() => router.push('/ilaclar')} tone="blue" />
        <Tile icon="people" title="Üyeler" subtitle={canManage ? 'Çoban ve yönetici ekle' : 'İşletme üyeleri'} onPress={() => router.push('/uyeler')} />
        {canManage && <Tile icon="add-circle" title="Hayvan ekle" subtitle="Yeni hayvan kartı" onPress={() => router.push('/hayvan/form')} />}
      </View>

      {d && d.recentBirths.length > 0 && (
        <Section title="Son doğumlar">
          {d.recentBirths.map((b, i) => (
            <ListItem
              key={`${b.motherId}-${i}`}
              title={`${b.motherEarTag ?? b.motherName ?? 'Anne'} — ${b.offspringCount} yavru`}
              subtitle={fmtDate(b.birthDate)}
              left={<Body style={{ fontSize: 22 }}>🍼</Body>}
              onPress={() => router.push({ pathname: '/hayvan/[id]', params: { id: b.motherId } })}
            />
          ))}
        </Section>
      )}
      <Muted style={{ textAlign: 'center', marginTop: 16, color: colors.muted }}>Aşağı çekerek yenileyebilirsin.</Muted>
    </Screen>
  );
}
