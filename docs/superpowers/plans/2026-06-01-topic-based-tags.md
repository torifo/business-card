# Topic-Based Tag System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded language→tag mapping with a GitHub-topics-driven system so the back-face filter accurately reflects all 66 public repos.

**Architecture:** Add `topics: string[]` to `GitHubRepo` (it already exists in the GitHub API response). Add `topicTags: Record<string, string[]>` to `CardConfig`. In `mergeConfig.toRepo`, look up each topic in `topicTags` and union the results. Remove `LANGUAGE_TO_LEAF`. Update `card-config.json` with a new domain-only hierarchy (Creative / Product / Engineering) and the full topic→tag mapping.

**Tech Stack:** TypeScript, Astro SSG, Vitest, existing `src/lib/mergeConfig.ts` + `src/lib/fetchRepos.ts`.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/lib/fetchRepos.ts` | Modify | Add `topics: string[]` to `GitHubRepo` interface |
| `src/types/card.ts` | Modify | Add `topicTags?: Record<string, string[]>` to `CardConfig` |
| `src/lib/mergeConfig.ts` | Modify | Remove `LANGUAGE_TO_LEAF`; add topic lookup in `toRepo`; pass `topicTags` through `mergeConfig` |
| `src/lib/mergeConfig.test.ts` | Modify | Add `topics` to `mkRaw`; replace language tests with topic tests; add `topicTags` tests |
| `src/lib/fetchRepos.test.ts` | Modify | Add `topics: []` to `mkRepo` helper |
| `card-config.json` | Modify | Replace hierarchy; add `topicTags` mapping |

---

### Task 1: Add `topics` to types and test fixtures

**Files:**
- Modify: `src/lib/fetchRepos.ts` (line 12–23)
- Modify: `src/types/card.ts` (CardConfig interface)
- Modify: `src/lib/mergeConfig.test.ts` (mkRaw helper)
- Modify: `src/lib/fetchRepos.test.ts` (mkRepo helper)

- [ ] **Step 1: Add `topics` to `GitHubRepo`**

In `src/lib/fetchRepos.ts`, find the `GitHubRepo` interface and add `topics`:

```ts
export interface GitHubRepo {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
  private: boolean;
  topics: string[];
}
```

- [ ] **Step 2: Add `topicTags` to `CardConfig`**

In `src/types/card.ts`, find `CardConfig` and add the optional field after `namePrefixTags`:

```ts
export interface CardConfig {
  profile: Profile;
  geo: Geo;
  hierarchy: HierarchyNode[];
  repoOverrides: Record<string, RepoOverride>;
  excludeRepos: string[];
  pinnedRepos: string[];
  namePrefixTags?: Record<string, string>;
  /**
   * GitHub topic name → tag ID[] のマッピング。
   * 例: `{ "cli": ["tool"], "flutter": ["mobile"] }`
   * mergeConfig が各 repo の topics[] に適用してタグを自動付与する。
   */
  topicTags?: Record<string, string[]>;
}
```

- [ ] **Step 3: Update `mkRaw` in `mergeConfig.test.ts`**

Find the `mkRaw` function (line 6–20) and add `topics: []`:

```ts
function mkRaw(full_name: string, extra: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    full_name,
    name: full_name.split("/")[1] ?? full_name,
    description: null,
    html_url: `https://github.com/${full_name}`,
    stargazers_count: 0,
    language: null,
    pushed_at: "2026-01-01T00:00:00Z",
    fork: false,
    archived: false,
    private: false,
    topics: [],
    ...extra,
  };
}
```

- [ ] **Step 4: Update `mkRepo` in `fetchRepos.test.ts`**

Find the `mkRepo` function (line 7–21) and add `topics: []`:

```ts
function mkRepo(full_name: string, extra: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    full_name,
    name: full_name.split("/")[1] ?? full_name,
    description: null,
    html_url: `https://github.com/${full_name}`,
    stargazers_count: 0,
    language: null,
    pushed_at: "2026-01-01T00:00:00Z",
    fork: false,
    archived: false,
    private: false,
    topics: [],
    ...extra,
  };
}
```

- [ ] **Step 5: Verify tests still pass**

```bash
npm test
```

Expected: all 38 tests pass (no logic changed yet, only type additions).

- [ ] **Step 6: Commit**

```bash
git add src/lib/fetchRepos.ts src/types/card.ts src/lib/mergeConfig.test.ts src/lib/fetchRepos.test.ts
git commit -m "feat: add topics field to GitHubRepo and topicTags to CardConfig"
```

---

### Task 2: Replace `LANGUAGE_TO_LEAF` with topic-based tagging in `mergeConfig.ts`

**Files:**
- Modify: `src/lib/mergeConfig.ts`
- Modify: `src/lib/mergeConfig.test.ts`

- [ ] **Step 1: Write failing tests for topic-based tagging**

In `src/lib/mergeConfig.test.ts`, replace the three existing `toRepo` tests that test language mapping (lines 57–75: "maps GitHub language to a leaf id", "returns no tags for an unknown language", "unions language tag with override tags") with the following tests. The existing tests for name/description/pinned/namePrefixTags stay unchanged.

Replace those three tests with:

```ts
describe("toRepo", () => {
  it("maps a known topic to its tag ID via topicTags", () => {
    const r = toRepo(
      mkRaw("u/a", { topics: ["cli"] }),
      undefined,
      false,
      undefined,
      { cli: ["tool"] },
    );
    expect(r.tags).toEqual(["tool"]);
  });

  it("returns no tags when topics are empty and no override", () => {
    const r = toRepo(mkRaw("u/a", { topics: [] }), undefined, false);
    expect(r.tags).toEqual([]);
  });

  it("returns no tags for topics not in topicTags", () => {
    const r = toRepo(
      mkRaw("u/a", { topics: ["unknown-topic"] }),
      undefined,
      false,
      undefined,
      { cli: ["tool"] },
    );
    expect(r.tags).toEqual([]);
  });

  it("unions topic tags with override tags and deduplicates", () => {
    const r = toRepo(
      mkRaw("u/a", { topics: ["cli"] }),
      { tags: ["tool", "ai"] },
      false,
      undefined,
      { cli: ["tool"] },
    );
    expect(r.tags.sort()).toEqual(["ai", "tool"]);
  });

  it("one topic can map to multiple tag IDs", () => {
    const r = toRepo(
      mkRaw("u/a", { topics: ["full-stack"] }),
      undefined,
      false,
      undefined,
      { "full-stack": ["web", "backend"] },
    );
    expect(r.tags.sort()).toEqual(["backend", "web"]);
  });

  it("applies name and description overrides", () => {
    const r = toRepo(
      mkRaw("u/a", { name: "a", description: "raw description" }),
      { name: "上書き名", description: "上書き説明" },
      false,
    );
    expect(r.name).toBe("上書き名");
    expect(r.description).toBe("上書き説明");
  });

  it("falls back to empty string when description is null and no override", () => {
    const r = toRepo(mkRaw("u/a", { description: null }), undefined, false);
    expect(r.description).toBe("");
  });

  it("propagates the pinned flag", () => {
    const r = toRepo(mkRaw("u/a"), undefined, true);
    expect(r.pinned).toBe(true);
  });
});
```

Also in the `mergeConfig` describe block, make two replacements:

**Replace** "applies overrides and language mapping during conversion" with:

```ts
it("applies topicTags and overrides during conversion", () => {
  const config = mkConfig({
    repoOverrides: {
      "u/a": { name: "上書き", tags: ["ai"] },
    },
    topicTags: { cli: ["tool"] },
  });
  const out = mergeConfig([mkRaw("u/a", { topics: ["cli"] })], config);
  expect(out.repos[0].name).toBe("上書き");
  expect(out.repos[0].tags.sort()).toEqual(["ai", "tool"]);
});
```

**Also update** "applies namePrefixTags rules across all repos" — removing `LANGUAGE_TO_LEAF` means `u/tool-cli` (language: Go) no longer gets the `go` tag, and `u/other-thing` (language: Go) gets nothing (no topics, no prefix). Replace the test body:

```ts
it("applies namePrefixTags rules across all repos", () => {
  const config = mkConfig({
    namePrefixTags: { "design-": "design", "tool-": "tool" },
    topicTags: {},
  });
  const out = mergeConfig(
    [
      mkRaw("u/design-apparel"),
      mkRaw("u/tool-cli"),
      mkRaw("u/other-thing"),
    ],
    config,
  );
  const byId = Object.fromEntries(out.repos.map((r) => [r.id, r]));
  expect(byId["u/design-apparel"].tags).toEqual(["design"]);
  expect(byId["u/tool-cli"].tags).toEqual(["tool"]);
  expect(byId["u/other-thing"].tags).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|✗|×|toRepo"
```

Expected: the new `toRepo` tests fail because `toRepo` doesn't accept a `topicTags` parameter yet.

- [ ] **Step 3: Update `mergeConfig.ts`**

Replace the entire file content with:

```ts
import type {
  CardConfig,
  HierarchyNode,
  Profile,
  Repo,
  RepoOverride,
} from "../types/card";
import type { GitHubRepo } from "./fetchRepos";

export interface MergedConfig {
  profile: Profile;
  hierarchy: HierarchyNode[];
  repos: Repo[];
}

/**
 * 適用順:
 *   1. excludeRepos に含まれる repo を破棄
 *   2. pinnedRepos / stars DESC / pushed_at DESC でソート
 *   3. repoOverrides の name/description/tags を適用
 *   4. topicTags で GitHub topics → tag ID を自動付与
 *   5. namePrefixTags でリポジトリ名から tag を自動付与
 *   6. 上記すべてのタグを union
 */
export function mergeConfig(
  rawRepos: GitHubRepo[],
  config: CardConfig,
): MergedConfig {
  const excludeSet = new Set(config.excludeRepos);
  const pinnedSet = new Set(config.pinnedRepos);

  const kept = rawRepos.filter((r) => !excludeSet.has(r.full_name));
  const sorted = sortRawRepos(kept, config.pinnedRepos);
  const repos = sorted.map((raw) =>
    toRepo(
      raw,
      config.repoOverrides[raw.full_name],
      pinnedSet.has(raw.full_name),
      config.namePrefixTags,
      config.topicTags,
    ),
  );

  return {
    profile: config.profile,
    hierarchy: config.hierarchy,
    repos,
  };
}

export function toRepo(
  raw: GitHubRepo,
  override: RepoOverride | undefined,
  pinned: boolean,
  namePrefixTags?: Record<string, string>,
  topicTags?: Record<string, string[]>,
): Repo {
  const topicTagsList = raw.topics.flatMap((t) => topicTags?.[t] ?? []);
  const overrideTags = override?.tags ?? [];
  const prefixTags = matchPrefixTags(raw.name, namePrefixTags);
  const tags = Array.from(
    new Set([...topicTagsList, ...overrideTags, ...prefixTags]),
  );

  return {
    id: raw.full_name,
    name: override?.name ?? raw.name,
    description: override?.description ?? raw.description ?? "",
    url: raw.html_url,
    stars: raw.stargazers_count,
    language: raw.language,
    tags,
    pinned,
  };
}

function matchPrefixTags(
  name: string,
  rules: Record<string, string> | undefined,
): string[] {
  if (!rules) return [];
  const out: string[] = [];
  for (const [prefix, tag] of Object.entries(rules)) {
    if (name.startsWith(prefix)) out.push(tag);
  }
  return out;
}

export function sortRawRepos(
  repos: GitHubRepo[],
  pinned: string[],
): GitHubRepo[] {
  const pinnedRank = new Map<string, number>();
  pinned.forEach((name, i) => pinnedRank.set(name, i));

  return [...repos].sort((a, b) => {
    const rankA = pinnedRank.get(a.full_name);
    const rankB = pinnedRank.get(b.full_name);
    const isPinnedA = rankA !== undefined;
    const isPinnedB = rankB !== undefined;

    if (isPinnedA && isPinnedB) return rankA! - rankB!;
    if (isPinnedA) return -1;
    if (isPinnedB) return 1;

    if (a.stargazers_count !== b.stargazers_count) {
      return b.stargazers_count - a.stargazers_count;
    }
    return b.pushed_at.localeCompare(a.pushed_at);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass. Count should be ≥ 38 (same or more, since we replaced 3 tests with 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mergeConfig.ts src/lib/mergeConfig.test.ts
git commit -m "feat: replace LANGUAGE_TO_LEAF with topic-based tag lookup"
```

---

### Task 3: Update `card-config.json` with new hierarchy and `topicTags`

**Files:**
- Modify: `card-config.json`

- [ ] **Step 1: Replace the `hierarchy` and add `topicTags`**

In `card-config.json`, replace the `hierarchy` array and `namePrefixTags` object, and add `topicTags`. The full updated file:

```json
{
  "_note": "このファイルは作業中のサンプル値です。プロフィール・リンク・hierarchy などは公開前の最終値ではなく、Wave を進めながら適宜更新する想定です。mergeConfig は _note を含む未知フィールドを無視する設計とします。",
  "profile": {
    "name": "庄司 彬人",
    "nameEn": "Akito Shoji",
    "avatarUrl": "/images/avatar.png",
    "title": "Adtech × AI Developer",
    "tagline": "フルスタックデベロッパー",
    "links": [
      { "type": "github", "url": "https://github.com/torifo" },
      { "type": "portfolio", "url": "https://portorifo.riumu.net" },
      { "type": "email", "url": "progbot.clover@gmail.com" }
    ]
  },
  "geo": {
    "lat": 35.6762,
    "lng": 139.6503,
    "tz": "Asia/Tokyo"
  },
  "hierarchy": [
    {
      "id": "domain",
      "label": "Domain",
      "children": [
        {
          "id": "creative",
          "label": "Creative",
          "leaves": [
            { "id": "design", "label": "Design" },
            { "id": "animation", "label": "Animation" }
          ]
        },
        {
          "id": "product",
          "label": "Product",
          "leaves": [
            { "id": "web", "label": "Web App" },
            { "id": "mobile", "label": "Mobile" },
            { "id": "desktop", "label": "Desktop" }
          ]
        },
        {
          "id": "engineering",
          "label": "Engineering",
          "leaves": [
            { "id": "tool", "label": "Dev Tool" },
            { "id": "ai", "label": "AI / LLM" },
            { "id": "backend", "label": "Backend" }
          ]
        }
      ]
    }
  ],
  "topicTags": {
    "design":               ["design"],
    "design-study":         ["design"],
    "web-design":           ["design"],
    "animation":            ["animation"],
    "css-animation":        ["animation"],
    "css-3d":               ["animation"],
    "web-app":              ["web"],
    "frontend":             ["web"],
    "spa":                  ["web"],
    "static-site":          ["web"],
    "landing-page":         ["web"],
    "ssg":                  ["web"],
    "visualization":        ["web"],
    "flutter":              ["mobile"],
    "mobile-app":           ["mobile"],
    "dart":                 ["mobile"],
    "android":              ["mobile"],
    "ios":                  ["mobile"],
    "desktop-app":          ["desktop"],
    "tauri":                ["desktop"],
    "wails":                ["desktop"],
    "electron-alternative": ["desktop"],
    "developer-tool":       ["tool"],
    "cli":                  ["tool"],
    "automation":           ["tool"],
    "utility":              ["tool"],
    "bot":                  ["tool"],
    "script":               ["tool"],
    "ai":                   ["ai"],
    "llm":                  ["ai"],
    "generative-ai":        ["ai"],
    "claude-code":          ["ai"],
    "claude-skill":         ["ai"],
    "gpt":                  ["ai"],
    "full-stack":           ["backend"],
    "backend":              ["backend"],
    "database":             ["backend"],
    "devops":               ["backend"],
    "docker":               ["backend"],
    "api":                  ["backend"],
    "microservice":         ["backend"],
    "rest":                 ["backend"]
  },
  "repoOverrides": {},
  "excludeRepos": [],
  "pinnedRepos": [],
  "namePrefixTags": {
    "design-": "design",
    "animation-": "animation"
  }
}
```

- [ ] **Step 2: Run build to verify**

```bash
npm run build
```

Expected: build succeeds, 1 page generated.

- [ ] **Step 3: Run `astro check`**

```bash
npx astro check
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Verify filter in dev server**

```bash
npm run dev
```

Open `http://localhost:4321`, flip to the back face. Verify:
- The dropdown shows: Domain → Creative (Design, Animation) / Product (Web App, Mobile, Desktop) / Engineering (Dev Tool, AI/LLM, Backend)
- Selecting "Design" filters repos to `design-*` repos
- Selecting "Animation" filters repos to `animation-*` repos
- Selecting "Dev Tool" shows CLI/tool repos (e.g., astral-drive, echo-news)

- [ ] **Step 5: Commit**

```bash
git add card-config.json
git commit -m "feat: switch to topic-based tag hierarchy (Creative/Product/Engineering)"
```

---

### Task 4: Commit spec and plan docs

**Files:**
- Add: `docs/superpowers/specs/2026-06-01-topic-based-tags-design.md`
- Add: `docs/superpowers/plans/2026-06-01-topic-based-tags.md`

- [ ] **Step 1: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-01-topic-based-tags-design.md docs/superpowers/plans/2026-06-01-topic-based-tags.md
git commit -m "docs: add spec and plan for topic-based tag system"
```
