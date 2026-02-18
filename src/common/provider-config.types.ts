import type { z } from 'zod';

import type {
  askCommandSchema,
  capabilitiesSchema,
  commandsSchema,
  inputSchema,
  providerConfigSchema,
  providersFileSchema,
  reviewCommandSchema,
  sandboxCommandSchema,
  sessionsCommandSchema,
} from './provider-config.schema.js';

export type AskCommand = z.infer<typeof askCommandSchema>;

export type ReviewCommand = z.infer<typeof reviewCommandSchema>;

export type SessionsCommand = z.infer<typeof sessionsCommandSchema>;

export type SandboxCommand = z.infer<typeof sandboxCommandSchema>;

export type Capabilities = z.infer<typeof capabilitiesSchema>;

export type Commands = z.infer<typeof commandsSchema>;

export type Input = z.infer<typeof inputSchema>;

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export type ProvidersFile = z.infer<typeof providersFileSchema>;
