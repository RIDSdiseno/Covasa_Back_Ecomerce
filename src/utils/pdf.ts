import type { PDFFont } from 'pdf-lib';

type ImagePayload = {
  bytes: Uint8Array;
  contentType?: string;
};

const IMAGE_CACHE = new Map<string, ImagePayload | null>();

export const formatCurrencyCLP = (value: number) => `$ ${Math.round(value).toLocaleString('es-CL')}`;

export const formatDateCL = (value?: string | Date | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const wrapText = (text: string, maxWidth: number, font: PDFFont, size: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
};

export const fetchImageBytes = async (
  url: string,
  options?: { maxBytes?: number; timeoutMs?: number }
): Promise<ImagePayload | null> => {
  const maxBytes = options?.maxBytes ?? 1_500_000;
  const timeoutMs = options?.timeoutMs ?? 7000;

  if (IMAGE_CACHE.has(url)) {
    return IMAGE_CACHE.get(url) ?? null;
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'force-cache',
    });

    window.clearTimeout(timeout);

    if (!response.ok) {
      IMAGE_CACHE.set(url, null);
      return null;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
      IMAGE_CACHE.set(url, null);
      return null;
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      IMAGE_CACHE.set(url, null);
      return null;
    }

    const payload: ImagePayload = {
      bytes: buffer,
      contentType: response.headers.get('content-type') ?? undefined,
    };
    IMAGE_CACHE.set(url, payload);
    return payload;
  } catch {
    IMAGE_CACHE.set(url, null);
    return null;
  }
};
