# Digital Business Card

物理カード不要のデジタル名刺サイト。Astro 5 + Tailwind 4 で構築する独立 SSG として、ポートフォリオ (`portorifo.riumu.net`) のデザインシステムと整合させた見た目で動作する。

QR から相手の興味に合わせた tag で初期出し分けし、対面でも階層ドロップダウンでリアルタイムに作品を絞り込める。ビルド時に GitHub API + 日没/日の出データを取り込み、ランタイムでは外部通信ゼロで動作する。

## Goals

- **Primary**: 自分のポートフォリオから自分用のデジタル名刺を生成・運用する
- **Secondary**: 他者が自身のサイトに移植できる雛形として、移植ガイド ([`docs/integration.md`](docs/integration.md)) を併設する

## Features

- 名刺の表/裏フリップ UI (`prefers-reduced-motion` ON 時はクロスフェードに自動切替)
- `?target=<tag>` の URL パラメータで裏面初期化 + tag フィルタ (Galaxy のモードルーチン等から 1 タップ起動)
- 3 段の階層ドロップダウン (Category > Subcategory > Tag) による対面動的フィルタ
- ポートフォリオと同じ日没連動の自動テーマ切替 (`body.light-mode` / `body.night-mode`) — 手動切替 UI 無し
- ビルド時に GitHub repos + 365 日分の SunCalc データを HTML にインライン埋め込み (ランタイム通信ゼロ)
- セマンティック CSS 変数によるテーマトークン (`src/styles/tokens.css`)

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
│   ├── images/avatar.png  アバター (240×240px 円形推奨)
│   └── qr/{card,portfolio}.png  QR コード (512×512px)
├── src/
│   ├── pages/index.astro         ビルド時統合のエントリ
│   ├── layouts/Layout.astro      <head> でテーマ + フリップ + フィルタ JS を hoist
│   ├── components/
│   │   ├── CardFront.astro       表面 (91:55 横長レイアウト)
│   │   ├── CardBack.astro        裏面 (ドロップダウン + repo グリッド)
│   │   ├── RepoCard.astro        リポジトリカード
│   │   └── TabSwitcher.astro     表/裏切替タブ
│   ├── lib/
│   │   ├── fetchRepos.ts         GitHub API + ローカル dev キャッシュ
│   │   ├── mergeConfig.ts        card-config を生データに適用
│   │   └── computeSunTimes.ts    SunCalc で 365 日分計算
│   ├── scripts/
│   │   ├── theme-init.inline.ts  初期テーマ即時適用 (FOUC 抑止)
│   │   ├── theme.ts              10 分タイマーで再判定
│   │   ├── card-flip.ts          表/裏フリップ制御
│   │   └── card-filter.ts        URL param + ドロップダウン制御
│   ├── styles/
│   │   ├── global.css            tailwindcss / tokens / card のエントリ
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

## Testing

```bash
# unit (Vitest)
npm test

# 型チェック
npm run check
```

## Reuse for Your Own Portfolio (Secondary Goal)

本リポジトリの構造は他のサイトに移植できる雛形として設計されている。[`docs/integration.md`](docs/integration.md) を参照のこと。

## License

TBD
