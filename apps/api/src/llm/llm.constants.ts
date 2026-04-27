import type Anthropic from '@anthropic-ai/sdk';

export interface LlmConfig {
  maxTokens: number;
  model: string;
}

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  maxTokens: 512,
  model: 'claude-3-5-sonnet-latest',
};

export const LLM_CONFIG = Symbol('LLM_CONFIG');
export const LLM_ANTHROPIC_CLIENT = Symbol('LLM_ANTHROPIC_CLIENT');

export type AnthropicClient = Anthropic | null;
