import type { ProviderAttribution } from './attribution.types';

export type AskToolStructuredContent = Readonly<{
  response: string;
  attribution: ProviderAttribution;
  parsed?: unknown;
  sessionMode?: string;
}>;
