export interface CheckServerStatusOptions {
  onEvent?: (name: string, details?: Record<string, unknown>) => void;
}

export interface CheckBackendStatusParams {
  baseUrl: string;
  serverSecret: string;
  fetch: typeof globalThis.fetch;
  errorLog?: string[];
  options?: CheckServerStatusOptions;
}

export const isFatalError = (line: string): boolean => {
  const fatalPatterns = [/panicked at/, /RUST_BACKTRACE/, /fatal error/i];
  return fatalPatterns.some((pattern) => pattern.test(line));
};

const statusUrlFromBase = (baseUrl: string): string => {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/status`;
  url.search = '';
  url.hash = '';
  return url.toString();
};

export const checkBackendStatus = async ({
  baseUrl,
  serverSecret,
  fetch,
  errorLog = [],
  options = {},
}: CheckBackendStatusParams): Promise<boolean> => {
  const timeout = 30000;
  const interval = 100;
  const maxAttempts = Math.ceil(timeout / interval);
  const statusUrl = statusUrlFromBase(baseUrl);
  options.onEvent?.('healthcheck_start', { timeoutMs: timeout, intervalMs: interval });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (errorLog.some(isFatalError)) {
      options.onEvent?.('healthcheck_fatal_error', { attempt });
      return false;
    }

    try {
      const response = await fetch(statusUrl, {
        headers: {
          'X-Secret-Key': serverSecret,
        },
      });
      if (response.ok) {
        options.onEvent?.('healthcheck_success', { attempt });
        return true;
      }
    } catch {
      // Retry until the backend is ready or the timeout expires.
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  options.onEvent?.('healthcheck_timeout', { timeoutMs: timeout });
  return false;
};
