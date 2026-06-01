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

/**
 * GitHubRepo を Repo に変換。topicTags / repoOverrides / namePrefixTags を
 * まとめて適用する。テスト容易性のため公開エクスポート。
 */
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
