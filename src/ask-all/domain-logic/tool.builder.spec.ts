import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { buildAskAllToolDefinition } from './tool.builder';
import { ASK_ALL_TOOL_NAME } from '../common';

describe('buildAskAllToolDefinition', () => {
  describe('tool name', () => {
    it('GIVEN provider names WHEN called THEN returns ask_all as tool name', () => {
      const def = buildAskAllToolDefinition(['claude', 'codex']);

      expect(def.name).toBe(ASK_ALL_TOOL_NAME);
    });
  });

  describe('description', () => {
    it('GIVEN provider names WHEN called THEN description mentions ask_all', () => {
      const def = buildAskAllToolDefinition(['claude', 'codex']);

      expect(def.description.toLowerCase()).toContain('all');
    });

    it('GIVEN provider names WHEN called THEN description mentions providers', () => {
      const def = buildAskAllToolDefinition(['claude', 'codex']);

      expect(def.description).toContain('claude');
      expect(def.description).toContain('codex');
    });

    it('GIVEN no providers WHEN called THEN description is still valid string', () => {
      const def = buildAskAllToolDefinition([]);

      expect(typeof def.description).toBe('string');
      expect(def.description.length).toBeGreaterThan(0);
    });
  });

  describe('annotations', () => {
    it('GIVEN provider names WHEN called THEN has destructiveHint true', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.annotations.destructiveHint).toBe(true);
    });

    it('GIVEN provider names WHEN called THEN has openWorldHint true', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.annotations.openWorldHint).toBe(true);
    });

    it('GIVEN provider names WHEN called THEN does not have readOnlyHint', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.annotations.readOnlyHint).toBeUndefined();
    });
  });

  describe('input schema', () => {
    it('GIVEN definition WHEN called THEN prompt field is required string', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.inputSchema?.prompt).toBeDefined();

      const result = (def.inputSchema?.prompt as z.ZodType).safeParse('hello');

      expect(result.success).toBe(true);
    });

    it('GIVEN definition WHEN called THEN providers field is optional array', () => {
      const def = buildAskAllToolDefinition(['claude', 'codex']);
      const providers = def.inputSchema?.providers;

      expect(providers).toBeDefined();

      const withProviders = (providers as z.ZodType).safeParse(['claude']);
      const withoutProviders = (providers as z.ZodType).safeParse(undefined);

      expect(withProviders.success).toBe(true);
      expect(withoutProviders.success).toBe(true);
    });

    it('GIVEN definition WHEN called THEN model field is optional string', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.inputSchema?.model).toBeDefined();

      const result = (def.inputSchema?.model as z.ZodType).safeParse(undefined);

      expect(result.success).toBe(true);
    });

    it('GIVEN definition WHEN called THEN context field is optional string', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.inputSchema?.context).toBeDefined();
    });

    it('GIVEN definition WHEN called THEN working_directory field is optional string', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.inputSchema?.working_directory).toBeDefined();
    });

    it('GIVEN definition WHEN called THEN system_prompt field is optional string', () => {
      const def = buildAskAllToolDefinition(['claude']);

      expect(def.inputSchema?.system_prompt).toBeDefined();
    });
  });
});
