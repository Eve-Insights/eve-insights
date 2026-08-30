import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, docsRoute, gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: appName,
    },
    links: [
      {
        text: "Documentation",
        url: docsRoute,
        active: "nested-url",
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
