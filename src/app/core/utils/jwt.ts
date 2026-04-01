export function decodeJwtPayload<T = any>(token: string): T | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const json = base64UrlToUtf8(parts[1]);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function base64UrlToUtf8(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }

  // Fallback for older environments.
  let escaped = '';
  for (const b of bytes) escaped += `%${b.toString(16).padStart(2, '0')}`;
  return decodeURIComponent(escaped);
}

