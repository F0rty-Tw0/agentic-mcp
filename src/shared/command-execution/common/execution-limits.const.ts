export const DEFAULT_PROVIDER_MAX_CONCURRENCY = 1;

export const DEFAULT_PROVIDER_QUEUE_TIMEOUT_MS = 600_000;

export const GLOBAL_MAX_CONCURRENT_SPAWNS = 5;

export const PROBE_QUEUE_TIMEOUT_MS = 30_000;

// A call blocked only by the global spawn cap waits this long past its queue timeout: one default provider run.
export const GLOBAL_SLOT_MAX_EXTRA_WAIT_MS = 3_600_000;

export const MAX_ERROR_STDERR_BYTES = 4096;

export const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export const MS_PER_SECOND = 1_000;

// After a kill, a descendant outside the process group may keep the pipes open; release them this long after exit.
export const STDIO_RELEASE_GRACE_MS = 1_000;

// Default wait for a CLI that printed a complete result to exit before it is stopped (agy #1313 hangs after
// printing). agy may still finish background tasks after its answer, so this is not a few seconds.
export const RESULT_EXIT_GRACE_MS = 30_000;

// On shutdown, a provider group that ignores SIGTERM this long gets SIGKILL. Short, since the MCP client may
// SIGKILL the server itself soon after its own SIGTERM.
export const CHILD_GROUP_KILL_GRACE_MS = 2_000;

export const CHILD_GROUP_POLL_INTERVAL_MS = 100;
