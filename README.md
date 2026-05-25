# Digital Business Card

物理カード不要のデジタル名刺サイト。Astro 5 + Tailwind 4 で構築する独立 SSG として、ポートフォリオ (`portorifo.riumu.net`) のデザインシステムと整合させた見た目で動作する。本番: <https://business-card.riumu.net>

QR から相手の興味に合わせた tag で初期出し分けし、対面でも階層ドロップダウンでリアルタイムに作品を絞り込める。ビルド時に GitHub API + 日没/日の出データを取り込み、ランタイムでは外部通信ゼロで動作する。

## Goals

- **Primary**: 自分のポートフォリオから自分用のデジタル名刺を生成・運用する
- **Secondary**: 他者が自身のサイトに移植できる雛形として、移植ガイド ([`docs/integration.md`](docs/integration.md)) を併設する

## Features

### 操作
- 名刺の表/裏フリップ UI (CSS 3D rotateY, 600ms, `prefers-reduced-motion` ON 時はクロスフェードに自動切替)
- カードを **ドラッグして自由に 3D 回転**（マウス・タッチ両対応）、離すと近い面に snap
- カード本体を **2 連続タップ/ダブルクリックで表↔裏トグル**（350ms 以内）
- 表/裏タブ（既定: 表紙 / 裏面）クリックで snap
- `?target=<tag>` の URL パラメータで裏面初期化 + tag フィルタ (Galaxy のモードルーチン等から 1 タップ起動)、適用後は URL を `/` に書き換え

### 言語切替
- UI 既定は日本語（表紙・裏面・カテゴリ・サブカテゴリ・タグ・該当する作品がありません 等）
- 右上の **EN / 日本語ピル**ボタンで `<html lang>` 属性を `ja ↔ en` でトグル
- ラベルは `.i18n-ja` / `.i18n-en` の二段スパン構造で、CSS が表示側を切り替える

### フィルタ
- 3 段の階層ドロップダウン (Category > Subcategory > Tag) による対面動的フィルタ
- ドロップダウンは **実在するタグだけ列挙**（0 件タグは選択肢から除外）
- 裏面スクロール中もフィルタは **上部に sticky 固定**で常時操作可能
- ヒット 0 件時は「該当する作品がありません」メッセージ表示

### テーマ
- ポートフォリオと同じ日没連動の自動テーマ切替 (`body.light-mode` / `body.night-mode`) — 手動切替 UI 無し
- ビルド時に 365 日分の SunCalc データを HTML にインライン埋め込み (ランタイム通信ゼロ)
- セマンティック CSS 変数によるテーマトークン (`src/styles/tokens.css`)

### データ
- ビルド時に GitHub API から公開リポジトリを取得し `card-config.json` とマージして HTML に JSON インライン埋め込み
- リポジトリ名のプレフィックスから自動 tag 付与 (`namePrefixTags`、例: `design-*` → `design`)
- GitHub primary language → leaf id 自動マッピング (Go / TypeScript / Python / Dart)
- `repoOverrides` で個別の name / description / tags の上書き、`excludeRepos` で除外、`pinnedRepos` で先頭固定

## Tech Stack

