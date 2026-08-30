import type { UserConfig } from "@commitlint/types";

const scopes = [
  "insights",
  "web",
  "eve",
  "reporter",
  "repo",
  "ci",
  "deps",
  // Used by semantic-release's own version commits.
  "release",
];

/**
 * Angular commit convention. semantic-release derives every version bump and
 * changelog entry from these messages, so the format is enforced rather than
 * merely encouraged.
 */
const config: UserConfig = {
  extends: ["@commitlint/config-angular"],
  rules: {
    // The Angular preset omits `chore`, but semantic-release writes
    // `chore(release): x.y.z` commits and those must pass the CI check when a
    // release branch is merged.
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
    "scope-enum": [2, "always", scopes],
  },
  prompt: { scopes },
};

export default config;
