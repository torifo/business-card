# 要件定義書 (Requirements Definition) — デジタル名刺システム

## Overview

既存の Astro ポートフォリオサイトを拡張し、物理カード不要のデジタル名刺 UI を実装する。
URL パラメータによる初期出し分け（Galaxy 連携）と、画面内の階層ドロップダウンによる対面動的切り替えを組み合わせたハイブリッド型を採用する。
ビルド時に GitHub API からリポジトリデータを取得・埋め込むことで、クライアントサイドの通信をゼロにし、悪環境下でも即時動作を保証する。

---

## User Stories

### US-001: 初期出し分け（QR スキャン）
**As a** イベント参加者（発表側） **I want to** 相手の技術背景に合わせた QR を1タップで表示したい  
**So that** 相手がスキャンした瞬間に最適化された名刺が表示される

**Acceptance Criteria:**
- WHEN `/card?target=go` が読み取られる THE SYSTEM SHALL Go タグのリポジトリのみを初期表示する
- WHEN `/card?target=flutter` が読み取られる THE SYSTEM SHALL Flutter タグのリポジトリのみを初期表示する
- WHEN `target` パラメータが未指定の場合 THE SYSTEM SHALL 全リポジトリを表示する（All）
- WHEN 初期フィルタリング完了後 THE SYSTEM SHALL URL から `?target=*` を削除して `/card` に書き換える

### US-002: 対面プレゼンでの動的切り替え
**As a** イベント参加者（発表側） **I want to** 会話の流れに応じてリポジトリを階層ドロップダウンで瞬時に絞り込みたい  
**So that** 相手の興味に合わせた作品を画面遷移なしで提示できる

**Acceptance Criteria:**
- WHEN カテゴリドロップダウンが操作される THE SYSTEM SHALL ネットワーク通信なしで対応するサブカテゴリと実績を即座に表示する
- WHEN フィルタリングが切り替わる THE SYSTEM SHALL 切り替えアニメーションを 300ms 以内で完了する

### US-003: 悪環境下での安定表示
**As a** 名刺受取側 **I want to** 電波の悪い会場でもスムーズに名刺を閲覧したい  
**So that** ネットワーク状態に左右されず作品を確認できる

**Acceptance Criteria:**
- WHILE 初期 HTML ロード完了後 THE SYSTEM SHALL 一切の外部ネットワーク通信なしで全機能を提供する
- IF GitHub API が利用不可の場合 THE SYSTEM SHALL ビルド済みデータのみで名刺を表示する（ランタイムエラーなし）

---

## Functional Requirements

### FR-001: 表面（固定情報エリア）の表示
**Priority:** P0  
**Persona:** 名刺受取側

THE SYSTEM SHALL 氏名・アバター画像・肩書・主要リンク（GitHub / X / Qiita）を外部 API 通信なしで表示する  
WHEN 名刺ページが読み込まれる THE SYSTEM SHALL 表面の全情報をスクロールなしで1画面に収める（画面幅 360px〜430px 基準）  
**Rationale:** 表面情報は変更頻度が低く、外部依存をなくすことで可用性を最大化する

### FR-002: 裏面（動的実績エリア）の表示
**Priority:** P0  
**Persona:** 名刺受取側

THE SYSTEM SHALL ビルド時に取得・整形されたリポジトリ情報をカード型 UI で一覧表示する  
WHEN リポジトリカードが表示される THE SYSTEM SHALL リポジトリ名・説明・スター数・言語/タグ・GitHub リンクを含める  
**Rationale:** 作品の提示が名刺の主目的であり、GitHub の最新情報を反映しつつ API 依存をなくす必要がある

### FR-003: 表裏フリップ＋タブ切り替え UI
**Priority:** P0  
**Persona:** 名刺受取側・発表側

THE SYSTEM SHALL 表面と裏面を切り替えるタブ（表 / 裏）を常時表示する  
WHEN タブが切り替えられる THE SYSTEM SHALL CSS 3D フリップアニメーション（duration: 600ms）で表裏を反転表示する  
WHEN フリップアニメーション完了後 THE SYSTEM SHALL 切り替え先の面の全要素が視認できる状態にする  
**Rationale:** 物理名刺の「ひっくり返す」体験をデジタルで再現し、タブは操作コントロール、フリップはそのアニメーション表現とする

### FR-004: URL パラメータによる初期フィルタリング
**Priority:** P0  
**Persona:** 名刺受取側

WHEN URL に `?target={tag}` パラメータが含まれる THE SYSTEM SHALL 対応タグのリポジトリのみを表示し、裏面を初期表示とする  
WHEN `target` 値に対応するリポジトリが存在しない THE SYSTEM SHALL All（全表示）にフォールバックする  
WHEN `target` パラメータが存在しない THE SYSTEM SHALL 表面を初期表示とし、裏面は All（全表示）をデフォルトとする  
**Rationale:** Galaxy 端末から1タップで相手向けに最適化した名刺を提示するための入口となる

