import { describe, it, expect, vi } from "vitest";
import { fetchRepos, parseNextLink, type GitHubRepo } from "./fetchRepos";

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
    ...extra,
  };
}

function mkResponse(body: unknown, link: string | null = null): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (link) headers.set("link", link);
  return new Response(JSON.stringify(body), { status: 200, headers });
}

describe("parseNextLink", () => {
  it("returns null when header is missing", () => {
    expect(parseNextLink(null)).toBeNull();
  });

  it("extracts the next URL when present", () => {
    const header =
      '<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=5>; rel="last"';
    expect(parseNextLink(header)).toBe("https://api.github.com/user/repos?page=2");
  });

  it("returns null when only prev/last are present (no next)", () => {
    const header =
      '<https://api.github.com/user/repos?page=1>; rel="prev", <https://api.github.com/user/repos?page=5>; rel="last"';
    expect(parseNextLink(header)).toBeNull();
  });
});

describe("fetchRepos", () => {
  it("returns empty array when GitHub returns 0 repos", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(mkResponse([]));
    const result = await fetchRepos({ username: "ghost", fetchImpl });
    expect(result).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns all repos from a single page response", async () => {
    const repos = [mkRepo("torifo/a"), mkRepo("torifo/b")];
    const fetchImpl = vi.fn().mockResolvedValueOnce(mkResponse(repos));
    const result = await fetchRepos({ username: "torifo", fetchImpl });
    expect(result).toEqual(repos);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("follows the rel=next link across multiple pages", async () => {
    const page1 = [mkRepo("torifo/a"), mkRepo("torifo/b")];
    const page2 = [mkRepo("torifo/c")];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        mkResponse(page1, '<https://api.github.com/page2>; rel="next"'),
      )
      .mockResolvedValueOnce(mkResponse(page2));
    const result = await fetchRepos({ username: "torifo", fetchImpl });
    expect(result).toEqual([...page1, ...page2]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // 2 ページ目は Link ヘッダから抽出した URL に向けて呼ばれている
    expect(fetchImpl.mock.calls[1][0]).toBe("https://api.github.com/page2");
  });

  it("stops paginating at maxPages even if more pages remain", async () => {
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(
        mkResponse([mkRepo("torifo/x")], '<https://api.github.com/next>; rel="next"'),
      ),
    );
    const result = await fetchRepos({ username: "torifo", fetchImpl, maxPages: 2 });
    expect(result).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("adds Authorization header when a token is provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(mkResponse([]));
    await fetchRepos({ username: "torifo", token: "ghp_secret", fetchImpl });
    const callHeaders = (fetchImpl.mock.calls[0][1] as RequestInit).headers as
      | Record<string, string>
      | undefined;
    expect(callHeaders?.Authorization).toBe("Bearer ghp_secret");
  });

  it("omits Authorization when no token is provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(mkResponse([]));
    await fetchRepos({ username: "torifo", fetchImpl });
    const callHeaders = (fetchImpl.mock.calls[0][1] as RequestInit).headers as
      | Record<string, string>
      | undefined;
    expect(callHeaders?.Authorization).toBeUndefined();
  });

  it("throws when the API returns a non-2xx status", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    await expect(fetchRepos({ username: "torifo", fetchImpl })).rejects.toThrow(
      /403/,
    );
  });
});
