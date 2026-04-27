export interface HttpClientConfig {
  // Number of consecutive failed operations required to force the circuit open.
  failureThreshold: number;
  resetTimeoutMs: number;
  retryDelaysMs: number[];
  retryJitterRatio: number;
}

export type HttpClientFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type HttpClientSleep = (ms: number) => Promise<void>;

export const DEFAULT_HTTP_CLIENT_CONFIG: HttpClientConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 10_000,
  retryDelaysMs: [200, 400, 800],
  retryJitterRatio: 0.2,
};

export const HTTP_CLIENT_CONFIG = Symbol('HTTP_CLIENT_CONFIG');
export const HTTP_CLIENT_FETCH = Symbol('HTTP_CLIENT_FETCH');
export const HTTP_CLIENT_SLEEP = Symbol('HTTP_CLIENT_SLEEP');
