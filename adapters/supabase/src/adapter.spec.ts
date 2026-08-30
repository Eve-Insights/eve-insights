import type {
  AdapterCommitResult,
  AdapterWriteResult,
  BeginEventInput,
  CommitEventInput,
  CreateRunInput,
  WriteEventChunkInput,
} from "@eve-insights/adapter-types";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  listAgents: vi.fn(),
  listRuns: vi.fn(),
  getRunReport: vi.fn(),
  createRun: vi.fn(),
  beginEvent: vi.fn(),
  writeEventChunk: vi.fn(),
  commitEvent: vi.fn(),
}));

mocks.createClient.mockReturnValue({});
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

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
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
  clearSupabaseClientCache,
  createSupabaseAdapter,
  SupabaseAdapter,
} from "./adapter.js";

const options = {
  url: "https://example.supabase.co",
  secretKey: "secret",
  maxChunkBytes: 128,
};

describe("adapter", () => {
  afterEach(() => {
    clearSupabaseClientCache();
    vi.clearAllMocks();
  });

  it("constructs through the factory and configures the Supabase client", async () => {
    const adapter = createSupabaseAdapter(options);

    expect(adapter).toBeInstanceOf(SupabaseAdapter);
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "secret",
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    await adapter.listAgents();
    await adapter.listRuns({ agentId: "agent" });
    await adapter.getRunReport({ agentId: "agent" }, "run");
    await adapter.createRun({} as CreateRunInput);
    await adapter.beginEvent({} as BeginEventInput);
    await adapter.writeEventChunk({} as WriteEventChunkInput);
    await adapter.commitEvent({} as CommitEventInput);

    expect(mocks.listAgents).toHaveBeenCalledWith(expect.anything());
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

  it("reuses Supabase clients for the same URL and secret", () => {
    createSupabaseAdapter(options);
    createSupabaseAdapter(options);
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid constructor options before opening a client", () => {
    expect(
      () => new SupabaseAdapter({ url: "", secretKey: "secret" }),
    ).toThrow();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
