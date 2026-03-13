import type { AskAllProviderResult, AskAllResult } from '../common';

const buildProviderSummaryLine = (result: AskAllProviderResult): string => {
  const status = result.success ? 'success' : 'failed';
  const summaryLine = `- ${result.provider}: ${status} in ${result.executionTimeMs}ms`;

  return summaryLine;
};

export const buildAskAllSummary = (askAllResult: AskAllResult): string => {
  const summaryLines = [
    `Comparison complete for ${askAllResult.totalProviders} providers in ${askAllResult.totalExecutionTimeMs}ms`,
    `Succeeded: ${askAllResult.succeeded}`,
    `Failed: ${askAllResult.failed}`,
    'Results:',
    ...askAllResult.results.map((result) => buildProviderSummaryLine(result)),
  ];
  const summaryText = summaryLines.join('\n');

  return summaryText;
};
