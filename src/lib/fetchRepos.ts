/**
 * GitHub API から公開リポジトリをページネーション込みで取得する。
 * ビルド時にのみ呼び出され、ランタイムでは実行されない (FR-007 / NFR Offline)。
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * GitHub API のリポジトリレスポンスから、本システムで使う最小フィールド集合。
 * mergeConfig がこの型を受け取り、Repo 型に正規化する。
 */
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
}

export interface FetchReposOptions {
  username: string;
  /**
   * GitHub PAT。未指定の場合は未認証で呼び出し (60 req/h)。
   * 環境変数 GITHUB_PAT 経由で供給される想定。
   */
  token?: string;
  /** Link ヘッダの rel="next" を辿るページ数の上限。default 5 (= 500 件)。 */
  maxPages?: number;
  /** テスト用に fetch を差し替えるためのフック。default は global fetch。 */
  fetchImpl?: typeof fetch;
  /**
   * dev 用ローカルファイルキャッシュのパス。指定ありかつ cacheTtlMs 内であれば
   * ネットワーク呼び出しをスキップする。fetch 成功時には新しい結果で上書きする。
   * 本番ビルドでは指定しない (常に最新を取得)。
   */
  cacheFile?: string;
  /** キャッシュ TTL (ms)。cacheFile と併用する。 */
  cacheTtlMs?: number;
}

const DEFAULT_MAX_PAGES = 5;
const PER_PAGE = 100;

export async function fetchRepos(options: FetchReposOptions): Promise<GitHubRepo[]> {
  const { username, token, maxPages = DEFAULT_MAX_PAGES, cacheFile, cacheTtlMs } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (cacheFile && cacheTtlMs) {
    const cached = await readCacheIfFresh(cacheFile, cacheTtlMs);
    if (cached) return cached;
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const repos: GitHubRepo[] = [];
  let nextUrl: string | null =
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${PER_PAGE}&sort=pushed&direction=desc`;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const res: Response = await fetchImpl(nextUrl, { headers });
    if (!res.ok) {
      throw new Error(
        `GitHub API ${res.status} ${res.statusText} fetching ${nextUrl}`,
      );
    }
    const batch = (await res.json()) as GitHubRepo[];
    repos.push(...batch);

    const linkHeader = res.headers.get("link");
    nextUrl = parseNextLink(linkHeader);
    page += 1;
  }

  if (cacheFile) {
    await writeCache(cacheFile, repos);
  }

  return repos;
}

async function readCacheIfFresh(
  file: string,
  ttlMs: number,
): Promise<GitHubRepo[] | null> {
  try {
    const st = await stat(file);
    if (Date.now() - st.mtimeMs > ttlMs) return null;
    const content = await readFile(file, "utf8");
    return JSON.parse(content) as GitHubRepo[];
  } catch {
    return null;
  }
}

async function writeCache(file: string, data: GitHubRepo[]): Promise<void> {
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data), "utf8");
  } catch {
    /* 書き込み失敗は無視。次回の fetch でリトライされる */
  }
}

/**
 * GitHub の Link ヘッダから rel="next" の URL を抽出する。
 * 例: `<https://api.github.com/...?page=2>; rel="next", <...?page=5>; rel="last"`
 */
export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}
