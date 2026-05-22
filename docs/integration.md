# Integration Guide — 他者ポートフォリオへの移植

本リポジトリは「庄司彬人のデジタル名刺」を主目標とするが、構造を他者のポートフォリオサイトでも再利用できるよう設計されている。本ドキュメントは、その移植手順をまとめた **副次目標** のガイドである。

> **Note:** Astro 5 + Tailwind 4 環境を前提に書いているが、CSS / JS の各ファイルは他フレームワーク (Next.js / Nuxt / SvelteKit 等) でも独立して動作するよう疎結合に保ってある。フレームワーク依存はビルド時統合 (`src/pages/index.astro` の frontmatter) に限られる。

---

## 1. 全体像

本システムは以下の 3 点契約で動作する。利用者はこの契約を満たす範囲でカスタマイズすれば、コード本体を改変せず自分の名刺/ポートフォリオに統合できる。

| 契約点 | 仕様 |
|---|---|
| **テーマクラス命名** | `body.light-mode` / `body.night-mode` |
| **CSS 変数命名** | `--color-bg` / `--color-bg-grad` / `--color-text` / `--color-accent` 他 |
| **`card-config.json` スキーマ** | 後述 |

ランタイムでの外部通信はゼロ。日の出/日没時刻と GitHub repo データはビルド時に HTML 内へ JSON インライン埋め込みされる。

---

## 2. コピー対象ファイル一覧

最小構成として以下を自プロジェクトへコピーする。

```
src/types/card.ts                ドメイン型定義
src/lib/fetchRepos.ts            GitHub API + ローカルキャッシュ
src/lib/mergeConfig.ts           生データへの上書き適用
src/lib/computeSunTimes.ts       SunCalc で 365 日分の sun times を生成
src/scripts/theme-init.inline.ts  初期テーマ即時適用 (FOUC 抑止)
src/scripts/theme.ts             10 分タイマーで再判定
src/scripts/card-flip.ts         表/裏フリップ制御
src/scripts/card-filter.ts       URL param + ドロップダウン制御
src/styles/tokens.css            セマンティック CSS 変数定義
src/styles/card.css              カードレイアウト + 3D フリップ CSS
src/components/CardFront.astro   表面 (横長レイアウト)
src/components/CardBack.astro    裏面 (フィルタ + repo グリッド)
src/components/RepoCard.astro    リポジトリカード
src/components/TabSwitcher.astro 表/裏切替タブ
card-config.json                 コンテンツ設定 (リポジトリ root)
```

加えて、`suncalc` を `dependencies` に追加すること。

---

## 3. CSS 変数命名規約

`src/styles/tokens.css` で定義されている。Light/Night の双方で同じキー名を持ち、`body.light-mode` で上書きされる。

### 必須トークン

| キー | 役割 |
|---|---|
| `--color-bg` | 単色背景 (グラデなしフォールバック) |
| `--color-bg-grad` | body 背景のグラデーション |
| `--color-text` | プライマリテキスト |
| `--color-text-muted` | 補助テキスト |
| `--color-accent` | アクセント色 (アクティブタブ・リンクホバー) |
| `--color-surface` | カード/glass 背景 (半透明可) |
| `--color-border` | カード/コントロールのボーダー |
| `--transition-theme` | テーマ切替時のトランジション (推奨: `background 0.5s ease, color 0.3s ease`) |

これら以外のフィールドを追加するのは自由 (`--color-accent-strong` 等)。`mergeConfig` は未知の CSS 変数を読み書きしない。

### 任意トークン

| キー | 役割 |
|---|---|
| `--radius-md` / `--radius-lg` | カードや要素の角丸 |
| `--font-body` / `--font-heading` / `--font-mono` | フォントスタック |

これらが未定義でも `card.css` / コンポーネント側に妥当な fallback (`system-ui` 等) が書かれているので、必須ではない。

### ポートフォリオとの整合

`portorifo.riumu.net` (本デザインソース) との同期は **手動写経** で行う方針 (別リポジトリ・別デプロイのためクロスオリジン共有不可)。色値が更新された場合は `tokens.css` を手で書き換える。

---

## 4. テーマクラス命名規約

