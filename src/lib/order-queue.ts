import { prisma } from "@/lib/prisma";

let pending: Promise<void> = Promise.resolve();
let waiting = 0;

const MAX_WAITING = 100;

export class OrderQueueFullError extends Error {
  constructor() {
    super("Order queue is full");
  }
}

export function queueOrder<T>(
  task: () => Promise<T>
): Promise<T> {
  if (waiting >= MAX_WAITING) {
    return Promise.reject(new OrderQueueFullError());
  }

  waiting++;

  const run = pending.then(task);

  pending = run.then(
    () => undefined,
    () => undefined
  );

  return run.finally(() => {
    waiting--;
  });
}
