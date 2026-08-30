type Row = Record<string, unknown>;

const uniqueKeys: Record<string, readonly string[]> = {
  eval_runs: ["run_id"],
  evaluations: ["run_id", "evaluation_id"],
  events: ["run_id", "event_id"],
  event_chunks: ["run_id", "event_id", "index"],
  sessions: ["run_id", "session_id"],
};

function rowKey(table: string, row: Row): string {
  return (uniqueKeys[table] ?? [])
    .map((column) => String(row[column]))
    .join("\0");
}

function matches(row: Row, filters: readonly [string, unknown][]): boolean {
  return filters.every(([column, value]) => row[column] === value);
}

class FakeQuery {
  constructor(
    private readonly tables: Map<string, Row[]>,
    private readonly table: string,
    private readonly filters: Array<[string, unknown]> = [],
    private readonly action:
      | { readonly type: "select" }
      | { readonly type: "insert"; readonly rows: Row[] }
      | { readonly type: "update"; readonly patch: Row }
      | { readonly type: "upsert"; readonly rows: Row[] } = {
      type: "select",
    },
    private readonly single = false,
    private readonly from = 0,
    private readonly to = Number.POSITIVE_INFINITY,
  ) {}

  select(_columns?: string): FakeQuery {
    return this;
  }

  eq(column: string, value: unknown): FakeQuery {
    return new FakeQuery(
      this.tables,
      this.table,
      [...this.filters, [column, value]],
      this.action,
      this.single,
      this.from,
      this.to,
    );
  }

  range(from: number, to: number): FakeQuery {
    return new FakeQuery(
      this.tables,
      this.table,
      this.filters,
      this.action,
      this.single,
      from,
      to,
    );
  }

  maybeSingle(): FakeQuery {
    return new FakeQuery(
      this.tables,
      this.table,
      this.filters,
      this.action,
      true,
      this.from,
      this.to,
    );
  }

  insert(data: Row | Row[]): FakeQuery {
    return new FakeQuery(this.tables, this.table, this.filters, {
      type: "insert",
      rows: Array.isArray(data) ? data : [data],
    });
  }

  update(patch: Row): FakeQuery {
    return new FakeQuery(this.tables, this.table, this.filters, {
      type: "update",
      patch,
    });
  }

  upsert(data: Row | Row[], _options?: unknown): FakeQuery {
    return new FakeQuery(this.tables, this.table, this.filters, {
      type: "upsert",
      rows: Array.isArray(data) ? data : [data],
    });
  }

  // biome-ignore lint/suspicious/noThenProperty: supabase-js queries are thenable
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: { code?: string; message?: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): {
    data: unknown;
    error: { code?: string; message?: string } | null;
  } {
    const rows = this.tables.get(this.table) ?? [];
    if (this.action.type === "insert") {
      const existingKeys = new Set(rows.map((row) => rowKey(this.table, row)));
      if (
        this.action.rows.some((row) =>
          existingKeys.has(rowKey(this.table, row)),
        ) ||
        (this.table === "events" &&
          this.action.rows.some((row) =>
            rows.some(
              (existing) =>
                existing.run_id === row.run_id &&
                existing.sequence !== undefined &&
                existing.sequence === row.sequence,
            ),
          ))
      ) {
        return {
          data: null,
          error: { code: "23505", message: "duplicate key" },
        };
      }
      this.tables.set(this.table, [
        ...rows,
        ...this.action.rows.map((row) => ({ ...row })),
      ]);
      return { data: null, error: null };
    }

    if (this.action.type === "update") {
      const updated: Row[] = [];
      for (const row of rows) {
        if (matches(row, this.filters)) {
          Object.assign(row, this.action.patch);
          updated.push({ ...row });
        }
      }
      return { data: updated, error: null };
    }

    if (this.action.type === "upsert") {
      const next = [...rows];
      for (const incoming of this.action.rows) {
        const key = rowKey(this.table, incoming);
        const index = next.findIndex((row) => rowKey(this.table, row) === key);
        if (index === -1) {
          next.push({ ...incoming });
        } else {
          next[index] = { ...next[index], ...incoming };
        }
      }
      this.tables.set(this.table, next);
      return { data: null, error: null };
    }

    const selected = rows.filter((row) => matches(row, this.filters));
    const paged = selected.slice(
      this.from,
      Number.isFinite(this.to) ? this.to + 1 : undefined,
    );
    if (this.single) {
      return { data: paged[0] ?? null, error: null };
    }
    return { data: paged, error: null };
  }
}

export function createFakeSupabaseClient() {
  const tables = new Map<string, Row[]>();
  return {
    tables,
    from(table: string) {
      return new FakeQuery(tables, table);
    },
  };
}

export type FakeSupabaseClient = ReturnType<typeof createFakeSupabaseClient>;
