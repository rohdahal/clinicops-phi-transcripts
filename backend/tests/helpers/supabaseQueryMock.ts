import { vi } from "vitest";

export type SupabaseResult<T = unknown> = {
  data?: T;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
};

export type QueryBuilderMock = ReturnType<typeof createQueryBuilder>;

export function createQueryBuilder(result: SupabaseResult = {}) {
  const builder: Record<string, unknown> = {};

  const chainMethods = [
    "select",
    "eq",
    "or",
    "in",
    "order",
    "range",
    "not",
    "lt",
    "gte",
    "limit",
    "insert",
    "update",
    "upsert"
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }

  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (onFulfilled: (value: SupabaseResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);

  return builder as {
    [key: string]: unknown;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled: (value: SupabaseResult) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  };
}

export function queueTableBuilders(tableQueues: Record<string, ReturnType<typeof createQueryBuilder>[]>) {
  return vi.fn((table: string) => {
    const queue = tableQueues[table];
    if (!queue || queue.length === 0) {
      throw new Error(`No mock query builder queued for table: ${table}`);
    }
    return queue.shift();
  });
}