- [Astro 5](https://astro.build/) (SSG, Island Architecture)
- [Tailwind 4](https://tailwindcss.com/) (`@tailwindcss/vite`)
- TypeScript strict
- [SunCalc](https://github.com/mourner/suncalc) (ビルド時の日の出/日没計算)
- Vanilla TypeScript (クライアント JS は < 15KB gzip 目標)
- Vitest (unit テスト)

## Quick Start

```bash
# 依存をインストール
npm install

# .env を用意 (GitHub API レート対策に PAT 推奨)
cp .env.example .env
# .env を開いて GITHUB_PAT=ghp_... を設定 (fine-grained, Public Repositories read-only で十分)

# dev サーバ
npm run dev
# http://localhost:4321/

# 本番ビルド
npm run build
# 出力: dist/

# ビルド成果をプレビュー
npm run preview
```

## Project Structure

```
business-card/
├── card-config.json       コンテンツ設定 (プロフィール・geo・hierarchy・上書き)
├── public/
│   ├── favicon.png        円形マスク付き favicon (256×256, アバターから生成)
│   ├── images/avatar.png  アバター本体 (775×773 PNG, CSS で circular クロップ)
│   └── qr/{card,portfolio}.png  QR コード (512×512px, level H)
├── src/
│   ├── pages/index.astro         ビルド時統合のエントリ
│   ├── layouts/Layout.astro      <head> で全クライアント JS を hoist
│   ├── components/
│   │   ├── CardFront.astro       表面 (91:55 横長レイアウト, GitHub アイコンは SVG)
│   │   ├── CardBack.astro        裏面 (sticky フィルタ + repo グリッド)
│   │   ├── RepoCard.astro        リポジトリカード (name / description / tags / link)
│   │   ├── TabSwitcher.astro     表紙 / 裏面 切替タブ (i18n 対応)
│   │   └── LanguageToggle.astro  EN / 日本語 トグルピル
│   ├── lib/
│   │   ├── fetchRepos.ts         GitHub API + ローカル dev キャッシュ
│   │   ├── mergeConfig.ts        card-config を生データに適用 (namePrefixTags 含む)
│   │   └── computeSunTimes.ts    SunCalc で 365 日分計算
│   ├── scripts/
│   │   ├── theme-init.inline.ts  初期テーマ即時適用 (FOUC 抑止)
│   │   ├── theme.ts              10 分タイマーで再判定
│   │   ├── card-flip.ts          表/裏フリップ snap (タブクリック)
│   │   ├── card-3d.ts            自由 3D ドラッグ + ダブルタップトグル
│   │   ├── card-filter.ts        URL param + ドロップダウン制御 (availability フィルタ)
│   │   └── lang.ts               言語切替 (<html lang> トグル)
│   ├── styles/
│   │   ├── global.css            tailwindcss / tokens / card / i18n CSS のエントリ
│   │   ├── tokens.css            セマンティック CSS 変数 (light/night)
│   │   └── card.css              カードのレイアウトと 3D フリップ
│   └── types/card.ts             ドメイン型定義
└── docs/
    ├── spec/                     SDD 仕様 (requirements / design / tasks)
    └── integration.md            他ポートフォリオへの移植ガイド
```

## Configuration (`card-config.json`)

| キー | 用途 |
|---|---|
| `profile` | 氏名・肩書・tagline・SNS リンク・アバターパス |
| `geo` | 日没/日の出計算の緯度経度と IANA TZ (既定: 東京) |
| `hierarchy` | 階層ドロップダウンの定義 (Category > Subcategory > Tag) |
| `repoOverrides` | repo 単位の name / description / tags の上書き |
| `excludeRepos` | 表示対象から外す repo full_name |
| `pinnedRepos` | 先頭に固定する repo full_name (順序反映) |
| `namePrefixTags` | リポジトリ名のプレフィックスで tag を自動付与 (例: `{ "design-": "design" }`) |

スキーマの全容は [`src/types/card.ts`](src/types/card.ts) を参照。`_note` や未知フィールドは `mergeConfig` で無視されるためメタ情報を追加しても安全。

## Theme

セマンティック CSS 変数は [`src/styles/tokens.css`](src/styles/tokens.css) に集約。`:root` は night-mode の既定値で、`body.light-mode` が日中の値を上書きする。日没連動のロジックは `theme-init.inline.ts` / `theme.ts` を参照。

## Deployment

本番デプロイは ポートフォリオ (`portorifo.riumu.net`) と同じ Docker + nginx-proxy 構成に相乗りする。

- **Domain**: `business-card.riumu.net` (Let's Encrypt 自動取得)
- **Image**: `ghcr.io/torifo/business-card:<tag>`
- **Network**: `global-proxy-network` (VPS で稼働中の共通ネットワーク)

### 流れ

1. `main` への push で `.github/workflows/deploy.yml` が起動し、Astro ビルド → Docker イメージを GHCR に push する
2. VPS に SSH し、`deploy.sh [tag]` を実行して新しいイメージを pull + restart
3. nginx-proxy が `business-card.riumu.net` へのトラフィックをコンテナに振り分ける

### 必要な GitHub Secrets

| Secret 名 | 用途 |
|---|---|
| `GH_PAT_PUBLIC` | ビルド時 GitHub API レート対策 (`public_repo` 読み取りのみで十分) |
| `GITHUB_TOKEN` | GHCR への push 用 (Actions が自動付与) |

### ローカル動作確認 (Docker)

```bash
npm run build
docker build -t business-card:dev .
docker run --rm -p 8080:80 business-card:dev
# http://localhost:8080/
```

## QR Codes (Galaxy modes & routines)

`?target=<tag>` の URL を埋め込んだ tag 別 QR を `public/qr/` に一括生成できる。Galaxy の **モードとルーチン** にそれぞれ別の QR 画像を割り当てて、相手の興味に応じて 1 タップで該当 QR を全画面表示する運用を想定している。

```bash
# hierarchy 全 leaf 分 + card.png + portfolio.png を生成
npm run qr

# 別ドメインで生成したい場合
QR_BASE_URL=https://example.com npm run qr
```

生成されるファイル:

- `public/qr/card.png` — 素のカード URL (`?target=` 無し)
- `public/qr/portfolio.png` — `card-config.json` の `profile.links` で `type: "portfolio"` のリンク先
- `public/qr/target-<leaf-id>.png` — 各 leaf に対応 (例: `target-go.png` → `/?target=go`)

### Galaxy ルーチン側の最小手順

> 詳細は One UI のバージョンで変わるため概要のみ。

1. 上記 QR 画像をギャラリーアプリに転送 (Quick Share / Google Drive 等)
2. **設定 > モードとルーチン > ルーチン > +** で新規ルーチン作成
3. 開始条件: アイコンタップ / クイックパネルから / ジェスチャー / NFC タグ 等から選択
4. 実行内容: **ギャラリーで開く** または **画像を全画面表示** で対象 QR を指定
5. 利き手に近いホームショートカットなどに置くと素早く呼び出せる

## Testing

```bash
# Unit (Vitest, src/lib/*)
npm test

# E2E (Playwright, tests/e2e/*)
npm run test:e2e

# 型チェック (Astro + TS)
npm run check
```

E2E は preview サーバを `playwright.config.ts` の webServer 設定で自動起動する。

## Reuse for Your Own Portfolio (Secondary Goal)

本リポジトリの構造は他のサイトに移植できる雛形として設計されている。[`docs/integration.md`](docs/integration.md) を参照のこと。

## License

TBD(To Be Determined)
