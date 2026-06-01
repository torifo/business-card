import { describe, it, expect } from "vitest";
import { mergeConfig, sortRawRepos, toRepo } from "./mergeConfig";
import type { GitHubRepo } from "./fetchRepos";
import type { CardConfig } from "../types/card";

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

function mkConfig(extra: Partial<CardConfig> = {}): CardConfig {
  return {
    profile: {
      name: "テスト 太郎",
      nameEn: "Test Taro",
      avatarUrl: "/images/avatar.png",
      title: "Engineer",
      tagline: "tagline",
      links: [{ type: "github", url: "https://github.com/test" }],
    },
    geo: { lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo" },
    hierarchy: [
      {
        id: "skill",
        label: "Skill",
        children: [
          {
            id: "language",
            label: "Language",
            leaves: [
              { id: "go", label: "Go" },
              { id: "typescript", label: "TypeScript" },
            ],
          },
        ],
      },
    ],
    repoOverrides: {},
    excludeRepos: [],
    pinnedRepos: [],
    ...extra,
  };
}

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

describe("sortRawRepos", () => {
  it("sorts unpinned by stars DESC then pushed_at DESC", () => {
    const a = mkRaw("u/a", { stargazers_count: 10, pushed_at: "2026-01-01T00:00:00Z" });
    const b = mkRaw("u/b", { stargazers_count: 20, pushed_at: "2026-01-01T00:00:00Z" });
    const c = mkRaw("u/c", { stargazers_count: 10, pushed_at: "2026-02-01T00:00:00Z" });
    const sorted = sortRawRepos([a, b, c], []);
    expect(sorted.map((r) => r.full_name)).toEqual(["u/b", "u/c", "u/a"]);
  });

  it("places pinned repos first in the pinned order, regardless of stars", () => {
    const a = mkRaw("u/a", { stargazers_count: 100 });
    const b = mkRaw("u/b", { stargazers_count: 1 });
    const c = mkRaw("u/c", { stargazers_count: 50 });
    // pin order: c first, then b
    const sorted = sortRawRepos([a, b, c], ["u/c", "u/b"]);
    expect(sorted.map((r) => r.full_name)).toEqual(["u/c", "u/b", "u/a"]);
  });

  it("leaves the array unchanged when there are no pins and equal stats", () => {
    const a = mkRaw("u/a");
    const b = mkRaw("u/b");
    const sorted = sortRawRepos([a, b], []);
    // pushed_at and stars are equal; stable sort keeps the input order
    expect(sorted.map((r) => r.full_name)).toEqual(["u/a", "u/b"]);
  });
});

describe("mergeConfig", () => {
  it("excludes repos listed in excludeRepos", () => {
    const config = mkConfig({ excludeRepos: ["u/private"] });
    const out = mergeConfig([mkRaw("u/a"), mkRaw("u/private")], config);
    expect(out.repos.map((r) => r.id)).toEqual(["u/a"]);
  });

  it("passes profile and hierarchy through unchanged", () => {
    const config = mkConfig();
    const out = mergeConfig([], config);
    expect(out.profile).toBe(config.profile);
    expect(out.hierarchy).toBe(config.hierarchy);
    expect(out.repos).toEqual([]);
  });

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

  it("namePrefixTags is unioned with overrides without duplicating", () => {
    const config = mkConfig({
      namePrefixTags: { "design-": "design" },
      repoOverrides: { "u/design-x": { tags: ["design", "ai"] } },
    });
    const out = mergeConfig([mkRaw("u/design-x")], config);
    expect(out.repos[0].tags.sort()).toEqual(["ai", "design"]);
  });

  it("orders results with pinned first, then stars/pushed_at", () => {
    const config = mkConfig({ pinnedRepos: ["u/pinned"] });
    const out = mergeConfig(
      [
        mkRaw("u/pinned", { stargazers_count: 0 }),
        mkRaw("u/popular", { stargazers_count: 999 }),
        mkRaw("u/recent", {
          stargazers_count: 999,
          pushed_at: "2026-05-01T00:00:00Z",
        }),
      ],
      config,
    );
    expect(out.repos.map((r) => r.id)).toEqual([
      "u/pinned",
      "u/recent",
      "u/popular",
    ]);
    expect(out.repos[0].pinned).toBe(true);
    expect(out.repos[1].pinned).toBe(false);
  });
});
