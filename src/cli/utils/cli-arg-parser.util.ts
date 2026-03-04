import type { AskToolArgs } from '../../ask';
import type { AskAllToolArgs } from '../../ask-all';

export const parseAskArgs = (args: readonly string[]): AskToolArgs => {
  let prompt: string | undefined;
  let model: string | undefined;
  let working_directory: string | undefined;
  let auto_mode: string | undefined;
  let system_prompt: string | undefined;
  let effort: string | undefined;
  let max_budget: string | undefined;
  let context: string | undefined;
  let session_id: string | undefined;
  let mode: 'async' | undefined;
  let action: 'status' | undefined;
  let jobId: string | undefined;
  const files: string[] = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--config') {
      i += 2;
      continue;
    }

    if (arg === '--model') {
      model = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--working-dir') {
      working_directory = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--auto-mode') {
      auto_mode = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--system-prompt') {
      system_prompt = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--effort') {
      effort = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--max-budget') {
      max_budget = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--file') {
      files.push(args[i + 1] as string);
      i += 2;
      continue;
    }

    if (arg === '--context') {
      context = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--session-id') {
      session_id = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === '--async') {
      mode = 'async';
      i += 1;
      continue;
    }

    if (arg === '--job-id') {
      action = 'status';
      jobId = args[i + 1];
      i += 2;
      continue;
    }

    if (arg && !arg.startsWith('--') && prompt === undefined) {
      prompt = arg;
      i += 1;
      continue;
    }

    i += 1;
  }

  const result: AskToolArgs = {
    ...(prompt !== undefined && { prompt }),
    ...(model !== undefined && { model }),
    ...(working_directory !== undefined && { working_directory }),
    ...(auto_mode !== undefined && { auto_mode }),
    ...(system_prompt !== undefined && { system_prompt }),
    ...(effort !== undefined && { effort }),
    ...(max_budget !== undefined && { max_budget }),
    ...(context !== undefined && { context }),
    ...(session_id !== undefined && { session_id }),
    ...(mode !== undefined && { mode }),
    ...(action !== undefined && { action }),
    ...(jobId !== undefined && { job_id: jobId }),
    ...(files.length > 0 && { files }),
  };

  return result;
};

export const parseAskAllArgs = (args: readonly string[]): AskAllToolArgs => {
  const askArgs = parseAskArgs(args);

  let providers: readonly string[] | undefined;
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--providers') {
      const csv = args[i + 1];
      providers = csv ? csv.split(',') : undefined;
      i += 2;
      continue;
    }

    i += 1;
  }

  const result: AskAllToolArgs = {
    prompt: askArgs.prompt ?? '',
    ...(providers !== undefined && { providers }),
    ...(askArgs.model !== undefined && { model: askArgs.model }),
    ...(askArgs.context !== undefined && { context: askArgs.context }),
    ...(askArgs.working_directory !== undefined && { working_directory: askArgs.working_directory }),
    ...(askArgs.system_prompt !== undefined && { system_prompt: askArgs.system_prompt }),
  };

  return result;
};
