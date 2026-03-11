type BackgroundJobState = 'pending' | 'running' | 'completed' | 'failed';
type BackgroundJobStructuredContent = Readonly<Record<string, unknown>>;

export type BackgroundJobCompletionInput = Readonly<{
  resultText: string;
  structuredContent?: BackgroundJobStructuredContent;
}>;

export type BackgroundJobRecord = Readonly<{
  id: string;
  provider: string;
  state: BackgroundJobState;
  createdAt: string;
  updatedAt: string;
  resultText?: string;
  structuredContent?: BackgroundJobStructuredContent;
  error?: string;
}>;

export type BackgroundJobStatusPayload = Readonly<{
  job_id: string;
  state: BackgroundJobState;
  updated_at: string;
  result?: string;
  structuredContent?: BackgroundJobStructuredContent;
  error?: string;
}>;
