import type {
  CardConfig,
  HierarchyNode,
  Profile,
  Repo,
  RepoOverride,
} from "../types/card";
import type { GitHubRepo } from "./fetchRepos";

/**
 * mergeConfig の出力。CardData のうち、sunTimes / geo / generatedAt 以外を組み立てる。
 * 残りのフィールドは caller (`index.astro`) で computeSunTimes と合成する。
 */
export interface MergedConfig {
  profile: Profile;
  hierarchy: HierarchyNode[];
  repos: Repo[];
}

/**
 * GitHub の primary language を hierarchy 内の leaf id に自動マッピングするテーブル。
 * 表に無い言語は無視される (override で明示的に tags を付与すれば反映可)。
 */
const LANGUAGE_TO_LEAF: Record<string, string> = {
  Go: "go",
  TypeScript: "typescript",
  Python: "python",
  Dart: "dart",
};

/**
 * 生 GitHub データに card-config を適用し、名刺で扱う Repo[] と
 * プロフィール / 階層をまとめた MergedConfig を返す。
 *
 * 適用順 (design.md Merge rules):
 *   1. excludeRepos に含まれる repo を破棄
 *   2. pinnedRepos / stars DESC / pushed_at DESC でソート
 *   3. repoOverrides の name/description/tags を適用
 *   4. GitHub language → leaf id を自動付与し、override tags と union
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
    toRepo(raw, config.repoOverrides[raw.full_name], pinnedSet.has(raw.full_name)),
  );

  return {
    profile: config.profile,
    hierarchy: config.hierarchy,
    repos,
  };
}

/**
 * GitHubRepo を Repo に変換。override と language マッピングをまとめて適用。
 * 直接エクスポートはしないが、テスト容易性のため公開する。
 */
export function toRepo(
  raw: GitHubRepo,
  override: RepoOverride | undefined,
  pinned: boolean,
): Repo {
  const langTag = raw.language ? LANGUAGE_TO_LEAF[raw.language] : undefined;
  const overrideTags = override?.tags ?? [];
  const tags = Array.from(new Set([...(langTag ? [langTag] : []), ...overrideTags]));

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

/**
 * pinned 配列に含まれる repo を先頭に、その内部は pinned 配列の順序で並べ、
 * 残りは stars DESC → pushed_at DESC で並べる。
 */
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
