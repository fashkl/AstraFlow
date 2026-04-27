import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  DEFAULT_LLM_CONFIG,
  LLM_ANTHROPIC_CLIENT,
  LLM_CONFIG,
  type AnthropicClient,
  type LlmConfig,
} from './llm.constants';

interface AnthropicStreamEvent {
  delta?: {
    text?: string;
    type?: string;
  };
  type?: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(LLM_ANTHROPIC_CLIENT) private readonly anthropicClient: AnthropicClient,
    @Inject(LLM_CONFIG) private readonly config: LlmConfig = DEFAULT_LLM_CONFIG,
  ) {}

  async streamPrompt(
    prompt: string,
    signal: AbortSignal,
    onToken: (token: string) => void,
  ): Promise<void> {
    if (!this.anthropicClient) {
      throw new ServiceUnavailableException('LLM provider is not configured');
    }
    this.logger.log(
      `LLM stream started model=${this.config.model} maxTokens=${this.config.maxTokens} promptLength=${prompt.length}`,
    );

    const stream = (await this.anthropicClient.messages.create(
      {
        max_tokens: this.config.maxTokens,
        messages: [{ content: prompt, role: 'user' }],
        model: this.config.model,
        stream: true,
      },
      { signal },
    )) as AsyncIterable<AnthropicStreamEvent>;

    let tokenCount = 0;
    let streamedChars = 0;

    for await (const event of stream) {
      if (signal.aborted) {
        this.logger.warn(`LLM stream aborted after ${tokenCount} tokens`);
        return;
      }

      const token = this.extractToken(event);
      if (token) {
        tokenCount += 1;
        streamedChars += token.length;
        onToken(token);
      }
    }

    this.logger.log(
      `LLM stream completed tokens=${tokenCount} streamedChars=${streamedChars} promptLength=${prompt.length}`,
    );
  }

  private extractToken(event: AnthropicStreamEvent): string | null {
    if (event.type !== 'content_block_delta') {
      return null;
    }
    if (event.delta?.type !== 'text_delta') {
      return null;
    }
    if (typeof event.delta.text !== 'string' || event.delta.text.length === 0) {
      return null;
    }
    return event.delta.text;
  }
}
