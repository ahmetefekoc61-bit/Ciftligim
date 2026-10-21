import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { getForecast, farmWarnings, weatherText, type Forecast } from '@/lib/weather';
import { colors } from './theme';
import { Body, Card, Loading, Muted, Row } from './ui';

const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export function WeatherCard({ lat, lon }: { lat: number; lon: number }) {
  const [data, setData] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getForecast(lat, lon)
      .then((f) => { if (alive) setData(f); })
      .catch(() => { if (alive) setError('Hava durumu alınamadı (internet bağlantısını kontrol et).'); });
    return () => { alive = false; };
  }, [lat, lon]);

  if (error) return <Card><Muted>{error}</Muted></Card>;
  if (!data) return <Card><Loading /></Card>;

  const warnings = farmWarnings(data.days);
  return (
    <Card>
      {data.current && (
        <Row style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 34 }}>{weatherText(data.current.code).icon}</Text>
          <View>
            <Body style={{ fontWeight: '800', fontSize: 22 }}>{Math.round(data.current.temp)}°C</Body>
            <Muted>{weatherText(data.current.code).text} · rüzgâr {Math.round(data.current.windKmh)} km/s</Muted>
          </View>
        </Row>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Row style={{ gap: 14 }}>
          {data.days.map((d, i) => {
            const date = new Date(d.date);
            return (
              <View key={d.date} style={{ alignItems: 'center', minWidth: 52 }}>
                <Muted>{i === 0 ? 'Bugün' : dayNames[date.getDay()]}</Muted>
                <Text style={{ fontSize: 22 }}>{weatherText(d.code).icon}</Text>
                <Body style={{ fontWeight: '700' }}>{Math.round(d.tMax)}°</Body>
                <Muted>{Math.round(d.tMin)}°</Muted>
                {d.rainMm >= 0.5 && <Text style={{ color: colors.info, fontSize: 12 }}>{d.rainMm.toFixed(0)} mm</Text>}
              </View>
            );
          })}
        </Row>
      </ScrollView>
      {warnings.map((w) => (
        <Body key={w} style={{ marginTop: 8, color: '#7A5313' }}>⚠️ {w}</Body>
      ))}
      <Muted style={{ marginTop: 8, fontSize: 11 }}>Kaynak: Open-Meteo</Muted>
    </Card>
  );
}
