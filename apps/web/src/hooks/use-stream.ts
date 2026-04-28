import { useCallback, useEffect, useRef, useState } from 'react';

export type StreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface UseStreamResult {
  abort: () => void;
  error: string | null;
  output: string;
  start: (prompt: string) => void;
  status: StreamStatus;
}

export function useStream(): UseStreamResult {
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // Held in a ref so event handlers always reference the current ES instance
  // without the functions needing to be recreated on each render.
  const esRef = useRef<EventSource | null>(null);

  const abort = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setStatus('idle');
  }, []);

  const start = useCallback((prompt: string) => {
    // Close any in-flight stream before starting a new one.
    esRef.current?.close();
    esRef.current = null;

    setOutput('');
    setError(null);
    setStatus('streaming');

    const url = `/api/llm/stream?${new URLSearchParams({ prompt }).toString()}`;
    const es = new EventSource(url);
    esRef.current = es;

    // Named SSE events emitted by LlmController.writeSseEvent()
    es.addEventListener('token', (e: MessageEvent<string>) => {
      setOutput((prev) => prev + e.data);
    });

    es.addEventListener('done', () => {
      setStatus('done');
      es.close();
      esRef.current = null;
    });

    es.addEventListener('error', (e: MessageEvent<string>) => {
      setError(e.data || 'Stream failed');
      setStatus('error');
      es.close();
      esRef.current = null;
    });

    // Connection-level failure (network drop, server crash).
    // Guard against firing after the stream was already resolved via done/error/abort.
    es.onerror = () => {
      if (esRef.current !== es) return;
      setError('Connection to stream failed');
      setStatus('error');
      es.close();
      esRef.current = null;
    };
  }, []);

  // Ensure no dangling EventSource if the component unmounts mid-stream.
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  return { abort, error, output, start, status };
}
