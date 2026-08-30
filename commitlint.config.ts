import type { UserConfig } from "@commitlint/types";

/**
 * Angular commit convention. semantic-release derives every version bump and
 * changelog entry from these messages, so the format is enforced rather than
 * merely encouraged.
 */
const config: UserConfig = {
  extends: ["@commitlint/config-angular"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["website", "docs", "platform", "agent", "reporter", "repo", "ci", "deps"],
    ],
    "subject-case": [2, "always", "lower-case"],
  },
  prompt: {
    scopes: ["website", "docs", "platform", "agent", "reporter", "repo", "ci", "deps"],
  },
};

export default config;
