type BackgroundJobState = 'pending' | 'running' | 'completed' | 'failed';

export type BackgroundJobRecord = Readonly<{
  id: string;
  provider: string;
  state: BackgroundJobState;
  createdAt: string;
  updatedAt: string;
  resultText?: string;
  error?: string;
}>;

export type BackgroundJobStatusPayload = Readonly<{
  job_id: string;
  state: BackgroundJobState;
  updated_at: string;
  result?: string;
  error?: string;
}>;
