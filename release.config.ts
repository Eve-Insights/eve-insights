import type { GlobalConfig } from "semantic-release";

/**
 * Only `packages/reporter` is published. Every app in this repo is private, so
 * `pkgRoot` keeps semantic-release pointed at the one publishable package while
 * still reading commit history from the repository root.
 */
const config: GlobalConfig = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", { changelogFile: "packages/reporter/CHANGELOG.md" }],
    ["@semantic-release/npm", { pkgRoot: "packages/reporter" }],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        assets: ["packages/reporter/CHANGELOG.md", "packages/reporter/package.json"],
        // Not a template literal: semantic-release interpolates these itself.
        // biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release syntax
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};

export default config;
