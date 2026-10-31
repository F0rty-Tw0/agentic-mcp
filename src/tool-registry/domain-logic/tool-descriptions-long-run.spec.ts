import { describe, expect, it } from 'vitest';

import { buildAskToolDefinition } from './ask-tool.builder';
import { buildReviewToolDefinition } from './review-tool.builder';
import { TOOL_REGISTRY_PROVIDER_CONFIG_STUB } from '../test/stubs/tool-registry.stub';

const ASYNC_GUIDANCE = 'mode: "async"';
const POLL_GUIDANCE = 'action: "status"';

const readModeDescription = (): string | undefined => {
  const definition = buildAskToolDefinition('codex', TOOL_REGISTRY_PROVIDER_CONFIG_STUB);
  const modeDescription = definition.inputSchema?.mode?.description;

  return modeDescription;
};

describe('FEATURE: long-run guidance in tool descriptions', () => {
  describe('GIVEN an ask tool definition', () => {
    it('WHEN reading its description THEN it tells agents to run long work with mode async and poll its status', () => {
      const definition = buildAskToolDefinition('codex', TOOL_REGISTRY_PROVIDER_CONFIG_STUB);

      expect(definition.description).toContain(`${ASYNC_GUIDANCE}, then poll with ${POLL_GUIDANCE}`);
    });

    it('WHEN reading the mode field description THEN it says async is for work likely to take more than about a minute', () => {
      const modeDescription = readModeDescription();

      expect(modeDescription).toContain('more than about a minute');
    });
  });

  describe('GIVEN a review tool definition', () => {
    it('WHEN reading its description THEN it points long reviews to ask with mode async and status polling', () => {
      const flags = { uncommitted: ['--uncommitted'] };
      const review = { args: ['review'], flags };
      const commands = { ...TOOL_REGISTRY_PROVIDER_CONFIG_STUB.commands, review };
      const config = { ...TOOL_REGISTRY_PROVIDER_CONFIG_STUB, commands };
      const definition = buildReviewToolDefinition('codex', config);

      expect(definition.description).toContain(`ask_codex with ${ASYNC_GUIDANCE}`);
    });
  });
});
