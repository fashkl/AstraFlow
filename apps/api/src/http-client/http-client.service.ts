import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import CircuitBreaker from 'opossum';
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

interface HttpClientRequest {
  init?: RequestInit;
  url: string;
}

@Injectable()
export class HttpClientService implements OnModuleDestroy {
  private consecutiveFailureCount = 0;
  private readonly breaker: CircuitBreaker<[HttpClientRequest], Response>;

  constructor(
    @Inject(HTTP_CLIENT_CONFIG)
    private readonly config: HttpClientConfig = DEFAULT_HTTP_CLIENT_CONFIG,
    @Inject(HTTP_CLIENT_FETCH)
    private readonly fetchFn: HttpClientFetch,
    @Inject(HTTP_CLIENT_SLEEP)
    private readonly sleep: HttpClientSleep,
  ) {
    // The manual consecutive failure counter is the only open policy.
    // Opossum owns state transitions after open (open -> halfOpen -> close).
    this.breaker = new CircuitBreaker(this.executeRequestWithRetry.bind(this), {
      errorThresholdPercentage: 100,
      resetTimeout: this.config.resetTimeoutMs,
      volumeThreshold: Number.MAX_SAFE_INTEGER,
    });

    this.breaker.on('open', () => {
      this.consecutiveFailureCount = 0;
    });

    this.breaker.on('close', () => {
      this.consecutiveFailureCount = 0;
    });
  }

  async getJson<T>(url: string, init?: RequestInit): Promise<T> {
    try {
      const response = await this.breaker.fire({
        init: { ...init, method: init?.method ?? 'GET' },
        url,
      });
      this.consecutiveFailureCount = 0;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof RetryExhaustedError) {
        this.handleOperationFailure();
        throw error;
      }

      if (this.breaker.opened) {
        throw new CircuitOpenError(undefined, error);
      }

      throw error;
    }
  }

  onModuleDestroy(): void {
    this.breaker.shutdown();
  }

  private async executeRequestWithRetry({ url, init }: HttpClientRequest): Promise<Response> {
    const totalAttempts = this.config.retryDelaysMs.length + 1;

    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await this.fetchFn(url, init);
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response;
      } catch (error) {
        if (attempt >= totalAttempts - 1) {
          throw new RetryExhaustedError(totalAttempts, error);
        }

        const delayMs = this.getRetryDelayMs(this.config.retryDelaysMs[attempt] ?? 0);
        await this.sleep(delayMs);
      }
    }
  }

  private getRetryDelayMs(baseDelayMs: number): number {
    if (baseDelayMs <= 0) {
      return 0;
    }

    if (this.config.retryJitterRatio <= 0) {
      return baseDelayMs;
    }

    const jitterMultiplier = 1 + (Math.random() * 2 - 1) * this.config.retryJitterRatio;
    return Math.max(0, Math.round(baseDelayMs * jitterMultiplier));
  }

  private handleOperationFailure(): void {
    // Failed half-open probes reopen the circuit via opossum lifecycle;
    // keep manual counter aligned with the open state.
    if (this.breaker.opened) {
      this.consecutiveFailureCount = 0;
      return;
    }

    this.consecutiveFailureCount += 1;
    if (this.consecutiveFailureCount >= this.config.failureThreshold) {
      this.consecutiveFailureCount = 0;
      this.breaker.open();
    }
  }
}
