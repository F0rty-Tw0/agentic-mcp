// agy omits finished_reason on a normal finish; these values mean the run failed or was cut short by an error.
export const FAILED_FINISHED_REASONS: string[] = ['error', 'interrupted'];

// Lower-case values that mean the answer may be partial: a failed finish, agy's print timeout, a token limit or a timeout.
// Normal finishes such as stop or end_turn are left out so they raise no warning.
export const PARTIAL_FINISHED_REASONS: string[] = [
  ...FAILED_FINISHED_REASONS,
  'print_timeout',
  'max_tokens',
  'length',
  'timeout',
];

export const SUCCESS_STATUS = 'SUCCESS';
