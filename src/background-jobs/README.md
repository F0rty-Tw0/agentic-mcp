# background-jobs

Async job queue for long-running provider invocations. When a caller sets `mode: "async"`, the ask is executed in the background and the caller receives a `job_id` to poll for status.

## What It Does

- Creates background jobs with a unique ID and initial `pending` state
- Fires off the provider invocation as a detached promise (`void startBackgroundInvocation(...)`)
- Transitions job state through `pending` -> `running` -> `completed` or `failed`
- Stores the final result text or error message for retrieval via `action: "status"` polling
- Provides a `resetBackgroundJobStoreForTests()` function for test isolation

## Structure

| Directory | Purpose |
|-----------|---------|
| `common/` | Job status payload types (`JobPayload`, state enum) |
| `data-access/` | In-memory job store (module-scoped `Map`) |
| `domain-logic/` | Job status response builder and async invocation runner |
| `utils/` | Text extraction from MCP content arrays |

## Key Files

- `data-access/job-store.ts` — In-memory job store with `createBackgroundJob()`, `getJob()`, `updateJob()`, and `resetBackgroundJobStoreForTests()`
- `domain-logic/background.ts` — `buildJobStatusResponse()` for polling and `startBackgroundInvocation()` for fire-and-forget execution

## Integration Tests

Run with: `pnpm run test:integration`

### `background.test.ts`

Exercises the async background job lifecycle end-to-end using real child processes via `handleAsk`. The job store is reset in `beforeEach` to ensure test isolation.

| Test | What It Verifies | Expected Output |
|------|-----------------|-----------------|
| Async job creation returns pending state | When `handleAsk` is called with `mode: "async"`, it immediately returns a `job_id` with `"pending"` state | `payload.job_id` is truthy; `payload.state` is `"pending"` |
| Successful job transitions to completed | After creating an async job, polling with `action: "status"` eventually shows `"completed"` with the process output | `finalPayload.state` is `"completed"`; `finalPayload.result` contains `"async-output"` |
| Failing job transitions to failed | When the child process exits with code 1 and writes to stderr, the job state becomes `"failed"` with the error captured | `finalPayload.state` is `"failed"`; `finalPayload.error` is truthy |
| Unknown job_id returns error | Polling status for a non-existent job ID returns an error response | `result.isError` is `true`; text contains `"Unknown job_id"` |

## Unit Tests

3 `.spec.ts` files covering the job store data access, background domain logic, and text extraction utility.
