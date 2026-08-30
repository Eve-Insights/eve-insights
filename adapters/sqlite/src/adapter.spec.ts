import type {
  AdapterCommitResult,
  AdapterWriteResult,
  BeginEventInput,
  CommitEventInput,
  CreateRunInput,
  WriteEventChunkInput,
} from "@eve-insights/adapter-types";
import type { Client } from "@libsql/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: {
    name: "client",
    execute: vi.fn().mockResolvedValue(undefined),
  } as unknown as Client,
  createClient: vi.fn(),
  createDrizzleStore: vi.fn(),
  listAgents: vi.fn(),
  listRuns: vi.fn(),
  getRunReport: vi.fn(),
  createRun: vi.fn(),
  beginEvent: vi.fn(),
  writeEventChunk: vi.fn(),
  commitEvent: vi.fn(),
}));

mocks.createClient.mockReturnValue(mocks.client);
mocks.createDrizzleStore.mockReturnValue({});
mocks.listAgents.mockResolvedValue([]);
mocks.listRuns.mockResolvedValue([]);
mocks.getRunReport.mockResolvedValue(undefined);
mocks.createRun.mockResolvedValue({
  created: true,
} satisfies AdapterWriteResult);
mocks.beginEvent.mockResolvedValue({
  created: true,
} satisfies AdapterWriteResult);
mocks.writeEventChunk.mockResolvedValue({
  created: true,
} satisfies AdapterWriteResult);
mocks.commitEvent.mockResolvedValue({
  committed: true,
} satisfies AdapterCommitResult);

vi.mock("@libsql/client", () => ({
  createClient: mocks.createClient,
}));
vi.mock("./store.js", () => ({
  createDrizzleStore: mocks.createDrizzleStore,
}));
vi.mock("./queries.js", () => ({
  listAgents: mocks.listAgents,
  listRuns: mocks.listRuns,
  getRunReport: mocks.getRunReport,
}));
vi.mock("./runs.js", () => ({
  createRun: mocks.createRun,
}));
vi.mock("./events.js", () => ({
  beginEvent: mocks.beginEvent,
  writeEventChunk: mocks.writeEventChunk,
  commitEvent: mocks.commitEvent,
}));

import {
  clearSqliteClientCache,
  createSqliteAdapter,
  getSqliteClient,
  SqliteAdapter,
  toLibsqlUrl,
} from "./adapter.js";

const options = {
  path: ":memory:",
  maxChunkBytes: 128,
};

describe("SqliteAdapter", () => {
  afterEach(() => {
    clearSqliteClientCache();
    vi.clearAllMocks();
    mocks.createClient.mockReturnValue(mocks.client);
    mocks.createDrizzleStore.mockReturnValue({});
  });

  it("reuses clients for an identical connection identity", () => {
    const first = getSqliteClient(options);
    const second = getSqliteClient(options);

    expect(first).toBe(second);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it("normalizes filesystem paths to libsql file URLs", () => {
    expect(toLibsqlUrl("./data/eve_insights.db")).toBe(
      "file:./data/eve_insights.db",
    );
    expect(toLibsqlUrl("file:./data/eve_insights.db")).toBe(
      "file:./data/eve_insights.db",
    );
    expect(toLibsqlUrl(":memory:")).toBe(":memory:");
  });

  it("constructs through the factory and delegates the adapter contract", async () => {
    const adapter = createSqliteAdapter(options);
    expect(adapter).toBeInstanceOf(SqliteAdapter);
    expect(mocks.createDrizzleStore).toHaveBeenCalledWith(mocks.client);

    await adapter.listAgents();
    await adapter.listRuns({ agentId: "agent" });
    await adapter.getRunReport({ agentId: "agent" }, "run");
    await adapter.createRun({} as CreateRunInput);
    await adapter.beginEvent({} as BeginEventInput);
    await adapter.writeEventChunk({} as WriteEventChunkInput);
    await adapter.commitEvent({} as CommitEventInput);

    expect(mocks.listAgents).toHaveBeenCalledTimes(1);
    expect(mocks.listRuns).toHaveBeenCalledWith(expect.anything(), {
      agentId: "agent",
    });
    expect(mocks.getRunReport).toHaveBeenCalledWith(
      expect.anything(),
      { agentId: "agent" },
      "run",
    );
    expect(mocks.createRun).toHaveBeenCalledWith(expect.anything(), {});
    expect(mocks.beginEvent).toHaveBeenCalledWith(expect.anything(), {});
    expect(mocks.writeEventChunk).toHaveBeenCalledWith(expect.anything(), {});
    expect(mocks.commitEvent).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("maps unexpected driver failures to unavailable", async () => {
    mocks.listAgents.mockRejectedValueOnce(new Error("connection refused"));
    const adapter = new SqliteAdapter(options);

    await expect(adapter.listAgents()).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
