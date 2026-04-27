import { EventEmitter } from 'node:events';
import { LlmController } from './llm.controller';
import type { LlmService } from './llm.service';

type MockRequest = EventEmitter & {
  on(event: 'close', listener: () => void): MockRequest;
  removeListener(event: 'close', listener: () => void): MockRequest;
};

type MockResponse = {
  end: jest.Mock;
  flushHeaders: jest.Mock;
  setHeader: jest.Mock;
  writableEnded: boolean;
  write: jest.Mock;
};

function createMockRequest(): MockRequest {
  return new EventEmitter() as MockRequest;
}

function createMockResponse(): MockResponse {
  const response = {
    end: jest.fn(function end(this: MockResponse) {
      this.writableEnded = true;
      return this;
    }),
    flushHeaders: jest.fn(),
    removeHeader: jest.fn(),
    setHeader: jest.fn(),
    writableEnded: false,
    write: jest.fn(),
  } as unknown as MockResponse;

  return response;
}

function outputOf(response: MockResponse): string {
  return response.write.mock.calls.map((call) => String(call[0])).join('');
}

describe('LlmController', () => {
  let streamPrompt: jest.MockedFunction<LlmService['streamPrompt']>;
  let controller: LlmController;

  beforeEach(() => {
    streamPrompt = jest.fn();
    controller = new LlmController({ streamPrompt } as unknown as LlmService);
  });

  it('sets SSE headers and streams tokens', async () => {
    streamPrompt.mockImplementation(async (_prompt, _signal, onToken) => {
      onToken('hello');
      onToken('world');
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await controller.stream({ prompt: 'say hi' }, req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-transform');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(res.flushHeaders).toHaveBeenCalledTimes(1);

    const output = outputOf(res);
    expect(output).toContain('event: token');
    expect(output).toContain('data: hello');
    expect(output).toContain('data: world');
    expect(output).toContain('event: done');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('aborts upstream stream when client disconnects', async () => {
    let seenSignal: AbortSignal | null = null;

    streamPrompt.mockImplementation(async (_prompt, signal) => {
      seenSignal = signal;
      expect(signal.aborted).toBe(false);
    });

    const req = createMockRequest();
    const res = createMockResponse();

    const streamPromise = controller.stream({ prompt: 'disconnect test' }, req, res);
    req.emit('close');
    await streamPromise;

    expect(seenSignal).not.toBeNull();
    expect(seenSignal!.aborted).toBe(true);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('writes SSE error frame and closes when upstream fails', async () => {
    streamPrompt.mockRejectedValue(new Error('upstream failed'));

    const req = createMockRequest();
    const res = createMockResponse();

    await controller.stream({ prompt: 'fail' }, req, res);

    const output = outputOf(res);
    expect(output).toContain('event: error');
    expect(output).toContain('data: upstream failed');
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
