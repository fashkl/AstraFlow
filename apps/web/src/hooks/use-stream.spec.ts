/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useStream } from './use-stream';

// ---------------------------------------------------------------------------
// MockEventSource — replaces the browser global for tests.
// Exposes helpers to simulate server-sent events and connection errors.
// ---------------------------------------------------------------------------

type NamedEventHandler = (event: { data: string }) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  closed = false;
  onerror: ((e: Event) => void) | null = null;

  private handlers = new Map<string, NamedEventHandler[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: NamedEventHandler): void {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...existing, handler]);
  }

  close(): void {
    this.closed = true;
  }

  // Test helpers
  emit(event: string, data: string): void {
    this.handlers.get(event)?.forEach((h) => h({ data }));
  }

  triggerConnectionError(): void {
    this.onerror?.(new Event('error'));
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  MockEventSource.instances = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).EventSource = MockEventSource;
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (global as any).EventSource;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStream', () => {
  it('starts in idle state with empty output', () => {
    const { result } = renderHook(() => useStream());

    expect(result.current.status).toBe('idle');
    expect(result.current.output).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('accumulates tokens and transitions to done on stream completion', () => {
    const { result } = renderHook(() => useStream());

    act(() => {
      result.current.start('Hello');
    });

    expect(result.current.status).toBe('streaming');
    const es = MockEventSource.instances[0];
    expect(es.url).toContain('prompt=Hello');

    act(() => {
      es.emit('token', 'Hi');
      es.emit('token', ' there');
    });

    expect(result.current.output).toBe('Hi there');
    expect(result.current.status).toBe('streaming');

    act(() => {
      es.emit('done', '');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.output).toBe('Hi there');
    expect(es.closed).toBe(true);
  });

  it('abort closes the EventSource and resets status to idle', () => {
    const { result } = renderHook(() => useStream());

    act(() => {
      result.current.start('test prompt');
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('token', 'partial');
    });

    expect(result.current.status).toBe('streaming');

    act(() => {
      result.current.abort();
    });

    expect(result.current.status).toBe('idle');
    expect(es.closed).toBe(true);
  });

  it('sets error state and closes EventSource on server error event', () => {
    const { result } = renderHook(() => useStream());

    act(() => {
      result.current.start('test prompt');
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('error', 'LLM provider unavailable');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('LLM provider unavailable');
    expect(es.closed).toBe(true);
  });

  it('sets error state on connection-level failure (onerror)', () => {
    const { result } = renderHook(() => useStream());

    act(() => {
      result.current.start('test prompt');
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.triggerConnectionError();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Connection to stream failed');
    expect(es.closed).toBe(true);
  });

  it('onerror is ignored after stream is already resolved via done', () => {
    const { result } = renderHook(() => useStream());

    act(() => {
      result.current.start('test prompt');
    });

    const es = MockEventSource.instances[0];

    act(() => {
      es.emit('token', 'response');
      es.emit('done', '');
    });

    expect(result.current.status).toBe('done');

    // Simulate onerror firing after server closes the connection
    act(() => {
      es.triggerConnectionError();
    });

    // Status must not regress from done to error
    expect(result.current.status).toBe('done');
    expect(result.current.error).toBeNull();
  });

  it('starting a new stream closes the previous one', () => {
    const { result } = renderHook(() => useStream());

    act(() => {
      result.current.start('first');
    });

    const firstEs = MockEventSource.instances[0];
    expect(firstEs.closed).toBe(false);

    act(() => {
      result.current.start('second');
    });

    expect(firstEs.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(result.current.output).toBe('');
    expect(result.current.status).toBe('streaming');
  });

  it('closes the EventSource on unmount to prevent memory leaks', () => {
    const { result, unmount } = renderHook(() => useStream());

    act(() => {
      result.current.start('test prompt');
    });

    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);

    unmount();

    expect(es.closed).toBe(true);
  });
});
