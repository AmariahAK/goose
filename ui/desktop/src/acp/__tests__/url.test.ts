import { describe, expect, it } from 'vitest';
import { httpOriginFromAcpWebSocketUrl } from '../url';

describe('httpOriginFromAcpWebSocketUrl', () => {
  it('converts ws ACP URLs to HTTP origins', () => {
    expect(httpOriginFromAcpWebSocketUrl('ws://127.0.0.1:64027/acp?token=secret')).toBe(
      'http://127.0.0.1:64027'
    );
  });

  it('converts wss ACP URLs to HTTPS origins', () => {
    expect(httpOriginFromAcpWebSocketUrl('wss://example.com/acp?token=secret')).toBe(
      'https://example.com'
    );
  });

  it('rejects non-WebSocket URLs', () => {
    expect(() => httpOriginFromAcpWebSocketUrl('http://127.0.0.1:64027/acp')).toThrow(
      'ACP URL must use ws: or wss:'
    );
  });
});
