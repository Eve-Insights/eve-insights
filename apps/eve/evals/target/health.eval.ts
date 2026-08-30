import { defineEval } from "eve/evals";
import { matches, satisfies } from "eve/evals/expect";
import { healthSchema } from "#evals/shared.ts";

/**
 * The target itself, rather than a session.
 *
 * `t.target.fetch` performs an authenticated request against the target base
 * URL — the same credentials the session protocol uses — which is how you
 * exercise channel and webhook ingress from an eval.
 */
export default defineEval({
  description:
    "The agent's channel surface answers an authenticated health check.",
  tags: ["deterministic", "fast"],
  async test(t) {
    t.check(
      t.target.kind,
      satisfies(
        (kind: unknown) => kind === "local" || kind === "remote",
        "target kind is known",
      ),
    );
    t.check(
      t.target.url,
      satisfies(
        (url: unknown) => typeof url === "string" && url.startsWith("http"),
        "target has an http url",
      ),
    );

    const response = await t.target.fetch("/eve/v1/health");
    t.check(
      response.status,
      satisfies(
        (status: unknown) => status === 200,
        "health check returns 200",
      ),
    );

    t.check(await response.json(), matches(healthSchema)).label(
      "health payload shape",
    );
  },
});
