export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN';

  constructor(message = 'Circuit breaker is open', readonly cause?: unknown) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class RetryExhaustedError extends Error {
  readonly code = 'RETRY_EXHAUSTED';

  constructor(readonly attempts: number, readonly cause?: unknown) {
    super(`Request failed after ${attempts} attempts`);
    this.name = 'RetryExhaustedError';
  }
}
