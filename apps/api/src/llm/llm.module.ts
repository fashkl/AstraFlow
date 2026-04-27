import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import {
  DEFAULT_LLM_CONFIG,
  LLM_ANTHROPIC_CLIENT,
  LLM_CONFIG,
  type AnthropicClient,
} from './llm.constants';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';

@Module({
  controllers: [LlmController],
  providers: [
    LlmService,
    {
      provide: LLM_CONFIG,
      useValue: DEFAULT_LLM_CONFIG,
    },
    {
      provide: LLM_ANTHROPIC_CLIENT,
      useFactory: (): AnthropicClient => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return null;
        }

        return new Anthropic({ apiKey });
      },
    },
  ],
})
export class LlmModule {}
