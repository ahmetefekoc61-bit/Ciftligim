import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type OcrResult = { text: string; blocks: { text: string; lines: string[] }[] };

type Native = { recognize(uri: string): Promise<OcrResult> };

const native: Native | null = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('KupeOcr') : null;

export const ocrSupported = native != null;

export async function recognizeText(uri: string): Promise<OcrResult> {
  if (!native) throw new Error('Yazı okuma bu cihazda desteklenmiyor');
  const full = uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`;
  return native.recognize(full);
}
