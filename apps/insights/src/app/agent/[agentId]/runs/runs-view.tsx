import type {
  AgentRecord,
  AgentSelector,
  RunRecord,
} from "@eve-insights/adapter-types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDatabase } from "@/lib/database";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function AgentLoadError() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-400/20 dark:bg-amber-400/5">
      <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
        Agent details are temporarily unavailable
      </h2>
      <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200/80">
        Check the Insights database connection and refresh this page.
      </p>
    </div>
  );
}

function RunsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80"
        />
      ))}
    </div>
  );
}

function EmptyRuns() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        No runs reported
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        This agent has not sent any runs to this Insights instance yet.
      </p>
    </div>
  );
}

function RunStatus({ status }: { status: RunRecord["status"] }) {
  return (
    <span
      className={
        status === "running"
          ? "rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
          : "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
      }
    >
      {status === "running" ? "Running" : "Completed"}
    </span>
  );
}

async function RunList({
  agentId,
  runsPromise,
}: {
  agentId: string;
  runsPromise: Promise<readonly RunRecord[] | null>;
}) {
  const runs = await runsPromise;
  if (runs === null) return <AgentLoadError />;
  if (runs.length === 0) return <EmptyRuns />;

  return (
    <ol className="space-y-3">
      {runs.map((run) => (
        <li key={run.runId}>
          <Link
            href={`/agent/${agentId}/run/${encodeURIComponent(run.runId)}`}
            className="group block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/20"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <code className="block truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {run.runId}
                </code>
                <time
                  dateTime={run.startedAt}
                  className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400"
                >
                  Started {formatDate(run.startedAt)}
                </time>
              </div>
              <RunStatus status={run.status} />
            </div>

            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
              <div>
                <dt className="inline text-zinc-500 dark:text-zinc-400">
                  Evaluations{" "}
                </dt>
                <dd className="inline font-medium text-zinc-900 dark:text-zinc-100">
                  {run.evaluationCount}
                </dd>
              </div>
              <div>
                <dt className="inline text-zinc-500 dark:text-zinc-400">
                  Passed{" "}
                </dt>
                <dd className="inline font-medium text-zinc-900 dark:text-zinc-100">
                  {run.counts.passed}
                </dd>
              </div>
              <div>
                <dt className="inline text-zinc-500 dark:text-zinc-400">
                  Failed{" "}
                </dt>
                <dd className="inline font-medium text-zinc-900 dark:text-zinc-100">
                  {run.counts.failed}
                </dd>
              </div>
              {run.completedAt === undefined ? null : (
                <div>
                  <dt className="inline text-zinc-500 dark:text-zinc-400">
                    Completed{" "}
                  </dt>
                  <dd className="inline font-medium text-zinc-900 dark:text-zinc-100">
                    {formatDate(run.completedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export async function AgentRunsView({ agentId }: { agentId: string }) {
  const selector: AgentSelector = { agentId };

  let agents: readonly AgentRecord[];
  let runsPromise: Promise<readonly RunRecord[] | null>;
  try {
    const database = await getDatabase();
    runsPromise = database.listRuns(selector).catch((error) => {
      console.error("[eve-insights] failed to load runs", error);
      return null;
    });
    agents = await database.listAgents();
  } catch (error) {
    console.error("[eve-insights] failed to load agent details", error);
    return (
      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto min-h-full max-w-6xl px-6 py-8 sm:px-10 sm:py-12">
          <AgentLoadError />
        </div>
      </main>
    );
  }

  const agent = agents.find(
    (candidate) => candidate.agentId === selector.agentId,
  );
  if (agent === undefined) notFound();

  return (
    <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto min-h-full max-w-6xl px-6 py-8 sm:px-10 sm:py-12">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← All agents
        </Link>

        <header className="mt-8 border-b border-zinc-200 pb-10 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            Agent runs
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
                {agent.name}
              </h1>
              <p
                className="mt-4 truncate text-base text-zinc-600 dark:text-zinc-400"
                title={agent.url}
              >
                {agent.kind === "local" ? "Local agent" : "Remote agent"} ·{" "}
                {agent.url}
              </p>
            </div>
            <span className="shrink-0 self-start rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:self-auto">
              {agent.runCount} {agent.runCount === 1 ? "run" : "runs"}
            </span>
          </div>
        </header>

        <section aria-labelledby="runs-heading" className="py-10">
          <div className="mb-5">
            <h2
              id="runs-heading"
              className="text-xl font-semibold text-zinc-950 dark:text-white"
            >
              Recent runs
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sorted by start time, most recent first.
            </p>
          </div>
          <Suspense fallback={<RunsSkeleton />}>
            <RunList agentId={agent.agentId} runsPromise={runsPromise} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
