import type {
  AnimalLocation, AnimalSex, AnimalStatus, MemberRole, OperationType, OwnershipType, TreatmentType,
} from './types';

// Ekranda gösterilen Türkçe karşılıklar

export const roleLabel: Record<MemberRole, string> = {
  owner: 'Sahip', manager: 'Yönetici', shepherd: 'Çoban', viewer: 'İzleyici',
};

export const sexLabel: Record<AnimalSex, string> = {
  female: 'Dişi', male: 'Erkek', unknown: 'Bilinmiyor',
};

export const statusLabel: Record<AnimalStatus, string> = {
  active: 'Aktif', sold: 'Satıldı', dead: 'Öldü', slaughtered: 'Kesildi', lost: 'Kayıp',
};

export const treatmentLabel: Record<TreatmentType, string> = {
  medication: 'İlaç', injection: 'İğne', vaccine: 'Aşı',
  antiparasitic: 'Parazit', vitamin: 'Vitamin', other: 'Diğer',
};

export const locationLabel: Record<AnimalLocation, string> = {
  pasture: 'Merada', barn: 'Ahırda', other: 'Diğer',
};

export const speciesIcon: Record<number, string> = {
  1: '🐕', 2: '🫏', 3: '🐄', 4: '🐐', 5: '🐑',
};

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}


export const ownershipLabel: Record<OwnershipType, string> = {
  owned: 'Tam mülk', shared: 'Hisseli', leasedIn: 'Kiracı', sharecropped: 'Ortakçı', other: 'Diğer',
};

export const operationLabel: Record<OperationType, string> = {
  tillage: 'Sürüm', sowing: 'Ekim', fertilizing: 'Gübre', spraying: 'İlaçlama',
  irrigation: 'Sulama', harvest: 'Hasat', other: 'Diğer',
};

export const operationIcon: Record<OperationType, string> = {
  tillage: '🚜', sowing: '🌱', fertilizing: '🧪', spraying: '💦', irrigation: '🚿', harvest: '🌾', other: '📝',
};

/** 12500 m² → "12,5 dekar" */
export function fmtArea(m2: number | null | undefined): string {
  if (m2 == null) return 'Alan bilinmiyor';
  const d = m2 / 1000;
  return `${d.toLocaleString('tr-TR', { maximumFractionDigits: d < 10 ? 2 : 1 })} dekar`;
}

export function parcelTitle(p: { nickname: string | null; neighborhood: string; blockNo: number; parcelNo: number }) {
  const no = `${p.blockNo}/${p.parcelNo}`;
  return p.nickname ? `${p.nickname} (${no})` : `${p.neighborhood} ${no}`;
}
