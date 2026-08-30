import { gunzipSync } from "node:zlib";
import type {
  EveEval,
  EveEvalResult,
  EveEvalRunSummary,
  EveEvalTarget,
} from "eve/evals";
import { describe, expect, it } from "vitest";
import { InsightsReporter, PACKAGE_NAME } from "./index.js";

describe("@eve-insights/reporter", () => {
  it("exposes its package name", () => {
    expect(PACKAGE_NAME).toBe("@eve-insights/reporter");
  });

  it("delivers the full reporter lifecycle in sequence", async () => {
    const requests: { url: string; body: Record<string, unknown> }[] = [];
    const fetch = async (
      url: string,
      init?: RequestInit,
    ): Promise<Response> => {
      requests.push({
        url,
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(null, { status: 200 });
    };
    const reporter = new InsightsReporter({
      url: "http://localhost:3000/",
      agentName: "Weather Station Agent",
      fetch,
      retries: 0,
      chunkSizeBytes: 64,
    });
    const evaluation = makeEvaluation();
    const target = makeTarget();

    await reporter.onRunStart([evaluation], target);
    await reporter.onEvalStart({
      evaluation,
      startedAt: "2026-08-30T00:00:01.000Z",
      target,
    });
    await reporter.onSessionStart({
      evaluation,
      startedAt: "2026-08-30T00:00:02.000Z",
      target,
      primary: true,
      sessionId: "session-1",
      traceContext: { traceId: "trace-1", spanId: "span-1", traceFlags: 1 },
    });
    await reporter.onEvalComplete(makeResult(), {
      evaluation,
      target,
      traceContexts: [
        {
          traceId: "trace-1",
          spanId: "span-1",
          traceFlags: 1,
          primary: true,
          sessionId: "session-1",
        },
      ],
    });
    await reporter.onRunComplete(makeSummary(target));

    const begins = requests
      .filter((request) => request.body.action === "event.begin")
      .map((request) => request.body.type);
    expect(begins).toEqual([
      "run.started",
      "eval.started",
      "session.started",
      "eval.completed",
      "run.completed",
    ]);
    expect(
      begins.every((_, index) =>
        requests.some((request) => request.body.sequence === index),
      ),
    ).toBe(true);
    expect(requests[0]?.body.action).toBe("run.create");
    expect(requests[0]?.url).toBe("http://localhost:3000/api/v1/runs");
    expect(requests[0]?.body.target).toMatchObject({
      name: "Weather Station Agent",
      agentId: expect.stringMatching(
        /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      ),
    });
    expect(gunzipEvent(requests, "run.completed")).toMatchObject({
      payload: {
        evaluationIds: ["weather/0000"],
        counts: {
          total: 1,
          passed: 1,
          failed: 0,
          scored: 0,
          skipped: 0,
          errored: 0,
        },
      },
    });
    expect(
      JSON.stringify(gunzipEvent(requests, "run.completed")),
    ).not.toContain('"results"');
  });

  it("warns and continues when the platform is unavailable", async () => {
    const warnings: string[] = [];
    const reporter = new InsightsReporter({
      url: "http://localhost:3000",
      agentName: "Weather Station Agent",
      retries: 0,
      warn: (message) => warnings.push(message),
      fetch: async () => new Response("offline", { status: 503 }),
    });

    await expect(
      reporter.onRunStart([makeEvaluation()], makeTarget()),
    ).resolves.toBeUndefined();
    await expect(
      reporter.onEvalComplete(makeResult()),
    ).resolves.toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("does not reject when result output contains an invalid Date", async () => {
    const warnings: string[] = [];
    const reporter = new InsightsReporter({
      url: "http://localhost:3000",
      agentName: "Weather Station Agent",
      retries: 0,
      warn: (message) => warnings.push(message),
      fetch: async () => new Response(null, { status: 200 }),
    });
    const result = makeResult();
    (result.result as { output: unknown }).output = new Date(Number.NaN);

    await reporter.onRunStart([makeEvaluation()], makeTarget());
    await expect(reporter.onEvalComplete(result)).resolves.toBeUndefined();
    expect(warnings).toEqual([]);
  });

  it("does not send judge model secrets", async () => {
    const requests: Record<string, unknown>[] = [];
    const reporter = new InsightsReporter({
      url: "http://localhost:3000",
      agentName: "Weather Station Agent",
      retries: 0,
      fetch: async (_url, init) => {
        requests.push(
          JSON.parse(String(init?.body)) as Record<string, unknown>,
        );
        return new Response(null, { status: 200 });
      },
    });
    const evaluation = {
      ...makeEvaluation(),
      judge: {
        model: {
          modelId: "anthropic/claude-haiku-4.5",
          config: { apiKey: "sk-secret" },
        },
      },
    } as EveEval;

    await reporter.onRunStart([evaluation], makeTarget());
    await reporter.onEvalStart({
      evaluation,
      startedAt: "2026-08-30T00:00:01.000Z",
      target: makeTarget(),
    });

    expect(
      JSON.stringify(gunzipEventFromBodies(requests, "run.started")),
    ).not.toContain("sk-secret");
    expect(
      JSON.stringify(gunzipEventFromBodies(requests, "eval.started")),
    ).not.toContain("apiKey");
    expect(gunzipEventFromBodies(requests, "eval.started")).toMatchObject({
      payload: {
        evaluation: {
          judge: { model: "anthropic/claude-haiku-4.5" },
        },
      },
    });
  });

  it("does not retry 400 responses", async () => {
    let eventBeginCalls = 0;
    const reporter = new InsightsReporter({
      url: "http://localhost:3000",
      agentName: "Weather Station Agent",
      retries: 2,
      retryDelayMs: 0,
      warn: () => {},
      fetch: async (url) => {
        if (url.endsWith("/events")) {
          eventBeginCalls += 1;
          return new Response("bad", { status: 400 });
        }
        return new Response(null, { status: 200 });
      },
    });

    await reporter.onRunStart([makeEvaluation()], makeTarget());
    expect(eventBeginCalls).toBe(1);
  });

  it("retries 503 responses", async () => {
    let eventBeginCalls = 0;
    const reporter = new InsightsReporter({
      url: "http://localhost:3000",
      agentName: "Weather Station Agent",
      retries: 2,
      retryDelayMs: 0,
      warn: () => {},
      fetch: async (url) => {
        if (url.endsWith("/events")) {
          eventBeginCalls += 1;
          return new Response("offline", { status: 503 });
        }
        return new Response(null, { status: 200 });
      },
    });

    await reporter.onRunStart([makeEvaluation()], makeTarget());
    expect(eventBeginCalls).toBe(3);
  });

  it("aborts hung fetches", async () => {
    const warnings: string[] = [];
    const reporter = new InsightsReporter({
      url: "http://localhost:3000",
      agentName: "Weather Station Agent",
      retries: 0,
      timeoutMs: 20,
      warn: (message) => warnings.push(message),
      fetch: async (_url, init) => {
        await new Promise<void>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
        return new Response(null, { status: 200 });
      },
    });

    await expect(
      reporter.onRunStart([makeEvaluation()], makeTarget()),
    ).resolves.toBeUndefined();
    expect(warnings.length).toBeGreaterThan(0);
  });
});

function makeTarget(): EveEvalTarget {
  return {
    kind: "local",
    url: "http://localhost:3002",
    capabilities: { devRoutes: true },
  };
}

function makeEvaluation(): EveEval {
  return {
    _tag: "EveEval",
    id: "weather/0000",
    description: "Gets the weather",
    tags: ["smoke"],
    metadata: { city: "London" },
    test: async () => {},
  } as EveEval;
}

function makeResult(): EveEvalResult {
  return {
    id: "weather/0000",
    result: {
      output: { temperature: 18 },
      finalMessage: "Sunny",
      status: "completed",
      events: [],
      derived: {
        toolCalls: [],
        toolCallCount: 0,
        subagentCalls: [],
        subagentCallCount: 0,
        inputRequests: [],
        parked: false,
        messageCount: 1,
        reasoningBlockCount: 0,
      },
      traceContexts: [],
    },
    assertions: [
      {
        name: "succeeded",
        score: 1,
        severity: "gate",
        passed: true,
      },
    ],
    verdict: "passed",
    startedAt: "2026-08-30T00:00:01.000Z",
    completedAt: "2026-08-30T00:00:03.000Z",
  };
}

function makeSummary(target: EveEvalTarget): EveEvalRunSummary {
  return {
    target,
    results: [makeResult()],
    startedAt: "2026-08-30T00:00:00.000Z",
    completedAt: "2026-08-30T00:00:04.000Z",
    passed: 1,
    failed: 0,
    scored: 0,
    skipped: 0,
    errored: 0,
  };
}

function gunzipEvent(
  requests: readonly { body: Record<string, unknown> }[],
  type: string,
): unknown {
  return gunzipEventFromBodies(
    requests.map((request) => request.body),
    type,
  );
}

function gunzipEventFromBodies(
  bodies: readonly Record<string, unknown>[],
  type: string,
): unknown {
  const beginIndex = bodies.findIndex(
    (body) => body.action === "event.begin" && body.type === type,
  );
  expect(beginIndex).toBeGreaterThan(-1);
  const begin = bodies[beginIndex];
  const eventId = begin?.eventId;
  const chunks = bodies.flatMap((body) =>
    body.action === "event.chunk" && body.eventId === eventId
      ? [String(body.data)]
      : [],
  );
  const bytes = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk, "base64")),
  );
  return JSON.parse(gunzipSync(bytes).toString("utf8")) as unknown;
}
