import type {
  AgentSelector,
  EvaluationRecord,
  RunRecord,
  RunReport,
} from "@eve-insights/adapter-types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/database";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function parseRunId(runId: string): string | undefined {
  return runId.length > 0 && runId.length <= 256 && !runId.includes("/")
    ? runId
    : undefined;
}

function ReportLoadError() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-400/20 dark:bg-amber-400/5">
      <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
        Run report is temporarily unavailable
      </h2>
      <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200/80">
        Check the Insights database connection and refresh this page.
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

function EvaluationStatus({ evaluation }: { evaluation: EvaluationRecord }) {
  const failed = evaluation.verdict === "failed";
  const completed = evaluation.status === "completed";
  return (
    <span
      className={
        failed
          ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-400/10 dark:text-red-300"
          : completed
            ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
            : "rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
      }
    >
      {evaluation.verdict ?? evaluation.status}
    </span>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/20">
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </dd>
    </div>
  );
}

function RunSummary({ run }: { run: RunRecord }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <SummaryStat label="Evaluations" value={run.counts.total} />
      <SummaryStat label="Passed" value={run.counts.passed} />
      <SummaryStat label="Failed" value={run.counts.failed} />
      <SummaryStat label="Scored" value={run.counts.scored} />
      <SummaryStat label="Skipped" value={run.counts.skipped} />
      <SummaryStat label="Errors" value={run.counts.errored} />
    </dl>
  );
}

function EmptyEvaluations() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        No evaluations reported
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        This run did not include any evaluation results.
      </p>
    </div>
  );
}

function EvaluationRow({ evaluation }: { evaluation: EvaluationRecord }) {
  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <code className="block truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
            {evaluation.id}
          </code>
          {evaluation.description === undefined ? null : (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {evaluation.description}
            </p>
          )}
        </div>
        <EvaluationStatus evaluation={evaluation} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
        {evaluation.assertionCount === undefined ? null : (
          <p className="text-zinc-500 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {evaluation.passedAssertionCount ?? 0}/{evaluation.assertionCount}
            </span>{" "}
            assertions passed
          </p>
        )}
        {evaluation.startedAt === undefined ? null : (
          <p className="text-zinc-500 dark:text-zinc-400">
            Started{" "}
            <time
              className="text-zinc-700 dark:text-zinc-300"
              dateTime={evaluation.startedAt}
            >
              {formatDate(evaluation.startedAt)}
            </time>
          </p>
        )}
        {evaluation.completedAt === undefined ? null : (
          <p className="text-zinc-500 dark:text-zinc-400">
            Completed{" "}
            <time
              className="text-zinc-700 dark:text-zinc-300"
              dateTime={evaluation.completedAt}
            >
              {formatDate(evaluation.completedAt)}
            </time>
          </p>
        )}
      </div>

      {evaluation.error === undefined ? null : (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200">
          {evaluation.error}
        </p>
      )}
      {evaluation.skipReason === undefined ? null : (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Skipped: {evaluation.skipReason}
        </p>
      )}
    </li>
  );
}

function EvaluationList({
  evaluations,
}: {
  evaluations: readonly EvaluationRecord[];
}) {
  if (evaluations.length === 0) return <EmptyEvaluations />;

  return (
    <ol className="space-y-3">
      {evaluations.map((evaluation) => (
        <EvaluationRow key={evaluation.id} evaluation={evaluation} />
      ))}
    </ol>
  );
}

export async function RunReportView({
  agentId,
  runId,
}: {
  agentId: string;
  runId: string;
}) {
  const validRunId = parseRunId(runId);
  if (validRunId === undefined) notFound();
  const selector: AgentSelector = { agentId };

  let report: RunReport | undefined;
  try {
    report = await (await getDatabase()).getRunReport(selector, validRunId);
  } catch (error) {
    console.error("[eve-insights] failed to load run report", error);
    return (
      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto min-h-full max-w-6xl px-6 py-8 sm:px-10 sm:py-12">
          <ReportLoadError />
        </div>
      </main>
    );
  }

  if (report === undefined) notFound();
  const { run, evaluations } = report;

  return (
    <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto min-h-full max-w-6xl px-6 py-8 sm:px-10 sm:py-12">
        <Link
          href={`/agent/${agentId}/runs`}
          className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Agent runs
        </Link>

        <header className="mt-8 border-b border-zinc-200 pb-10 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            Run report
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
                {run.name}
              </h1>
              <code className="mt-3 block truncate text-sm text-zinc-500 dark:text-zinc-400">
                {run.runId}
              </code>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Started {formatDate(run.startedAt)}
                {run.completedAt === undefined
                  ? null
                  : ` · Completed ${formatDate(run.completedAt)}`}
              </p>
            </div>
            <RunStatus status={run.status} />
          </div>
        </header>

        <section aria-labelledby="summary-heading" className="py-10">
          <h2 id="summary-heading" className="sr-only">
            Run summary
          </h2>
          <RunSummary run={run} />
        </section>

        <section aria-labelledby="evaluations-heading" className="pb-10">
          <div className="mb-5">
            <h2
              id="evaluations-heading"
              className="text-xl font-semibold text-zinc-950 dark:text-white"
            >
              Evaluations
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Results and assertion details for this run.
            </p>
          </div>
          <EvaluationList evaluations={evaluations} />
        </section>
      </div>
    </main>
  );
}
