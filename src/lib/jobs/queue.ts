import { createLogger } from "@/lib/logger";

export interface JobQueue {
  /**
   * `requestId` is the correlation ID of the request that enqueued this
   * task (see withErrorHandling), so a background task's own log lines can
   * be grepped together with the request that triggered it even though it
   * runs after the HTTP response has already been sent.
   */
  enqueue(task: () => Promise<void>, requestId?: string): void;
}

/**
 * Simple in-process queue for the MVP: "enqueueing" a task just runs it
 * without blocking the caller (fire-and-forget), so an HTTP handler can
 * return immediately while the work continues after the response is sent.
 *
 * This is NOT durable — a task in flight is lost if the process restarts,
 * and it only works correctly on a long-running Node process (not a
 * serverless/edge runtime, which may freeze or kill the function once the
 * response is returned, before the background task finishes). Swapping
 * this for a real queue (Inngest, Trigger.dev, BullMQ + Redis, Upstash
 * QStash) later means implementing the same JobQueue interface and
 * changing getJobQueue()'s factory line — callers never change.
 */
class InProcessQueue implements JobQueue {
  enqueue(task: () => Promise<void>, requestId?: string): void {
    const logger = createLogger(requestId ?? "no-request-id");
    void task().catch((error) => {
      logger.error("Unhandled background task error", { error });
    });
  }
}

let cachedQueue: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!cachedQueue) {
    cachedQueue = new InProcessQueue();
  }
  return cachedQueue;
}
