/** Version of the JSON protocol used between the reporter and Insights. */
export const INSIGHTS_PROTOCOL_VERSION = 2 as const;

export type WireJsonPrimitive = boolean | number | string | null;
export type WireJsonValue =
  | WireJsonPrimitive
  | WireJsonObject
  | WireJsonValue[];
export type WireJsonObject = {
  readonly [key: string]: WireJsonValue;
};

export type WireEventType =
  | "run.started"
  | "eval.started"
  | "session.started"
  | "eval.completed"
  | "run.completed";

export interface WireTarget {
  readonly agentId: string;
  readonly kind: "local" | "remote";
  readonly url: string;
  readonly name: string;
  readonly capabilities: {
    readonly devRoutes: boolean;
  };
}

export interface WireEvaluationRegistration {
  readonly id: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly timeoutMs?: number;
}

export interface WireEvaluationSnapshot extends WireEvaluationRegistration {
  readonly metadata?: WireJsonObject;
  readonly judge?: WireJsonValue;
}

export interface WireRunStartPayload {
  readonly runId: string;
  readonly startedAt: string;
  readonly target: WireTarget;
  readonly evaluations: readonly WireEvaluationSnapshot[];
}

export interface WireEvalStartPayload {
  readonly evaluation: WireEvaluationSnapshot;
  readonly startedAt: string;
  readonly target: WireTarget;
}

export interface WireSessionStartPayload {
  readonly evaluation: WireEvaluationSnapshot;
  readonly startedAt: string;
  readonly target: WireTarget;
  readonly primary: boolean;
  readonly sessionId: string;
  readonly traceContext: WireJsonObject;
}

export interface WireEvalCompletePayload {
  readonly evaluation?: WireEvaluationSnapshot;
  readonly target?: WireTarget;
  readonly traceContexts: readonly WireJsonValue[];
  readonly result: WireJsonValue;
  readonly context?: WireJsonObject;
}

export interface WireRunCompletePayload {
  readonly target: WireTarget;
  readonly counts: WireJsonObject;
  readonly evaluationIds: readonly string[];
}

export interface WirePayloadManifest {
  readonly encoding: "gzip";
  readonly contentType: "application/json";
  readonly byteLength: number;
  readonly chunkSize: number;
  readonly chunkCount: number;
  readonly sha256: string;
}

export interface WireRunCreateRequest {
  readonly version: typeof INSIGHTS_PROTOCOL_VERSION;
  readonly action: "run.create";
  readonly runId: string;
  readonly startedAt: string;
  readonly target: WireTarget;
  readonly evaluations: readonly WireEvaluationRegistration[];
}

export interface WireEventBeginRequest {
  readonly version: typeof INSIGHTS_PROTOCOL_VERSION;
  readonly action: "event.begin";
  readonly eventId: string;
  readonly sequence: number;
  readonly type: WireEventType;
  readonly occurredAt: string;
  readonly projection: WireJsonObject;
  readonly payload: WirePayloadManifest;
}

export interface WireEventChunkRequest {
  readonly version: typeof INSIGHTS_PROTOCOL_VERSION;
  readonly action: "event.chunk";
  readonly eventId: string;
  readonly index: number;
  readonly data: string;
}

export interface WireEventCommitRequest {
  readonly version: typeof INSIGHTS_PROTOCOL_VERSION;
  readonly action: "event.commit";
  readonly eventId: string;
}

export type WireEventPayload =
  | WireRunStartPayload
  | WireEvalStartPayload
  | WireSessionStartPayload
  | WireEvalCompletePayload
  | WireRunCompletePayload;
