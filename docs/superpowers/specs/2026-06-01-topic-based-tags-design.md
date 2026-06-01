# Topic-Based Tag System — Design Spec

**Date:** 2026-06-01
**Status:** Approved

## Goal

Replace the hand-coded language/framework hierarchy with a tag system driven by GitHub repository topics. The back-face filter becomes accurate and maintainable without manual overrides.

## Problem with Current System

- Tags come from GitHub primary language → hardcoded `LANGUAGE_TO_LEAF` map
- Animation and design repos (52 repos) have `HTML` or `CSS` as primary language → no useful tag
- `developer-tool`, `cli`, `bot`, `ai` repos are not consistently tagged
- Hierarchy has unused tags (adtech, nextjs, gcp) with zero matching repos

## New Tag System

### Hierarchy (domain-only, language axis removed)

```
Domain
  └ Creative
      └ design    (id: "design")
      └ animation (id: "animation")
  └ Product
      └ web       (id: "web")
      └ mobile    (id: "mobile")
      └ desktop   (id: "desktop")
  └ Engineering
      └ tool      (id: "tool")
      └ ai        (id: "ai")
      └ backend   (id: "backend")
```

### Topic → Tag Mapping (`topicTags` in card-config.json)

```json
{
  "design":              ["design"],
  "design-study":        ["design"],
  "web-design":          ["design"],
  "animation":           ["animation"],
  "css-animation":       ["animation"],
  "css-3d":              ["animation"],
  "web-app":             ["web"],
  "frontend":            ["web"],
  "spa":                 ["web"],
  "static-site":         ["web"],
  "landing-page":        ["web"],
  "ssg":                 ["web"],
  "visualization":       ["web"],
  "flutter":             ["mobile"],
  "mobile-app":          ["mobile"],
  "dart":                ["mobile"],
  "android":             ["mobile"],
  "ios":                 ["mobile"],
  "desktop-app":         ["desktop"],
  "tauri":               ["desktop"],
  "wails":               ["desktop"],
  "electron-alternative":["desktop"],
  "developer-tool":      ["tool"],
  "cli":                 ["tool"],
  "automation":          ["tool"],
  "utility":             ["tool"],
  "bot":                 ["tool"],
  "script":              ["tool"],
  "ai":                  ["ai"],
  "llm":                 ["ai"],
  "generative-ai":       ["ai"],
  "claude-code":         ["ai"],
  "claude-skill":        ["ai"],
  "gpt":                 ["ai"],
  "full-stack":          ["backend"],
  "backend":             ["backend"],
  "database":            ["backend"],
  "devops":              ["backend"],
  "docker":              ["backend"],
  "api":                 ["backend"],
  "microservice":        ["backend"],
  "rest":                ["backend"]
}
```

## Architecture

### Data flow

```
GitHub API  ──topics[]──▶  fetchRepos.ts  ──GitHubRepo.topics──▶  mergeConfig.ts
                                                                         │
                                                         topicTags (card-config.json)
                                                                         │
                                                                  Repo.tags[]  ──▶  card-filter.ts
```

### Tag assembly order in `toRepo` (replaces old `LANGUAGE_TO_LEAF`)

1. `topicTags` lookup: `repo.topics.flatMap(t => topicTags[t] ?? [])`
2. `repoOverrides[repo.full_name].tags` (manual overrides — still supported)
3. `namePrefixTags` rules (still supported for `design-` prefix fallback)
4. Union + deduplicate

`LANGUAGE_TO_LEAF` is removed entirely.

## File Changes

| File | Change |
|------|--------|
| `src/types/card.ts` | Add `topicTags?: Record<string, string[]>` to `CardConfig`; add `topics: string[]` to `GitHubRepo` re-export is not needed — stays in fetchRepos.ts |
| `src/lib/fetchRepos.ts` | Add `topics: string[]` to `GitHubRepo` interface |
| `src/lib/mergeConfig.ts` | Remove `LANGUAGE_TO_LEAF`; add topic tag lookup in `toRepo`; pass `topicTags` through |
| `card-config.json` | Replace hierarchy with new 3-category structure; add `topicTags`; remove unused `namePrefixTags` entry for `design-` (now redundant — keep for safety) |
| `src/lib/mergeConfig.test.ts` | Add `topics: []` to `mkRaw`; replace language-tag tests with topic-tag tests |
| `src/lib/fetchRepos.test.ts` | Add `topics: []` to `mkRepo` |

## Expected Coverage

| Tag | Repos |
|-----|-------|
| design | 35 (all design-* repos) |
| animation | 17 (all animation-* repos) |
| tool | 20+ (dev tools, CLI, bots) |
| web | 13+ (web apps, frontends) |
| backend | 6+ (full-stack, Docker, APIs) |
| desktop | 3 (nexus-sticky, snaptick, java-game) |
| mobile | 2+ (freeslot-allocator, reachtrail) |
| ai | 2+ (llm-calendar, skills repos) |

## Out of Scope

- Language-based filtering (removed by design)
- Multi-tag repos appearing in multiple filter results simultaneously (already supported by existing card-filter.ts)
- `generate-qrs.ts` changes (still generates per-leaf QRs from hierarchy — will adapt automatically)
