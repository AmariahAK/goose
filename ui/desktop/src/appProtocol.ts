import path from 'node:path';

export const PACKAGED_RENDERER_PROTOCOL = 'goose-app';
export const PACKAGED_RENDERER_HOST = 'goose';
export const PACKAGED_RENDERER_ORIGIN = `${PACKAGED_RENDERER_PROTOCOL}://${PACKAGED_RENDERER_HOST}`;
export const GOOSE_SESSION_PARTITION = 'persist:goose';

export function packagedRendererUrl(): URL {
  return new URL(`${PACKAGED_RENDERER_ORIGIN}/index.html`);
}

function containsTraversalSegment(requestUrl: string): boolean {
  return /(?:^|\/|%2f|\\|%5c)(?:\.\.|%2e%2e)(?:$|\/|%2f|\\|%5c|\?|#)/i.test(requestUrl);
}

export function resolvePackagedRendererPath(
  requestUrl: string,
  rendererRoot: string
): string | null {
  if (containsTraversalSegment(requestUrl)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== `${PACKAGED_RENDERER_PROTOCOL}:` ||
    url.hostname !== PACKAGED_RENDERER_HOST
  ) {
    return null;
  }

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('\0') || relativePath.includes('\\')) {
    return null;
  }

  const root = path.resolve(rendererRoot);
  const resolvedPath = path.resolve(root, relativePath);
  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

export function rendererContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.wasm':
      return 'application/wasm';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}
