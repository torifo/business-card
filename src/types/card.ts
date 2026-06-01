/**
 * デジタル名刺システムのドメイン型定義。
 * design.md `Data Models` セクションの正である。
 */

/**
 * HTML にインライン埋め込みされるビルド成果物。
 * `window.__CARD_DATA__` ないし `<script id="card-data">` から読み出される。
 */
export interface CardData {
  /** ビルド時刻の ISO timestamp。 */
  generatedAt: string;
  profile: Profile;
  repos: Repo[];
  /** 階層ドロップダウンの全ツリー。`card-config.json` 由来。 */
  hierarchy: HierarchyNode[];
  /** FR-010: ビルド時に計算した 365 日分の日の出/日没。 */
  sunTimes: SunTime[];
  /** FR-010: sunTimes 計算に用いた緯度経度と TZ。 */
  geo: Geo;
}

/** 表面に表示するプロフィール固定情報。 */
export interface Profile {
  name: string;
  nameEn: string;
  /** `/public` 配下の URL（例: `/images/avatar.png`）。 */
  avatarUrl: string;
  title: string;
  tagline: string;
  links: ProfileLink[];
}

/** プロフィール内の SNS / 連絡先リンク。GitHub のみ FR-001 で必須、それ以外は任意。 */
export interface ProfileLink {
  type: "github" | "x" | "qiita" | "linkedin" | "email" | "portfolio";
  url: string;
}

/** GitHub リポジトリの正規化済み表示単位。 */
export interface Repo {
  /** GitHub repo の `full_name`（例: `torifo/business-card`）。 */
  id: string;
  /** 表示名。`card-config.json.repoOverrides[id].name` で上書き可能。 */
  name: string;
  /** 表示説明。`card-config.json.repoOverrides[id].description` で上書き可能。 */
  description: string;
  /** GitHub の `html_url`。 */
  url: string;
  /** `stargazers_count`。 */
  stars: number;
  /** GitHub の primary language。未設定リポジトリでは null。 */
  language: string | null;
  /** Leaf tag ID の配列（例: `["design", "tool", "ai"]`）。topicTags・repoOverrides・namePrefixTags の union。 */
  tags: string[];
  /** `card-config.json.pinnedRepos` で指定された場合 true。上位表示の対象。 */
  pinned: boolean;
}

/** 階層ドロップダウンの 1 段目（カテゴリ）。 */
export interface HierarchyNode {
  /** 例: `"skill"`, `"category"`。 */
  id: string;
  /** UI 表示名。例: `"Skill"`, `"Domain"`。 */
  label: string;
  children: HierarchySubcategory[];
}

/** 階層ドロップダウンの 2 段目（サブカテゴリ）。 */
export interface HierarchySubcategory {
  /** 例: `"language"`, `"framework"`, `"infra"`。 */
  id: string;
  label: string;
  leaves: HierarchyLeaf[];
}

/** 階層ドロップダウンの 3 段目（実際のフィルタ単位タグ）。 */
export interface HierarchyLeaf {
  /** Repo.tags と突き合わせるためのタグ ID。例: `"go"`, `"typescript"`。 */
  id: string;
  /** UI 表示名。例: `"Go"`, `"TypeScript"`。 */
  label: string;
  /** URL パラメータ `?target=` の別名（例: `golang` を `go` に解決）。 */
  aliases?: string[];
}

/** FR-010: 1 日分の日の出/日没時刻エントリ。 */
export interface SunTime {
  /** JST 日付キー `YYYY-MM-DD`（例: `2026-05-22`）。 */
  date: string;
  /** ISO 8601 UTC（例: `2026-05-21T19:24:00Z`）。 */
  sunriseUTC: string;
  /** ISO 8601 UTC。 */
  sunsetUTC: string;
}

/** sunTimes 計算に使う緯度経度と日付キー基準の TZ。 */
export interface Geo {
  /** -90..90。 */
  lat: number;
  /** -180..180。 */
  lng: number;
  /** IANA timezone（例: `"Asia/Tokyo"`）。SunTime.date 生成の基準。 */
  tz: string;
}

/**
 * `card-config.json` のスキーマ。
 * `_note` 等の未知フィールドが含まれる場合があるが、mergeConfig は無視する設計。
 */
export interface CardConfig {
  profile: Profile;
  geo: Geo;
  hierarchy: HierarchyNode[];
  /** key: repo full_name。 */
  repoOverrides: Record<string, RepoOverride>;
  /** 表示対象から外す repo full_name の配列。 */
  excludeRepos: string[];
  /** 上位表示する repo full_name の配列。順序が表示順。 */
  pinnedRepos: string[];
  /**
   * リポジトリ名のプレフィックスから tag を自動付与するルール。
   * 例: `{ "design-": "design" }` で `design-*` の repo に "design" タグを追加。
   * 既存タグ (topicTags・repoOverrides) と union される。
   */
  namePrefixTags?: Record<string, string>;
  /**
   * GitHub topic name → tag ID[] のマッピング。
   * 例: `{ "cli": ["tool"], "flutter": ["mobile"] }`
   * mergeConfig が各 repo の topics[] に適用してタグを自動付与する。
   */
  topicTags?: Record<string, string[]>;
}

/** card-config.json での GitHub 生データに対する個別上書き。 */
export interface RepoOverride {
  name?: string;
  description?: string;
  /** Leaf tag ID の配列。topicTags・namePrefixTags から自動付与されたタグと union される。 */
  tags?: string[];
}
