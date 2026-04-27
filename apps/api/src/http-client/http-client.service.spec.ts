import { Test } from '@nestjs/testing';
import {
  DEFAULT_HTTP_CLIENT_CONFIG,
  HTTP_CLIENT_CONFIG,
  HTTP_CLIENT_FETCH,
  HTTP_CLIENT_SLEEP,
  type HttpClientConfig,
  type HttpClientFetch,
  type HttpClientSleep,
} from './http-client.constants';
import { CircuitOpenError, RetryExhaustedError } from './http-client.errors';
import { HttpClientService } from './http-client.service';

function buildResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

async function buildHttpClientService(params?: {
  config?: HttpClientConfig;
  fetchFn?: HttpClientFetch;
  sleepFn?: HttpClientSleep;
}): Promise<HttpClientService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      HttpClientService,
      {
        provide: HTTP_CLIENT_CONFIG,
        useValue: params?.config ?? DEFAULT_HTTP_CLIENT_CONFIG,
      },
      {
        provide: HTTP_CLIENT_FETCH,
        useValue:
          params?.fetchFn ??
          (async () => {
            throw new Error('fetch mock not configured');
          }),
      },
      {
        provide: HTTP_CLIENT_SLEEP,
        useValue: params?.sleepFn ?? (async () => undefined),
      },
    ],
  }).compile();

  return moduleRef.get(HttpClientService);
}

describe('HttpClientService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('opens after exactly failureThreshold consecutive failed operations', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('upstream unavailable');
    });

    const service = await buildHttpClientService({
      config: {
        failureThreshold: 5,
        resetTimeoutMs: 10_000,
        retryDelaysMs: [],
        retryJitterRatio: 0,
      },
      fetchFn,
      sleepFn: jest.fn(async () => undefined),
    });

    for (let i = 0; i < 5; i += 1) {
      await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
        RetryExhaustedError,
      );
    }

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  it('does not false-open under mixed traffic and only opens on consecutive failures', async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockResolvedValueOnce(buildResponse({ ok: true }))
      .mockRejectedValueOnce(new Error('f3'))
      .mockResolvedValueOnce(buildResponse({ ok: true }))
      .mockRejectedValueOnce(new Error('f4'))
      .mockRejectedValueOnce(new Error('f5'))
      .mockRejectedValueOnce(new Error('f6'));

    const service = await buildHttpClientService({
      config: {
        failureThreshold: 3,
        resetTimeoutMs: 10_000,
        retryDelaysMs: [],
        retryJitterRatio: 0,
      },
      fetchFn,
      sleepFn: jest.fn(async () => undefined),
    });

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    await expect(service.getJson('https://example.test/data')).resolves.toEqual({ ok: true });

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    await expect(service.getJson('https://example.test/data')).resolves.toEqual({ ok: true });

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  it('maps short-circuited breaker calls to CircuitOpenError', async () => {
    const fetchFn = jest.fn(async () => buildResponse({ ok: true }));

    const service = await buildHttpClientService({
      config: {
        failureThreshold: 5,
        resetTimeoutMs: 10_000,
        retryDelaysMs: [],
        retryJitterRatio: 0,
      },
      fetchFn,
      sleepFn: jest.fn(async () => undefined),
    });

    (service as unknown as { breaker: { open: () => void } }).breaker.open();

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('recovers from open to half-open to closed after resetTimeout on successful probe', async () => {
    jest.useFakeTimers();

    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('f1'))
      .mockRejectedValueOnce(new Error('f2'))
      .mockResolvedValueOnce(buildResponse({ ok: true }))
      .mockRejectedValueOnce(new Error('after-close-1'))
      .mockRejectedValueOnce(new Error('after-close-2'));

    const service = await buildHttpClientService({
      config: {
        failureThreshold: 2,
        resetTimeoutMs: 50,
        retryDelaysMs: [],
        retryJitterRatio: 0,
      },
      fetchFn,
      sleepFn: jest.fn(async () => undefined),
    });

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    jest.advanceTimersByTime(50);
    await Promise.resolve();

    await expect(service.getJson('https://example.test/data')).resolves.toEqual({ ok: true });

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      CircuitOpenError,
    );
  });

  it('retries with deterministic backoff when jitter is disabled', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('temporary upstream error');
    });
    const sleepFn = jest.fn(async () => undefined);

    const service = await buildHttpClientService({
      config: {
        failureThreshold: 50,
        resetTimeoutMs: 10_000,
        retryDelaysMs: [200, 400, 800],
        retryJitterRatio: 0,
      },
      fetchFn,
      sleepFn,
    });

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(sleepFn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenNthCalledWith(1, 200);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 400);
    expect(sleepFn).toHaveBeenNthCalledWith(3, 800);
  });

  it('applies bounded jitter to backoff delays when enabled', async () => {
    jest.spyOn(Math, 'random').mockReturnValueOnce(1).mockReturnValueOnce(0).mockReturnValueOnce(0.5);

    const fetchFn = jest.fn(async () => {
      throw new Error('temporary upstream error');
    });
    const sleepFn = jest.fn(async () => undefined);

    const service = await buildHttpClientService({
      config: {
        failureThreshold: 50,
        resetTimeoutMs: 10_000,
        retryDelaysMs: [100, 200, 300],
        retryJitterRatio: 0.2,
      },
      fetchFn,
      sleepFn,
    });

    await expect(service.getJson('https://example.test/data')).rejects.toBeInstanceOf(
      RetryExhaustedError,
    );

    expect(sleepFn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenNthCalledWith(1, 120);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 160);
    expect(sleepFn).toHaveBeenNthCalledWith(3, 300);

    const jitteredDelays = (sleepFn.mock.calls as unknown as Array<[number]>).map(
      (call) => call[0],
    );
    expect(jitteredDelays[0]).toBeGreaterThanOrEqual(80);
    expect(jitteredDelays[0]).toBeLessThanOrEqual(120);
    expect(jitteredDelays[1]).toBeGreaterThanOrEqual(160);
    expect(jitteredDelays[1]).toBeLessThanOrEqual(240);
    expect(jitteredDelays[2]).toBeGreaterThanOrEqual(240);
    expect(jitteredDelays[2]).toBeLessThanOrEqual(360);
  });

  it('shuts down the breaker on module destroy without throwing (idempotent)', async () => {
    const service = await buildHttpClientService({
      fetchFn: jest.fn(),
      sleepFn: jest.fn(async () => undefined),
    });

    expect(() => service.onModuleDestroy()).not.toThrow();
    expect(() => service.onModuleDestroy()).not.toThrow();
  });
});
