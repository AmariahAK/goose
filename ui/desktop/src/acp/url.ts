export function httpOriginFromAcpWebSocketUrl(acpUrl: string): string {
  const url = new URL(acpUrl);

  if (url.protocol === 'ws:') {
    url.protocol = 'http:';
  } else if (url.protocol === 'wss:') {
    url.protocol = 'https:';
  } else {
    throw new Error(`ACP URL must use ws: or wss:, got ${url.protocol}`);
  }

  return url.origin;
}
