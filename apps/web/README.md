# @eve-insights/web

The public face of Eve Insights: the marketing landing page and the documentation,
served by one [fumadocs](https://fumadocs.dev) app on port 3001.

```bash
pnpm --filter @eve-insights/web dev
```

## Layout

| Path | Description |
| --- | --- |
| `src/app/(home)` | Landing page and any other marketing pages |
| `src/app/docs` | Documentation layout and pages |
| `content/docs` | The MDX the docs are generated from |
| `src/app/api/search/route.ts` | Route handler backing docs search |
| `src/lib/shared.ts` | App name, GitHub coordinates, and the docs route prefix |
| `src/lib/source.ts` | Content source adapter — [`loader()`](https://fumadocs.dev/docs/headless/source-api) |
| `src/lib/layout.shared.tsx` | Options shared by the home and docs layouts |

Collections are defined with the [Macro API](https://fumadocs.dev/docs/mdx/macro) in
`src/lib/source.ts`; see the [fumadocs MDX introduction](https://fumadocs.dev/docs/mdx)
for details.

Routes under `llms.txt`, `llms-full.txt` and `llms.mdx` expose the docs as plain
markdown for LLMs, and `proxy.ts` rewrites `/docs/*` to them when a client asks
for markdown via `Accept`.
