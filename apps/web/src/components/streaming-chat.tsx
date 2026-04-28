import { type FormEvent, useState } from 'react';
import { useStream } from '../hooks/use-stream';

export function StreamingChat() {
  const [prompt, setPrompt] = useState('');
  const { abort, error, output, start, status } = useStream();
  const isStreaming = status === 'streaming';

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (trimmed) {
      start(trimmed);
    }
  }

  return (
    <section className="stream-panel">
      <h2 className="stream-heading">LLM Stream</h2>

      <form className="stream-form" onSubmit={handleSubmit}>
        <textarea
          className="stream-textarea"
          disabled={isStreaming}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              const trimmed = prompt.trim();
              if (trimmed && !isStreaming) start(trimmed);
            }
          }}
          placeholder="Ask anything… (⌘ Enter to send)"
          rows={4}
          value={prompt}
        />

        <div className="stream-footer">
          <span className="stream-hint">
            {isStreaming ? (
              <span className="stream-indicator">
                <span className="stream-dot" />
                Streaming…
              </span>
            ) : (
              `${prompt.length} chars`
            )}
          </span>

          <div className="stream-actions">
            {isStreaming ? (
              <button className="btn-abort" onClick={abort} type="button">
                Stop
              </button>
            ) : (
              <button className="btn-send" disabled={!prompt.trim()} type="submit">
                Send
              </button>
            )}
          </div>
        </div>
      </form>

      {error ? (
        <p className="status status-error stream-status">{error}</p>
      ) : null}

      {output || isStreaming ? (
        <div className="stream-output-wrap">
          <pre className="stream-output">
            {output}
            {isStreaming ? <span className="stream-cursor" aria-hidden="true" /> : null}
          </pre>
        </div>
      ) : status === 'done' && !output ? (
        <p className="status stream-status">No response received.</p>
      ) : null}
    </section>
  );
}
