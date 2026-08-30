import type { GlobalConfig } from "semantic-release";

/**
 * Only `packages/reporter` is published. Every app in this repo is private, so
 * `pkgRoot` keeps semantic-release pointed at the one publishable package while
 * still reading commit history from the repository root.
 */

/**
 * `main` is covered by a ruleset that requires pull requests and cannot grant
 * the GitHub Actions app a bypass, so nothing may push to it directly. The
 * changelog and version commit therefore run only on `release/*` branches,
 * which are unprotected, and reach `main` through the normal release PR.
 */
const branch = process.env.GITHUB_REF_NAME ?? "";
const commitsChangelog = branch.startsWith("release/");

const changelogPlugins: GlobalConfig["plugins"] = [
  ["@semantic-release/changelog", { changelogFile: "packages/reporter/CHANGELOG.md" }],
];

const gitPlugin: GlobalConfig["plugins"] = [
  [
    "@semantic-release/git",
    {
      assets: ["packages/reporter/CHANGELOG.md", "packages/reporter/package.json"],
      // Not a template literal: semantic-release interpolates these itself.
      // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
      message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
    },
  ],
];

const config: GlobalConfig = {
  // gitflow: main carries stable releases, develop and release/* publish
  // prereleases under their own dist-tags so nothing lands on `latest` early.
  branches: [
    "main",
    { name: "release/*", channel: "rc", prerelease: "rc" },
    { name: "develop", channel: "beta", prerelease: "beta" },
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ...(commitsChangelog ? changelogPlugins : []),
    ["@semantic-release/npm", { pkgRoot: "packages/reporter" }],
    [
      "@semantic-release/github",
      {
        // A failed release is already visible as a red Actions run; opening an
        // issue for it just adds noise (and fails outright unless a
        // `semantic-release` label exists in the repo).
        failComment: false,
        failTitle: false,
      },
    ],
    ...(commitsChangelog ? gitPlugin : []),
  ],
};

export default config;
