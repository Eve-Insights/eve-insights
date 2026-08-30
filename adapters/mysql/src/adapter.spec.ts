import type {
  AdapterCommitResult,
  AdapterWriteResult,
  BeginEventInput,
  CommitEventInput,
  CreateRunInput,
  WriteEventChunkInput,
} from "@eve-insights/adapter-types";
import type { Pool } from "mysql2/promise";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pool: { name: "pool" } as unknown as Pool,
  createPool: vi.fn(),
  createDrizzleStore: vi.fn(),
  listAgents: vi.fn(),
  listRuns: vi.fn(),
  getRunReport: vi.fn(),
  createRun: vi.fn(),
  beginEvent: vi.fn(),
  writeEventChunk: vi.fn(),
  commitEvent: vi.fn(),
}));

mocks.createPool.mockReturnValue(mocks.pool);
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

vi.mock("mysql2/promise", () => ({
  createPool: mocks.createPool,
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
  clearMysqlPoolCache,
  createMysqlAdapter,
  getMysqlPool,
  MysqlAdapter,
} from "./adapter.js";

const options = {
  host: "localhost",
  user: "eve",
  password: "secret",
  database: "eve_insights",
  port: 3306,
  maxChunkBytes: 128,
};

describe("MysqlAdapter", () => {
  afterEach(() => {
    clearMysqlPoolCache();
    vi.clearAllMocks();
    mocks.createPool.mockReturnValue(mocks.pool);
    mocks.createDrizzleStore.mockReturnValue({});
  });

  it("reuses pools for an identical connection identity", () => {
    const first = getMysqlPool(options);
    const second = getMysqlPool(options);

    expect(first).toBe(second);
    expect(mocks.createPool).toHaveBeenCalledTimes(1);
  });

  it("constructs through the factory and delegates the adapter contract", async () => {
    const adapter = createMysqlAdapter(options);
    expect(adapter).toBeInstanceOf(MysqlAdapter);
    expect(mocks.createDrizzleStore).toHaveBeenCalledWith(mocks.pool);

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
    const adapter = new MysqlAdapter(options);

    await expect(adapter.listAgents()).rejects.toMatchObject({
      code: "unavailable",
    });
  });
});