### FR-005: URL パラメータのクレンジング
**Priority:** P1  
**Persona:** 名刺受取側

WHEN 初期フィルタリング処理が完了した後 THE SYSTEM SHALL `window.history.replaceState` を用いて URL を `/card` に書き換える  
THE SYSTEM SHALL ブラウザの「戻る」履歴を汚染しない（`pushState` は使用しない）  
**Rationale:** QR スキャン後にパラメータを隠すことで仕組みを秘匿し、ハッカーライクな演出を実現する

### FR-006: 階層タグセレクター（対面プレゼン用）
**Priority:** P0  
**Persona:** 発表側（対面操作）

THE SYSTEM SHALL 裏面にカテゴリ→サブカテゴリの階層ドロップダウンを配置する  
WHEN カテゴリドロップダウンが選択される THE SYSTEM SHALL 対応するサブカテゴリの選択肢を表示する  
WHEN タグが確定される THE SYSTEM SHALL DOM の表示/非表示クラスのみを操作し、ネットワーク通信を発生させない  
WHEN フィルタリングが切り替わる THE SYSTEM SHALL CSS transition（duration: 300ms, easing: ease）でアニメーションを実行する  
THE SYSTEM SHALL 階層構造およびタグ一覧は `card-config.json` から読み込み、ハードコードしない  
**Rationale:** 相手の職種・興味に合わせてリアルタイムに絞り込むため。階層を設定ファイルで管理することで将来の拡張を可能にする

> **NOTE（設計フェーズで確定）:** 階層の粒度とフロー（例: skill → language → go / category → travel / design）は design.md で定義する

### FR-007: ビルド時 GitHub API データ取得・埋め込み
**Priority:** P0  
**Persona:** 開発者（ビルドパイプライン）

WHEN Astro ビルドが実行される THE SYSTEM SHALL GitHub API `/users/{username}/repos` から全公開リポジトリを取得する  
WHEN ビルドが完了する THE SYSTEM SHALL 整形済みデータを HTML 内の `window.__CARD_DATA__` または `data-` 属性としてインライン埋め込みする  
THE SYSTEM SHALL ランタイムで GitHub API を呼び出す処理を一切含まない  
**Rationale:** API レートリミットの回避とオフライン動作の両立のため、SSG でデータを静的化する

### FR-008: ローカルデータ整形・マージロジック
**Priority:** P1  
**Persona:** 開発者（コンテンツ管理）

WHEN ビルド時データ取得後 THE SYSTEM SHALL `card-config.json` の設定を GitHub 生データにマージする  
THE SYSTEM SHALL `card-config.json` で指定されたリポジトリを表示対象から除外できる  
THE SYSTEM SHALL `card-config.json` のカスタムタイトル・説明で GitHub のメタデータを上書きできる  
THE SYSTEM SHALL `card-config.json` で技術タグおよび階層カテゴリを明示的に割り当てられる  
**Rationale:** GitHub の生データは英語・未設定が多く、名刺として見せるための日本語上書きや除外制御が不可欠

### FR-009: QR コードアセットの管理
**Priority:** P1  
**Persona:** 発表側

THE SYSTEM SHALL リポジトリ内に以下の2種の QR コード画像アセットを格納する:
- `/card`（デジタル名刺）へのリンク QR
- ポートフォリオサイトトップへのリンク QR

THE SYSTEM SHALL QR コードを高解像度（最低 512px × 512px）で生成・格納する  
**Rationale:** 物理カードの代替として Galaxy 端末から即時表示できる QR を一元管理する。カード画面への直接埋め込みは行わない。

---

## Non-Functional Requirements

- **Performance:** タグ切り替え応答時間 0ms（ネットワーク通信なし）。Lighthouse Performance スコア 95 以上を維持する
- **Offline:** 初期 HTML ロード完了後、以降の全操作はネットワーク通信なしで動作すること
- **Scalability:** GitHub API レートリミットの影響を受けない設計とする
- **API Auth（推奨）:** ビルド時の GitHub API 呼び出しは PAT（Personal Access Token）を環境変数で管理する。未認証は 60 req/h のため、ビルドパイプラインの安定性確保に PAT（5000 req/h）を推奨する
- **Responsive:** 画面幅 360px〜430px・縦 650px〜900px の範囲で、スクロールなしに表面コア情報と裏面セレクターが視認・操作できること
- **Security:** PAT を含む認証情報はクライアントサイドに露出しない

## Configuration Management

- `card-config.json` はリポジトリに含めてバージョン管理する（推奨）
- コンテンツ設定（表示/非表示・タグ割り当て・説明文上書き）の変更履歴を Git で追跡できることがその理由

---

## Future Considerations

- GitHub Actions による定期自動ビルド（特定トピック追加時または週次 cron）
- Galaxy 端末の「モードとルーチン」を活用した QR 即時表示マクロの構築
