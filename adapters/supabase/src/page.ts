import { throwUnexpected } from "./errors.js";
import type { AdapterContext } from "./types.js";

const PAGE_SIZE = 1000;

type Filterable = {
  eq: (column: string, value: unknown) => Filterable;
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message?: string } | null;
  }>;
};

export async function selectAll(
  context: AdapterContext,
  table: string,
  apply: (query: Filterable) => Filterable = (query) => query,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  let from = 0;
  for (;;) {
    const page = await apply(
      context.client.from(table).select("*") as unknown as Filterable,
    ).range(from, from + PAGE_SIZE - 1);
    if (page.error !== null) {
      throwUnexpected(page.error);
    }
    const data = page.data ?? [];
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}
