import Link from "next/link";
import { appName, docsRoute, gitConfig } from "@/lib/shared";

const features = [
  {
    title: "Own the results",
    body: "Evals report to a platform you host, so run history never leaves infrastructure you control.",
  },
  {
    title: "Drop-in reporter",
    body: "Add @eve-insights/reporter to an existing Eve project and results ship on the next run.",
  },
  {
    title: "Quality over time",
    body: "Every run is kept, so a regression shows up as a trend rather than a single red build.",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-6 py-24 sm:py-32">
        <span className="rounded-full border border-fd-border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
          Foundation — the product is still being built
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Telemetry and reporting for Eve agent evals
        </h1>
        <p className="max-w-xl text-lg text-fd-muted-foreground text-pretty">
          {appName} is Sorry Cypress, but for{" "}
          <a
            href="https://eve.dev"
            className="font-medium text-fd-foreground underline underline-offset-4"
          >
            Eve
          </a>
          . Run your evals, ship the results somewhere you own, and see how your agent&rsquo;s
          quality moves over time.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={docsRoute}
            className="rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Read the docs
          </Link>
          <a
            href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            className="rounded-full border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            GitHub
          </a>
        </div>
      </section>
      <section className="border-t border-fd-border">
        <div className="mx-auto grid w-full max-w-3xl gap-8 px-6 py-16 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">{feature.title}</h2>
              <p className="text-sm text-fd-muted-foreground text-pretty">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
