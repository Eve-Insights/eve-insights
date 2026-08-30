import type { GlobalConfig } from "semantic-release";

/**
 * Only `packages/reporter` is published. Every app in this repo is private, so
 * `pkgRoot` keeps semantic-release pointed at the one publishable package while
 * still reading commit history from the repository root.
 */

/**
 * Both `release/*` and `main` commit the changelog and version, so the
 * checked-in `package.json` always matches what that branch published:
 * `release/*` records the prerelease (`0.2.0-rc.1`), `main` the stable `0.2.0`.
 *
 * `release/*` is unprotected, so its push needs nothing special. `main`
 * requires pull requests, and the GitHub Actions app cannot be a ruleset bypass
 * actor (the API refuses it — "must be part of the ruleset source or owner
 * organization"), so GITHUB_TOKEN cannot push there. The release job therefore
 * checks out with a write deploy key, which *is* registered as a bypass actor
 * on the `Main` ruleset. Removing that key or the `ssh-key:` line in `ci.yml`
 * breaks the push, and it fails *after* the npm publish has already happened.
 *
 * `develop` is excluded deliberately: it publishes a beta on every merge, and
 * committing a bump each time would churn the branch and fight the back-merge.
 */
const branch = process.env.GITHUB_REF_NAME ?? "";
const commitsChangelog = branch.startsWith("release/") || branch === "main";

const changelogPlugins: GlobalConfig["plugins"] = [
  [
    "@semantic-release/changelog",
    { changelogFile: "packages/reporter/CHANGELOG.md" },
  ],
];

const gitPlugin: GlobalConfig["plugins"] = [
  [
    "@semantic-release/git",
    {
      assets: [
        "packages/reporter/CHANGELOG.md",
        "packages/reporter/package.json",
      ],
      // Deliberately no `[skip ci]`. GitHub applies skip directives to
      // pull_request as well as push, and this commit becomes the tip of the
      // release branch — so skipping would leave the required `CI` check on the
      // release PR pending forever, and GitHub blocks a merge on a required
      // check that never reports. The re-triggered run is harmless: the only
      // new commit is this `chore`, which the Angular preset does not release,
      // so it publishes nothing and no further run is triggered.
      // Not a template literal: semantic-release interpolates these itself.
      // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
      message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}",
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
