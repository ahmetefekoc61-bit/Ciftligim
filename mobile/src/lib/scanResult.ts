// Küpe okuma ekranı "seçim" modunda açıldığında (ör. hayvan ekleme formundan),
// okunan numarayı forma geri taşımak için basit bir ara bellek.
let pending: string | null = null;

export function setScannedTag(tag: string) { pending = tag; }

/** Bekleyen numarayı alır ve temizler */
export function takeScannedTag(): string | null {
  const t = pending;
  pending = null;
  return t;
}
