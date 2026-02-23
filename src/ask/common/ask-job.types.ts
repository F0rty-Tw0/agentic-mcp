export type AskJobState = 'pending' | 'running' | 'completed' | 'failed';

export type AskJobRecord = Readonly<{
  id: string;
  provider: string;
  state: AskJobState;
  createdAt: string;
  updatedAt: string;
  resultText?: string;
  error?: string;
}>;
