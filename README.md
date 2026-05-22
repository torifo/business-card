# Digital Business Card

物理カード不要のデジタル名刺システム。Astro 5 + Tailwind 4 で構築する独立サイトとして、ポートフォリオ（`portorifo.riumu.net`）と整合したテーマで動作する。

## Status

設計フェーズ完了、実装着手前

## SDD Specification

仕様書一式は `docs/spec/` 配下にある：

- [`requirements.md`](docs/spec/requirements.md) — 機能要件・非機能要件・ユーザーストーリー
- [`design.md`](docs/spec/design.md) — アーキテクチャ・データモデル・テーマシステム設計
- [`tasks.md`](docs/spec/tasks.md) — 22 タスク × 7 Wave の実装計画

## Goals

- **Primary**: 自分のポートフォリオから自分用のデジタル名刺を生成・運用する
- **Secondary**: 他者が自身のサイトに移植できる雛形として `docs/integration.md` に拡張ガイドを併設する（実装後に追加予定）

詳細な README は実装完了後（Task 7.3）に整備する。
