import type { AgentRecord } from "@eve-insights/adapter-types";
import Link from "next/link";
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

function AgentCard({ agent }: { agent: AgentRecord }) {
  return (
    <Link
      href={{
        pathname: `/agent/${agent.agentId}/runs`,
      }}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 transition-shadow group-hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-400/10">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px] shadow-emerald-500/15 dark:bg-emerald-400 dark:shadow-emerald-400/20"
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-medium text-zinc-950 dark:text-zinc-50">
                {agent.name ?? "Unnamed agent"}
              </h3>
              <p
                className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400"
                title={agent.url}
              >
                {agent.kind === "local" ? "Local agent" : "Remote agent"} ·{" "}
                {agent.url}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            {agent.lastRunStatus === "running" ? "Running" : "Completed"}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Runs
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {agent.runCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Evaluations
            </dt>
            <dd className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {agent.evaluationCount}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
          Latest run{" "}
          <time
            dateTime={agent.lastRunStartedAt}
            className="text-zinc-700 dark:text-zinc-300"
          >
            {formatDate(agent.lastRunStartedAt)}
          </time>
        </p>
      </article>
    </Link>
  );
}

function AgentListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="h-52 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80"
        />
      ))}
    </div>
  );
}

function EmptyAgents() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <svg
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          className="size-6"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 6.75h7.5m-9 3h10.5m-9 3h10.5m-9 3h6"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.25 3.75h13.5A1.5 1.5 0 0 1 20.25 5.25v13.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5Z"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        No agents reported yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        Once an Eve eval suite sends telemetry to this Insights instance, its
        agent will appear here.
      </p>
    </div>
  );
}

function AgentLoadError() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-400/20 dark:bg-amber-400/5">
      <h3 className="text-base font-semibold text-amber-950 dark:text-amber-100">
        Agents are temporarily unavailable
      </h3>
      <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200/80">
        Check the Insights database connection and refresh this page.
      </p>
    </div>
  );
}

async function AgentList() {
  let agents: readonly AgentRecord[];
  try {
    agents = await (await getDatabase()).listAgents();
  } catch (error) {
    console.error("[eve-insights] failed to load agents", error);
    return <AgentLoadError />;
  }

  if (agents.length === 0) return <EmptyAgents />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {agents.map((agent) => (
        <AgentCard key={agent.agentId} agent={agent} />
      ))}
    </div>
  );
}

export function HomeView() {
  return (
    <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto min-h-full max-w-6xl px-6 py-8 sm:px-10 sm:py-12">
        <header className="flex flex-col gap-8 border-b border-zinc-200 pb-10 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 font-mono text-xs text-white dark:bg-white dark:text-zinc-950">
                E
              </span>
              Eve Insights
            </div>
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Overview
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
              Your agents
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              See the agents sending eval telemetry to this Insights instance.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:self-auto">
            <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            Live telemetry
          </div>
        </header>

        <section aria-labelledby="agents-heading" className="py-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2
                id="agents-heading"
                className="text-xl font-semibold text-zinc-950 dark:text-white"
              >
                Reporting agents
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Grouped by the agent name configured in each reporter.
              </p>
            </div>
          </div>
          <Suspense fallback={<AgentListSkeleton />}>
            <AgentList />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
