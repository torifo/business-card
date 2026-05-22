# 実装タスク (Tasks) — デジタル名刺システム

## Overview

requirements.md / design.md に基づく実装タスクを Wave 並列方式で分解する。各タスクは「1 commit ≒ 1 タスク」の粒度とし、各 Wave 内のタスクは原則並列実行可能。

リポジトリは現状 `docs/` と空の `README.md` のみのため、Wave 1 はゼロベース初期化から開始する。

---

## Wave 1: Bootstrap & Assets （並列、依存なし）

- [ ] **Task 1.1**: Astro 5 + Tailwind 4 + TypeScript プロジェクト初期化
  - What: `npm create astro@latest` で TypeScript strict プリセットを生成し、`@tailwindcss/vite` を追加。`astro.config.mjs` に Tailwind 4 + View Transitions 設定。`src/{pages,components,scripts,styles,lib,types}/` ディレクトリ作成
  - Files: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/`
  - Done when: `npm run dev` が起動し `localhost:4321` で空の Astro ページが表示される
  - Depends on: none

- [ ] **Task 1.2**: `card-config.json` サンプル作成
  - What: design.md の CardConfig スキーマに沿って、profile（庄司彬人）/ geo（東京 35.6762/139.6503/Asia/Tokyo）/ hierarchy（design.md の Phase 1 確定定義）/ repoOverrides / excludeRepos / pinnedRepos の初期値を記述
  - Files: `card-config.json`（リポジトリ root）
  - Done when: JSON が valid で、design.md `CardConfig` 型と整合する
  - Depends on: none

- [ ] **Task 1.3**: QR コード・アバター静的アセット作成
  - What: `qrcode` CLI で `/`（自身）と `portorifo.riumu.net` の QR を 512×512px PNG で生成、アバター画像（240×240px 推奨）を配置
  - Files: `public/qr/card.png`, `public/qr/portfolio.png`, `public/images/avatar.png`, `public/favicon.ico`
  - Done when: 全ファイルが配置済みで Astro dev で `/qr/card.png` が表示される
  - Depends on: none

- [ ] **Task 1.4**: `.gitignore` / `.env.example` / README プレースホルダ更新
  - What: `.env.example` に `GITHUB_PAT=` を追加、`.gitignore` に `.env` / `node_modules` / `dist` を含む、README に「主目標：自分のデジタル名刺 / 副次目標：他者ポートフォリオ移植ガイド（`docs/integration.md`）」の概要を 5-10 行で記述
  - Files: `.gitignore`, `.env.example`, `README.md`
  - Done when: `git status` で意図しないファイルが追跡対象に含まれない
  - Depends on: none

---

## Wave 2: 型定義（Task 1.1 完了後）

- [ ] **Task 2.1**: 全型定義の集約
  - What: design.md の Data Models セクションを TypeScript として `src/types/card.ts` に転記。`CardData` / `Profile` / `Repo` / `HierarchyNode` / `SunTime` / `Geo` / `CardConfig` / `RepoOverride` を export
  - Files: `src/types/card.ts`
  - Done when: `tsc --noEmit` が通り、`card-config.json` を `CardConfig` 型でインポートできる
  - Depends on: Task 1.1

---

## Wave 3: 純粋関数とトークン（Task 2.1 完了後、並列）

- [ ] **Task 3.1**: `fetchRepos.ts` 実装 + unit test
  - What: GitHub API `/users/{user}/repos?per_page=100` を呼び、`Link` ヘッダの `rel="next"` を辿ってページネーション。PAT があれば Bearer 認証、なければ未認証で 1 ページ目のみ取得。Vitest でモック fetch を使い 0/1/N ページのケースを検証
  - Files: `src/lib/fetchRepos.ts`, `src/lib/fetchRepos.test.ts`
  - Done when: `npm test` でこのファイルのテストが pass、実 API（自分のリポジトリ）でも動作確認済
  - Depends on: Task 2.1

- [ ] **Task 3.2**: `mergeConfig.ts` 実装 + unit test
  - What: design.md の Merge rules に従い、excludeRepos / repoOverrides / pinnedRepos の適用と language→leaf id マッピングを実装。除外・上書き・タグ付与・ピンソート・自動言語マッピングの全分岐を Vitest で検証
  - Files: `src/lib/mergeConfig.ts`, `src/lib/mergeConfig.test.ts`
  - Done when: 全ブランチカバレッジが test で確認される
  - Depends on: Task 2.1

- [ ] **Task 3.3**: `computeSunTimes.ts` 実装 + unit test（suncalc 依存追加）
  - What: `npm i suncalc @types/suncalc` 後、`computeSunTimes(geo, days)` を実装。365 件の `SunTime[]` を返す。JST 日付キー生成（`Intl.DateTimeFormat` を `en-CA` ロケールで `YYYY-MM-DD` 出力）。東京・赤道・北極圏（白夜・極夜）の境界ケースを Vitest で検証
  - Files: `src/lib/computeSunTimes.ts`, `src/lib/computeSunTimes.test.ts`, `package.json`
  - Done when: 365 件ちょうど返り、日付が連続し、各 entry が ISO 8601 UTC 形式
  - Depends on: Task 2.1

- [ ] **Task 3.4**: `tokens.css` 作成 + Astro 全体への適用
  - What: design.md の Theme tokens セクションを実ファイル化。`:root` / `body.light-mode` / `body.night-mode` のスコープで CSS 変数を定義。`body` に `transition: var(--transition-theme)` を適用。Layout から `import "../styles/tokens.css"`
  - Files: `src/styles/tokens.css`, `src/layouts/Layout.astro`
  - Done when: dev サーバで `<body class="light-mode">` を手動付与すると light テーマに切り替わる
  - Depends on: Task 1.1

---

## Wave 4: コンポーネント（Task 2.1 + Task 3.4 完了後、並列）

- [ ] **Task 4.1**: `CardFront.astro` 実装
  - What: design.md UI Design § Layout に従い、アバター・氏名（日英）・肩書・tagline・SNS リンクアイコンを縦並びで配置。データは props 経由で `Profile` を受け取る。CSS 変数のみ使用、Tailwind は補助的に
  - Files: `src/components/CardFront.astro`
  - Done when: Storybook 的に props を渡してビルドし、360px viewport で表面が収まる
  - Depends on: Task 2.1, Task 3.4

- [ ] **Task 4.2**: `CardBack.astro` 実装(階層ドロップダウン + Repo card グリッド)
  - What: 3 段の `<select>` を縦積み、その下にリポジトリカードグリッド。各カードは `data-tags` 属性を持ち、`.repo-card` クラスで CSS フィルタ可能に。データは props で `Repo[]` と `HierarchyNode[]` を受け取る
  - Files: `src/components/CardBack.astro`, `src/components/RepoCard.astro`
  - Done when: 全 repo がカード表示される、非ヒット時の `.is-hidden` が適切に効く CSS が定義されている
  - Depends on: Task 2.1, Task 3.4

- [ ] **Task 4.3**: `TabSwitcher.astro` 実装
  - What: 表/裏タブを sticky top で配置。`<button data-face="front|back">` 2 つで構成。アクティブ時は `aria-selected="true"`
  - Files: `src/components/TabSwitcher.astro`
  - Done when: マークアップ + 静的スタイルが完成（クリック挙動は Wave 6 で配線）
  - Depends on: Task 3.4

---

## Wave 5: ページ組み立て（Wave 3 + Wave 4 完了後）

- [ ] **Task 5.1**: `src/pages/index.astro` 実装(build-time 統合)
  - What: design.md の Astro page front-matter スニペットを実装。`fetchRepos` + `mergeConfig` + `computeSunTimes` を呼び、結果を `cardData` にまとめて `<script id="card-data" type="application/json" set:html={JSON.stringify(cardData)} />` で埋め込み。`.card` ラッパに CardFront / CardBack / TabSwitcher を配置
  - Files: `src/pages/index.astro`
  - Done when: `npm run build` 成功、`dist/index.html` 内に `<script id="card-data">` が存在し、`CardData` スキーマ準拠
  - Depends on: Task 3.1, Task 3.2, Task 3.3, Task 4.1, Task 4.2, Task 4.3

---

## Wave 6: クライアントスクリプト（Task 5.1 完了後、並列）

- [ ] **Task 6.1**: `theme-init.inline.ts`（FOUC 防止インラインスクリプト）
  - What: design.md の Theme System § スニペットを実装。`<head>` 末尾に `<script is:inline>` として埋め込み、初期テーマクラスを `body` に即時付与。365日超過時の 18:00 境界フォールバック含む
  - Files: `src/scripts/theme-init.inline.ts`, `src/layouts/Layout.astro`（埋め込み配線）
  - Done when: 初期描画時に `body` がすでに `light-mode` か `night-mode` を持つ（Performance パネルで FOUC 確認なし）
  - Depends on: Task 5.1

- [ ] **Task 6.2**: `theme.ts`（10 分タイマーで再判定）
  - What: 起動後 `setInterval(reevaluate, 600000)` で再判定。日付キー再計算 → 該当 entry 検索 → 必要時のみクラス入替（`light-mode` ↔ `night-mode`）。手動切替 UI は実装しない
  - Files: `src/scripts/theme.ts`
  - Done when: ブラウザコンソールで `Date.now` をモックして 10 分経過させると class が切り替わる
  - Depends on: Task 6.1

- [ ] **Task 6.3**: `card-flip.ts`（3D flip + prefers-reduced-motion クロスフェード）
  - What: `[data-face]` ボタンクリックで `.card.is-flipped` をトグル。`matchMedia('(prefers-reduced-motion: reduce)').matches` を読み、true なら `transitionend` を `opacity` で待つ
  - Files: `src/scripts/card-flip.ts`, `src/styles/card.css`（@media reduced-motion 含む flip スタイル）
  - Done when: タブクリックで表裏切替が 600ms で完了、reduced-motion ON でクロスフェードに切替
  - Depends on: Task 5.1

- [ ] **Task 6.4**: `card-filter.ts`（URL param + 階層ドロップダウン制御）
  - What: design.md の `card-filter.ts` 起動シーケンスを実装。`?target=` 解釈 → `resolveTarget` → applyFilter → `history.replaceState('/')`。ドロップダウン操作で `.repo-card.is-hidden` を切り替え。`?target=` がない場合は表面表示で All
  - Files: `src/scripts/card-filter.ts`
  - Done when: `/?target=go` で Go タグの repo のみ表示され、URL が `/` に書き換わる
  - Depends on: Task 5.1

---

## Wave 7: テスト・ドキュメント・最適化（Wave 6 完了後、並列）

- [ ] **Task 7.1**: Playwright E2E テストスイート
  - What: design.md Testing Strategy § E2E の全シナリオを実装。時刻モック（`page.clock.setFixedTime`）で自動テーマ判定を検証、reduced-motion ON のクロスフェード、URL param、オフライン化（CDP `Network.emulateNetworkConditions`）、手動切替 UI が DOM に存在しないこと
  - Files: `tests/e2e/*.spec.ts`, `playwright.config.ts`
  - Done when: 全シナリオ green、CI で実行可能
  - Depends on: Task 6.1, Task 6.2, Task 6.3, Task 6.4

- [ ] **Task 7.2**: `docs/integration.md` 執筆（副次目標）
  - What: design.md の Integration Contract Documentation § 章立て案に沿って、コピー対象ファイル一覧 / 必須・任意 CSS 変数 / `card-config.json` スキーマ / テーマクラス命名 / geo 設定 / 再ビルド cron 例 / 変更履歴セクション を記述
  - Files: `docs/integration.md`
  - Done when: 他者が本ファイル 1 枚で移植手順を完了できる程度の情報密度
  - Depends on: Task 5.1, Task 6.1-6.4（実装が固まってから書く）

- [ ] **Task 7.3**: README 整備（主目標）
  - What: 自分用のセットアップ手順（`.env` に PAT 設定、`npm install`、`npm run build`、デプロイ手順）+ 副次目標としての `docs/integration.md` への誘導リンク
  - Files: `README.md`
  - Done when: 初見の開発者が README だけで動かせる
  - Depends on: Task 5.1

- [ ] **Task 7.4**: Lighthouse 計測 + 最適化
  - What: `dist/` をローカル静的サーバで配信し Lighthouse mobile 計測。Performance ≥ 95 を達成するまで最適化（critical CSS / 画像 srcset / unused JS 削減）
  - Files: 必要に応じて `astro.config.mjs`, `src/pages/index.astro`
  - Done when: Performance / Accessibility / Best Practices / SEO すべて ≥ 95
  - Depends on: Task 5.1, Task 6.1-6.4

- [ ] **Task 7.5**: 初回デプロイ手順確立
  - What: GitHub Pages / Cloudflare Pages / Vercel のいずれかを選定し、`GITHUB_PAT` を secrets に設定、ビルド成果物 `dist/` を公開。デプロイ後 URL を README に記載
  - Files: `.github/workflows/deploy.yml`（GitHub Actions 採用時）, `README.md`
  - Done when: 本番 URL で名刺ページが閲覧可能、`?target=go` のような URL パラメータが動作
  - Depends on: Task 7.4

---

## Progress

- Total: **22 タスク** | Wave 1-7 | Completed: 0 | In Progress: 0

### Wave サマリ

| Wave | タスク数 | 並列可能 | 主要成果 |
|---|---|---|---|
| 1 | 4 | 全て並列 | Astro プロジェクト + 設定ファイル + アセット |
| 2 | 1 | — | 型定義 |
| 3 | 4 | 全て並列 | 純粋関数 3 つ + tokens.css |
| 4 | 3 | 全て並列 | Front / Back / TabSwitcher コンポーネント |
| 5 | 1 | — | ページ統合（最大の合流点） |
| 6 | 4 | 全て並列 | テーマ・flip・filter のクライアント JS |
| 7 | 5 | 全て並列 | E2E / docs / Lighthouse / デプロイ |

---

## 確認事項（実装着手時に再確認）

- **Open Questions（design.md より）**:
  1. アバター画像 240×240px 円形で確定？
  2. SNS アイコンは `lucide-astro` か自前 SVG か → Task 4.1 で決定
  3. QR ファイル形式 PNG 512px 固定で OK？ → Task 1.3 で決定
  4. `theme-init.inline.ts` の埋め込み手段（`<script is:inline>` 推奨）→ Task 6.1 で決定
  5. JST 日付キーの生成方法（`Intl.DateTimeFormat('en-CA')` で `YYYY-MM-DD` 確定）→ Task 3.3 で決定

- **デプロイ先**: GitHub Pages / Cloudflare Pages / Vercel のどれを選ぶか → Task 7.5 で決定

- **PAT 設定**: 自分の GitHub アカウントから `public_repo` 権限のみの fine-grained PAT を発行し `.env` に設定（Task 1.4 で `.env.example` 整備済）
