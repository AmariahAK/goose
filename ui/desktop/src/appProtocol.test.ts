import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PACKAGED_RENDERER_ORIGIN,
  packagedRendererUrl,
  rendererContentType,
  resolvePackagedRendererPath,
} from './appProtocol';

describe('appProtocol', () => {
  it('uses the packaged renderer app origin', () => {
    expect(PACKAGED_RENDERER_ORIGIN).toBe('goose-app://goose');
    expect(packagedRendererUrl().toString()).toBe('goose-app://goose/index.html');
  });

  it('resolves packaged renderer asset paths under the renderer root', () => {
    const root = path.resolve('/tmp/goose-renderer');

    expect(resolvePackagedRendererPath('goose-app://goose/', root)).toBe(
      path.join(root, 'index.html')
    );
    expect(resolvePackagedRendererPath('goose-app://goose/assets/index.js', root)).toBe(
      path.join(root, 'assets', 'index.js')
    );
  });

  it('rejects non-renderer URLs and path traversal', () => {
    const root = path.resolve('/tmp/goose-renderer');

    expect(resolvePackagedRendererPath('https://goose/index.html', root)).toBeNull();
    expect(resolvePackagedRendererPath('goose-app://other/index.html', root)).toBeNull();
    expect(resolvePackagedRendererPath('goose-app://goose/%2e%2e/settings.json', root)).toBeNull();
    expect(
      resolvePackagedRendererPath('goose-app://goose/assets%5C..%5Csettings.json', root)
    ).toBeNull();
  });

  it('returns content types for renderer assets', () => {
    expect(rendererContentType('/tmp/index.html')).toBe('text/html; charset=utf-8');
    expect(rendererContentType('/tmp/assets/index.js')).toBe('text/javascript; charset=utf-8');
    expect(rendererContentType('/tmp/assets/index.css')).toBe('text/css; charset=utf-8');
    expect(rendererContentType('/tmp/assets/font.woff2')).toBe('font/woff2');
    expect(rendererContentType('/tmp/assets/file.bin')).toBe('application/octet-stream');
  });
});
