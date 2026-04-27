# Interview Prep — Open Innovation AI (2026-04-28)

**Position:** Senior Full Stack Engineer  
**Interviewer:** Rashid Mahmood — Technical Lead | Agentic AI, RAG, LLMs  

---

## Interviewer Profile

- Specializes in **Agentic AI, RAG, LLMs, advanced reasoning**
- Active on GitHub + Hugging Face — practical builder, not just theorist
- Values **production-grade** implementations and **clear technical thinking**

## Job Key Signals

- **Node.js + TypeScript** backend
- **Streaming interfaces for LLMs** — core differentiator for this role
- **Data processing pipelines for large datasets**
- React + TypeScript frontend (secondary)
- Jest + Playwright testing

---

## High-Probability Problem Areas

1. **Async Concurrency** — task queue with concurrency limit
2. **LLM Streaming** — SSE/streaming endpoint proxying LLM output
3. **Data Pipeline / Batch Processing** — rate limiting, batching, transformation

---

## Problem 1 — Async Concurrency Limit (HIGH probability)

**Task:** Run N tasks but at most `limit` concurrently, preserving result order.

**Approach to say out loud:**
> "I'll spin up exactly `limit` worker coroutines. Each worker pulls the next task index atomically, executes it, stores the result by index, and loops until the queue is drained."

```typescript
async function asyncTasksWithConcurrencyLimit<T>(
    tasks: (() => Promise<T>)[],
    limit: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;

    async function worker() {
        while (index < tasks.length) {
            const current = index++;
            results[current] = await tasks[current]();
        }
    }

    const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
    await Promise.all(workers);
    return results;
}

// Test
const tasks = [
    () => Promise.resolve(1),
    () => new Promise<number>(r => setTimeout(() => r(2), 1000)),
    () => Promise.resolve(3),
];

asyncTasksWithConcurrencyLimit(tasks, 2).then(console.log); // [1, 2, 3]
```

**Edge cases to mention proactively:**
- `limit > tasks.length` — handled via `Math.min`
- Task throws — bubbles up; ask if `allSettled` semantics are needed
- Empty tasks array — returns `[]` correctly
- `limit = 0` — creates no workers; worth clarifying expected behavior

---

## Problem 2 — LLM Streaming Endpoint (HIGH probability)

**Task:** Build a Node.js/Express endpoint that streams LLM responses to the client via SSE.

**Approach to say out loud:**
> "Set `Content-Type: text/event-stream` headers, call the LLM with `stream: true`, forward each delta chunk as an SSE `data:` frame, close with a `[DONE]` sentinel."

```typescript
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const client = new Anthropic();

app.get('/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const stream = await client.messages.stream({
            model: 'claude-opus-4-6',
            max_tokens: 1024,
            messages: [{ role: 'user', content: req.query.prompt as string }],
        });

        // Abort stream if client disconnects
        req.on('close', () => stream.abort());

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
    } finally {
        res.end();
    }
});
```

**Edge cases to mention:**
- Client disconnect mid-stream → abort the upstream request
- Backpressure if client is slow to consume
- Token limits and retry logic on failure

---

## Problem 3 — Rate-Limited Batch Fetcher (MEDIUM probability)

**Task:** Fetch data for 1000 IDs from an API, max 10 requests/second.

**Approach to say out loud:**
> "Combine the concurrency pattern with a minimum delay between requests derived from the rate limit. Track elapsed time per request and sleep only the remaining window."

```typescript
async function batchFetch<T>(
    ids: string[],
    fetcher: (id: string) => Promise<T>,
    rateLimit: number = 10  // requests per second
): Promise<T[]> {
    const results: T[] = [];
    const delayMs = 1000 / rateLimit;

    for (let i = 0; i < ids.length; i++) {
        const start = Date.now();
        results.push(await fetcher(ids[i]));
        const elapsed = Date.now() - start;
        if (elapsed < delayMs) await new Promise(r => setTimeout(r, delayMs - elapsed));
    }

    return results;
}
```

**Edge cases to mention:**
- Fetcher errors — wrap in try/catch, decide: fail-fast or collect errors?
- True concurrency + rate limit — use a token bucket if N concurrent workers needed
- Clock skew — `Date.now()` is sufficient here; no need for `performance.now()` unless sub-ms precision required

---

## Problem 4 — React Streaming UI (LOW-MEDIUM probability)

Simple: render streaming LLM output token by token.

```tsx
import { useState } from 'react';

function StreamingChat() {
    const [output, setOutput] = useState('');

    async function ask(prompt: string) {
        setOutput('');
        const res = await fetch(`/stream?prompt=${encodeURIComponent(prompt)}`);
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines = decoder.decode(value).split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                    const { text } = JSON.parse(line.slice(6));
                    setOutput(prev => prev + text);
                }
            }
        }
    }

    return (
        <div>
            <button onClick={() => ask('Hello')}>Ask</button>
            <pre>{output || 'Click to stream'}</pre>
        </div>
    );
}
```

---

## Interview Strategy

| Situation | What to do |
|---|---|
| Problem given | Restate it in your own words before typing |
| Before coding | Describe approach + edge cases out loud |
| Stuck | Say "let me trace through this" — never go silent |
| Frontend asked | Lean into the API/data layer, acknowledge the UI is thin |
| AI/LLM topic | Connect to backend strength — streaming, pipelines, reliability |

**Your strongest card:** You think about **concurrency, correctness, and production safety** naturally. Rashid values production-grade thinking — use that vocabulary explicitly.
