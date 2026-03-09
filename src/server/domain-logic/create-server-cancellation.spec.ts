import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './create-server';
import type { ProvidersFile } from '../../shared';
import type { AsyncViFn, SyncViFn } from '../../shared/command-execution/common/test-utils';

type ActiveRequest = Readonly<{ requestId: string; pid: number }>;
type LoadConfigMock = AsyncViFn<[options?: { configPath?: string }], ProvidersFile>;
type KillProcessMock = AsyncViFn<[pid: number], boolean>;
type GetActiveRequestMock = SyncViFn<[requestId: string], ActiveRequest | undefined>;
type UnregisterActiveRequestMock = SyncViFn<[requestId: string], void>;

type RegisterAllToolsMock = SyncViFn<[server: unknown, resolvedProviders: unknown[], allProviders: unknown[]], void>;

const mocks = vi.hoisted(() => {
  const loadConfig = vi.fn<LoadConfigMock>();
  const killProcess = vi.fn<KillProcessMock>();
  const getActiveRequest = vi.fn<GetActiveRequestMock>();
  const unregisterActiveRequest = vi.fn<UnregisterActiveRequestMock>();
  const registerAllTools = vi.fn<RegisterAllToolsMock>();

  return {
    loadConfig,
    killProcess,
    getActiveRequest,
    unregisterActiveRequest,
    registerAllTools,
  };
});

vi.mock('../../config/loader', () => ({
  loadConfig: mocks.loadConfig,
  warnDangerousFlags: vi.fn(),
}));

vi.mock('../../shared/command-execution/utils/platform.util', () => ({
  resolveCliBinary: vi.fn(),
  killProcess: mocks.killProcess,
}));

vi.mock('../../shared/validation/domain-logic/request-registry', () => ({
  getActiveRequest: mocks.getActiveRequest,
  unregisterActiveRequest: mocks.unregisterActiveRequest,
}));

vi.mock('../../tool-registry', () => ({
  registerAllTools: mocks.registerAllTools,
}));

const emptyConfig: ProvidersFile = {
  configVersion: 1,
  providers: {},
};

type NotificationHandler = (notification: unknown) => Promise<void>;

const createServerAndCaptureHandler = async (): Promise<NotificationHandler> => {
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  mocks.loadConfig.mockResolvedValue(emptyConfig);

  let capturedHandler: NotificationHandler | undefined;

  const originalSetHandler = Server.prototype.setNotificationHandler;

  vi.spyOn(Server.prototype, 'setNotificationHandler').mockImplementation(function (
    this: InstanceType<typeof Server>,
    schema: Parameters<typeof originalSetHandler>[0],
    handler: Parameters<typeof originalSetHandler>[1]
  ) {
    originalSetHandler.call(this, schema, handler);
    capturedHandler = handler as NotificationHandler;
  });

  await createServer();

  vi.mocked(Server.prototype.setNotificationHandler).mockRestore();

  if (!capturedHandler) throw new Error('Notification handler was not registered');

  return capturedHandler;
};

describe('createServer – cancellation notification handler', () => {
  beforeEach(() => {
    mocks.loadConfig.mockReset();
    mocks.killProcess.mockReset();
    mocks.getActiveRequest.mockReset();
    mocks.unregisterActiveRequest.mockReset();
    mocks.registerAllTools.mockReset();
    vi.restoreAllMocks();
  });

  it('GIVEN an active request WHEN cancellation notification is received THEN it kills the process and unregisters the request', async () => {
    const handler = await createServerAndCaptureHandler();

    mocks.getActiveRequest.mockReturnValue({ requestId: '42', pid: 1234 });
    mocks.killProcess.mockResolvedValue(true);

    await handler({ params: { requestId: '42' } });

    expect(mocks.getActiveRequest).toHaveBeenCalledWith('42');
    expect(mocks.killProcess).toHaveBeenCalledWith(1234);
    expect(mocks.unregisterActiveRequest).toHaveBeenCalledWith('42');
  });

  it('GIVEN no active request for the id WHEN cancellation notification is received THEN it does not kill or unregister anything', async () => {
    const handler = await createServerAndCaptureHandler();

    mocks.getActiveRequest.mockReturnValue(undefined);

    await handler({ params: { requestId: '99' } });

    expect(mocks.getActiveRequest).toHaveBeenCalledWith('99');
    expect(mocks.killProcess).not.toHaveBeenCalled();
    expect(mocks.unregisterActiveRequest).not.toHaveBeenCalled();
  });

  it('GIVEN a numeric requestId WHEN cancellation notification is received THEN it converts to string and processes correctly', async () => {
    const handler = await createServerAndCaptureHandler();

    mocks.getActiveRequest.mockReturnValue({ requestId: '7', pid: 5678 });
    mocks.killProcess.mockResolvedValue(true);

    await handler({ params: { requestId: 7 } });

    expect(mocks.getActiveRequest).toHaveBeenCalledWith('7');
    expect(mocks.killProcess).toHaveBeenCalledWith(5678);
    expect(mocks.unregisterActiveRequest).toHaveBeenCalledWith('7');
  });

  it('GIVEN a falsy requestId WHEN cancellation notification is received THEN it returns early without any action', async () => {
    const handler = await createServerAndCaptureHandler();

    await handler({ params: { requestId: 0 } });

    expect(mocks.getActiveRequest).not.toHaveBeenCalled();
    expect(mocks.killProcess).not.toHaveBeenCalled();
    expect(mocks.unregisterActiveRequest).not.toHaveBeenCalled();
  });
});