```css
body         { /* 既定 = night-mode 相当 */ }
body.night-mode { /* 明示の場合も :root を継承 */ }
body.light-mode { /* 日中用カラー上書き */ }
```

- `prefers-color-scheme` メディアクエリは **使わない**。テーマは日没連動の Auto に固定 (FR-010)
- クラス未付与時は night-mode の見た目を返すことで FOUC を最小化する
- カスタマイズで `data-theme` 属性等に切り替える場合、`theme-init.inline.ts` と `theme.ts` の `classList.add/remove` 呼び出しを書き換える

---

## 5. `card-config.json` スキーマ

完全な TypeScript 型は `src/types/card.ts` の `CardConfig` を参照。最小構成の例：

```json
{
  "profile": {
    "name": "山田 太郎",
    "nameEn": "Taro Yamada",
    "avatarUrl": "/images/avatar.png",
    "title": "Engineer",
    "tagline": "短い自己紹介",
    "links": [
      { "type": "github", "url": "https://github.com/your-username" }
    ]
  },
  "geo": {
    "lat": 35.6762,
    "lng": 139.6503,
    "tz": "Asia/Tokyo"
  },
  "hierarchy": [
    {
      "id": "skill",
      "label": "Skill",
      "children": [
        {
          "id": "language",
          "label": "Language",
          "leaves": [
            { "id": "go", "label": "Go", "aliases": ["golang"] }
          ]
        }
      ]
    }
  ],
  "repoOverrides": {},
  "excludeRepos": [],
  "pinnedRepos": []
}
```

- `profile.links[].type` は `github` / `x` / `qiita` / `linkedin` / `email` のいずれか。GitHub は必須 (`fetchRepos` がユーザー名を取り出すため)
- `geo.tz` は IANA タイムゾーン (例: `Asia/Tokyo`)。`SunTime.date` キーの生成基準
- `hierarchy.children[].leaves[].aliases` は URL `?target=` で受け取る別名 (大文字小文字区別あり)
- `repoOverrides[fullName]` は GitHub の `language` から自動推定したタグと **union** される
- 未知フィールド (`_note` 等) は `mergeConfig` で無視されるのでメタ情報を追記可能

---

## 6. 緯度経度を変更する

自動テーマの境界を東京以外の都市にしたい場合は `card-config.json` の `geo` を変更するだけで良い。例：

```json
"geo": { "lat": 40.7128, "lng": -74.0060, "tz": "America/New_York" }
```

`computeSunTimes` は `suncalc` を使って純粋計算するため、ネットワーク呼び出しは発生しない。極地 (緯度 ±66.5° 以上で白夜/極夜が発生する場所) では `SunCalc` が Invalid Date を返すため、正午 UTC をフォールバック値として埋め込み、ランタイムでは常に night-mode に倒れる挙動になる。

---

## 7. GitHub Actions による定期再ビルド (オプション)

`Data Freshness` を SLA 化するなら、以下のような cron ワークフローを追加する。本リポジトリの主目標では手動運用としているため未配備。

```yaml
# .github/workflows/rebuild.yml
name: Weekly rebuild
on:
  schedule:
    - cron: "0 0 * * 0"  # 毎週日曜 0:00 UTC
  workflow_dispatch:
jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm ci
      - run: npm run build
        env:
          GITHUB_PAT: ${{ secrets.GH_PAT_PUBLIC }}
      # ここでデプロイ (Pages / Cloudflare Pages / Vercel など)
```

---

## 8. 変更履歴

破壊的変更が入った場合に追記する。SemVer の厳格運用は本リポジトリの主目標ではないため必須としない。

| 日付 | 変更 | 影響範囲 |
|---|---|---|
| — | (まだ無し) | — |

---

## Out of Scope

以下は本ガイドの範囲外。気になる場合は本リポジトリの実装 (`docs/spec/design.md`) を参照されたい。

- フレームワーク (Astro 5) 非依存な抽出パッケージ化
- 完全なクイックスタート CLI (`create-business-card` 等)
- 各種フォントウェイトのプリセット切替
- 多言語 (i18n) 対応
- ダーク/ライトの手動切替 UI (`Future Considerations` で扱う)
