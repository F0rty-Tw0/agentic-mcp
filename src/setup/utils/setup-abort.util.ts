import { SETUP_ABORTED_EXIT_CODE, SETUP_ABORT_REASONS } from '../common';
import type { ParsedSetupArgs, SetupAbortCause, SetupApplyResult, SetupCliDependencies, SetupPlan } from '../common';

type SetupAbortInput = {
  readonly parsedArgs: ParsedSetupArgs;
  readonly plan: SetupPlan;
  readonly dependencies: SetupCliDependencies;
  readonly cause: SetupAbortCause;
};

const NEEDS_YES_MESSAGE =
  'Aborted: non-interactive write requires explicit --yes. Use --yes to run non-interactive writes.\n';

const DECLINED_MESSAGE = 'Aborted. No files written.\n';

const formatJsonAbortOutput = (input: SetupAbortInput): string => {
  const { parsedArgs, plan, cause } = input;
  const result: SetupApplyResult = { status: 'aborted', path: plan.targetPath, reason: SETUP_ABORT_REASONS[cause] };
  const payload = {
    client: parsedArgs.client,
    mode: parsedArgs.mode,
    dryRun: parsedArgs.dryRun,
    backup: parsedArgs.backup,
    writeIntent: plan.writeIntent,
    targetPath: plan.targetPath,
    warnings: plan.warnings,
    result,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

// stderr carries the --yes hint in both output modes; stdout stays parseable JSON with --output json.
export const reportSetupAbort = (input: SetupAbortInput): void => {
  const { parsedArgs, dependencies, cause } = input;
  const isJsonOutput = parsedArgs.output === 'json';

  dependencies.setExitCode(SETUP_ABORTED_EXIT_CODE);

  if (cause === 'needs-yes') dependencies.stderrWrite(NEEDS_YES_MESSAGE);

  if (isJsonOutput) {
    const jsonOutput = formatJsonAbortOutput(input);

    dependencies.stdoutWrite(jsonOutput);

    return;
  }

  if (cause === 'declined') dependencies.stdoutWrite(DECLINED_MESSAGE);
};
