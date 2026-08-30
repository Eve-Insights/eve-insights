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
  Firestore: vi.fn(),
  listAgents: vi.fn(),
  listRuns: vi.fn(),
  getRunReport: vi.fn(),
  createRun: vi.fn(),
  beginEvent: vi.fn(),
  writeEventChunk: vi.fn(),
  commitEvent: vi.fn(),
}));

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

vi.mock("@google-cloud/firestore", () => ({
  Firestore: mocks.Firestore,
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
  clearFirestoreClientCache,
  createFirestoreAdapter,
  FirestoreAdapter,
} from "./adapter.js";

const options = {
  projectId: "test-project",
  maxChunkBytes: 128,
};

describe("adapter", () => {
  afterEach(() => {
    clearFirestoreClientCache();
    vi.clearAllMocks();
  });

  it("constructs through the factory and delegates the adapter contract", async () => {
    const adapter = createFirestoreAdapter(options);
    expect(adapter).toBeInstanceOf(FirestoreAdapter);
    expect(mocks.Firestore).toHaveBeenCalledWith({
      projectId: "test-project",
    });

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

  it("reuses Firestore clients for the same project identity", () => {
    createFirestoreAdapter(options);
    createFirestoreAdapter(options);
    expect(mocks.Firestore).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid constructor options before opening a client", () => {
    expect(() => new FirestoreAdapter({ projectId: "" })).toThrow();
    expect(mocks.Firestore).not.toHaveBeenCalled();
  });
});
