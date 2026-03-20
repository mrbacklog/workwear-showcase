'use client';

const IMAGE_BASE_URL = 'https://api.databiz.app/api/v1/distribution/showcase/image';

export function getOriginalImageUrl(ean: string, seq: number): string {
  return `${IMAGE_BASE_URL}/${ean}/${seq}?size=original`;
}

export function useImageUrl() {
  return { getOriginalImageUrl };
}
