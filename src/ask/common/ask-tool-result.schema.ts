import type { ProviderAttribution } from './attribution.type';

export type AskToolStructuredContent = {
  readonly response: string;
  readonly attribution: ProviderAttribution;
  readonly parsed?: unknown;
  readonly sessionMode?: string;
};
