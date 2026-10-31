import type { CallToolResult } from '@modelcontextprotocol/server';

type BackgroundJobState = 'pending' | 'running' | 'completed' | 'failed';
type BackgroundJobStructuredContent = CallToolResult['structuredContent'];

export type BackgroundJobCompletionInput = {
  readonly resultText: string;
  readonly structuredContent?: BackgroundJobStructuredContent;
};

export type BackgroundJobRecord = {
  readonly id: string;
  readonly provider: string;
  readonly state: BackgroundJobState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resultText?: string;
  readonly structuredContent?: BackgroundJobStructuredContent;
  readonly error?: string;
};

export type BackgroundJobStatusPayload = {
  readonly job_id: string;
  readonly state: BackgroundJobState;
  readonly updated_at: string;
  readonly result?: string;
  readonly structuredContent?: BackgroundJobStructuredContent;
  readonly error?: string;
};
