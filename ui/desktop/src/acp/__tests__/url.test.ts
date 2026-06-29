import { describe, expect, it } from 'vitest';
import { httpBaseFromAcpWebSocketUrl } from '../url';

describe('httpBaseFromAcpWebSocketUrl', () => {
  it('converts ws ACP URLs to HTTP bases', () => {
    expect(httpBaseFromAcpWebSocketUrl('ws://127.0.0.1:64027/acp?token=secret')).toBe(
      'http://127.0.0.1:64027'
    );
  });

  it('converts wss ACP URLs to HTTPS bases', () => {
    expect(httpBaseFromAcpWebSocketUrl('wss://example.com/acp?token=secret')).toBe(
      'https://example.com'
    );
  });

  it('preserves path prefixes before the ACP endpoint', () => {
    expect(httpBaseFromAcpWebSocketUrl('wss://example.com/goose/acp?token=secret')).toBe(
      'https://example.com/goose'
    );
  });

  it('rejects non-WebSocket URLs', () => {
    expect(() => httpBaseFromAcpWebSocketUrl('http://127.0.0.1:64027/acp')).toThrow(
      'ACP URL must use ws: or wss:'
    );
  });
});
