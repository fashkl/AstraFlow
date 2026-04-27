import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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
  private readonly logger = new Logger(HttpClientService.name);
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
      this.logger.warn('Circuit transitioned to OPEN');
    });

    this.breaker.on('halfOpen', () => {
      this.logger.log('Circuit transitioned to HALF_OPEN');
    });

    this.breaker.on('close', () => {
      this.consecutiveFailureCount = 0;
      this.logger.log('Circuit transitioned to CLOSED');
    });
  }

  async getJson<T>(url: string, init?: RequestInit): Promise<T> {
    const method = init?.method ?? 'GET';
    this.logger.debug(`Dispatching request method=${method} url=${url}`);

    try {
      const response = await this.breaker.fire({
        init: { ...init, method },
        url,
      });
      this.consecutiveFailureCount = 0;
      this.logger.debug(`Request succeeded method=${method} url=${url} status=${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof RetryExhaustedError) {
        this.handleOperationFailure();
        this.logger.warn(
          `Request exhausted retries method=${method} url=${url} error=${this.describeError(error.cause)}`,
        );
        throw error;
      }

      if (this.breaker.opened) {
        this.logger.warn(`Request short-circuited by OPEN circuit method=${method} url=${url}`);
        throw new CircuitOpenError(undefined, error);
      }

      this.logger.error(
        `Request failed unexpectedly method=${method} url=${url} error=${this.describeError(error)}`,
      );
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.logger.log('Shutting down circuit breaker');
    this.breaker.shutdown();
  }

  private async executeRequestWithRetry({ url, init }: HttpClientRequest): Promise<Response> {
    const totalAttempts = this.config.retryDelaysMs.length + 1;

    for (let attempt = 0; ; attempt += 1) {
      const attemptNumber = attempt + 1;
      this.logger.debug(`HTTP attempt ${attemptNumber}/${totalAttempts} for url=${url}`);
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
        this.logger.warn(
          `Attempt ${attemptNumber} failed for url=${url}; retrying in ${delayMs}ms error=${this.describeError(error)}`,
        );
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
    this.logger.warn(
      `Consecutive failures ${this.consecutiveFailureCount}/${this.config.failureThreshold}`,
    );
    if (this.consecutiveFailureCount >= this.config.failureThreshold) {
      this.consecutiveFailureCount = 0;
      this.logger.warn('Failure threshold reached; opening circuit');
      this.breaker.open();
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }

    return String(error);
  }
}
