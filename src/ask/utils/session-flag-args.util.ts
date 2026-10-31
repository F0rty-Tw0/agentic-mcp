import type { FlagValue, ProviderConfig } from '../../shared/provider/common';
import {
  SESSION_CONTINUE_FLAG_KEY,
  SESSION_FLAG_VALUE_JOINER,
  SESSION_RESUME_FLAG_KEY,
  SESSION_START_FLAG_KEY,
} from '../common';

const resolveValueFlagArgs = (flag: string, value: string): string[] => {
  const isJoinedFlag = flag.endsWith(SESSION_FLAG_VALUE_JOINER);
  const joinedArgs = [`${flag}${value}`];

  if (isJoinedFlag) return joinedArgs;

  const splitArgs = [flag, value];

  return splitArgs;
};

const resolveSessionFlagArgs = (flagValue: FlagValue | undefined, value: string): string[] => {
  if (!flagValue) return [];

  if (typeof flagValue === 'string') return resolveValueFlagArgs(flagValue, value);

  if (Array.isArray(flagValue)) return [...flagValue, value];

  const isAllowedValue = flagValue.values.includes(value);

  if (!isAllowedValue) return [];

  return [flagValue.flag, value];
};

export const buildNativeSessionArgs = (config: ProviderConfig, nativeSessionId: string): string[] => {
  const sessionsCommand = config.commands.sessions;

  if (!sessionsCommand?.flags) return [];

  const resumeFlag = sessionsCommand.flags[SESSION_RESUME_FLAG_KEY];
  const continueFlag = sessionsCommand.flags[SESSION_CONTINUE_FLAG_KEY];

  const resumeArgs = resolveSessionFlagArgs(resumeFlag, nativeSessionId);

  if (resumeArgs.length) return resumeArgs;

  return resolveSessionFlagArgs(continueFlag, nativeSessionId);
};

export const buildStartSessionArgs = (config: ProviderConfig, startSessionId: string): string[] => {
  const startFlag = config.commands.sessions?.flags?.[SESSION_START_FLAG_KEY];
  const startArgs = resolveSessionFlagArgs(startFlag, startSessionId);

  return startArgs;
};

export const canStartNativeSession = (config: ProviderConfig, startSessionId: string): boolean => {
  const startArgs = buildStartSessionArgs(config, startSessionId);
  const resumeArgs = buildNativeSessionArgs(config, startSessionId);
  const canStart = startArgs.length > 0 && resumeArgs.length > 0;

  return canStart;
};

const toStartFlagArg = (startFlag: string | string[]): string => {
  if (typeof startFlag === 'string') return startFlag;

  const lastArg = startFlag.at(-1) ?? '';

  return lastArg;
};

export const resolveStartFlagName = (config: ProviderConfig): string | undefined => {
  const startFlag = config.commands.sessions?.flags?.[SESSION_START_FLAG_KEY];

  if (!startFlag) return;

  const flagArg = toStartFlagArg(startFlag);
  const isJoinedFlag = flagArg.endsWith(SESSION_FLAG_VALUE_JOINER);

  if (!isJoinedFlag) return flagArg;

  const flagName = flagArg.slice(0, -SESSION_FLAG_VALUE_JOINER.length);

  return flagName;
};
