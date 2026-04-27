import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { LlmStreamQueryDto } from './llm.dto';
import { LlmService } from './llm.service';

interface SseRequest {
  on(event: 'close', listener: () => void): unknown;
  removeListener(event: 'close', listener: () => void): unknown;
}

interface SseResponse {
  end(): unknown;
  flushHeaders?(): unknown;
  setHeader(name: string, value: string): unknown;
  writableEnded: boolean;
  write(chunk: string): unknown;
}

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Get('stream')
  async stream(
    @Query() query: LlmStreamQueryDto,
    @Req() req: SseRequest,
    @Res() res: SseResponse,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const abortController = new AbortController();
    const onClose = () => abortController.abort();
    req.on('close', onClose);

    try {
      await this.llmService.streamPrompt(query.prompt, abortController.signal, (token) => {
        this.writeSseEvent(res, 'token', token);
      });

      if (!abortController.signal.aborted) {
        this.writeSseEvent(res, 'done', '');
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Unknown streaming error';
        this.writeSseEvent(res, 'error', message);
      }
    } finally {
      req.removeListener('close', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  private writeSseEvent(res: SseResponse, event: string, data: string): void {
    if (res.writableEnded) {
      return;
    }

    res.write(`event: ${event}\n`);
    for (const line of String(data).split(/\r?\n/)) {
      res.write(`data: ${line}\n`);
    }
    res.write('\n');
  }
}
