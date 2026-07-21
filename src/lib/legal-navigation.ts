import type { Href } from 'expo-router';
import type { LegalDocumentId } from '@/constants/legal';

export function legalDocumentHref(id: LegalDocumentId): Href {
  return `/legal/${id}` as Href;
}
