# 要件定義書 (Requirements Definition) — デジタル名刺システム

## Overview

既存の Astro ポートフォリオサイトを拡張し、物理カード不要のデジタル名刺 UI を実装する。
URL パラメータによる初期出し分け（Galaxy 連携）と、画面内の階層ドロップダウンによる対面動的切り替えを組み合わせたハイブリッド型を採用する。
ビルド時に GitHub API からリポジトリデータを取得・埋め込むことで、クライアントサイドの通信をゼロにし、悪環境下でも即時動作を保証する。

### Project Goals

- **Primary（主目標）**: 自分のポートフォリオから自分用のデジタル名刺を生成・運用する
- **Secondary（副次目標）**: 主目標を達成する過程で得られる汎用的なアーキテクチャを、他者が自身のサイトに移植できる雛形として **同一リポジトリ内のドキュメント**（README / `docs/integration.md`）に公開する

リポジトリの主アイデンティティは「庄司彬人のデジタル名刺」であり、その内部ドキュメントとして「他者ポートフォリオへの拡張ガイド」を併設する構成とする。汎用テンプレートを別パッケージ・別リポジトリとして切り出すことはしない。副次目標のためだけにスコープや実装複雑度を膨らませない。

### Portfolio Relationship

本デジタル名刺リポジトリと、デザインソースとなるポートフォリオサイトは **別リポジトリ・別デプロイ** とする。

- **ポートフォリオ（デザインソース）**: `portorifo.riumu.net` で公開中の別リポジトリ（`/Users/akito-shoji/dev/web/portfolio-astro` ローカル）。Astro 5 + Tailwind 4 + React 19 で構築
- **本リポジトリ（デジタル名刺）**: 名刺ページ単体として独立してビルド・デプロイされる

#### ポートフォリオ側のテーマシステム実態（観測事実：ソース + 本番デプロイ済 CSS）

| 項目 | 実装 |
|---|---|
| テーマクラス | `body.light-mode` / `body.night-mode`（`prefers-color-scheme` は未使用） |
| モード | Light / Dark / Auto の 3 択（ドロップダウン UI） |
| Auto モードのロジック | 日の出/日没時刻（東京 緯度 35.6762, 経度 139.6503）と現在時刻（JST）の比較 |
| Auto モードのデータ取得 | ランタイムで `https://api.sunrise-sunset.org/json` を fetch、localStorage にキャッシュ（JST 日付ベースで 1 日有効） |
| 再判定間隔 | 1 分ごと（`setInterval`） |
| API 失敗時のフォールバック | 18:00 を境に切り替え |
| 手動選択の永続化 | なし（リロードで Auto に戻る） |
| **デフォルト状態** | クラス未付与時は **night-mode 相当**（dark gradient + 白文字）。`body.light-mode` は加算的なオーバーライドクラス |
| デザイントークン（パレット） | Tailwind 4 が `--color-blue-500: oklch(...)` 等のパレット変数を自動生成（本番 CSS で確認） |
| デザイントークン（セマンティック） | **`--color-bg` / `--color-text` 等のセマンティック変数は未定義**。`body.light-mode .text-gray-300 { color: #1f2937 !important }` 形式の手書きオーバーライドが約 120 ルール存在 |
| トランジション | `body { transition: background .5s, color .3s }` |
| 主要カラー（ダーク） | body 背景グラデ `linear-gradient(135deg, #0f0f23, #1a1a2e, #16213e)`、文字 `#fff`、アクセント `text-cyan-400` (oklch 78.9%) |
| 主要カラー（ライト） | body 背景グラデ `linear-gradient(135deg, #cbd5e1, #94a3b8, #64748b)`、文字 `#1f2937`、cyan アクセント `#0c4a6e` |

#### 名刺側での整合方針

- **テーマクラス命名はポートフォリオに揃える**（`body.light-mode` / `body.night-mode`）。クラス未付与時は night-mode 相当のデフォルト表示にする
- **Auto モードのロジックは継承するが、データはビルド時計算で埋め込む**（NFR Offline を維持するため、ランタイム API 呼び出しを排除）
- **セマンティック CSS 変数は名刺側で新規導入する**（ポートフォリオには未定義のため）。初期値はポートフォリオの現在カラーを写経し、ポートフォリオ更新時は手動同期
- **Tailwind 4 採用の可否は design.md で確定**（採用すれば値の写経が容易）
- **手動切替 UI を持たない**（Auto オンリー）。ポートフォリオは Light/Dark/Auto 3 モードを提供するが、名刺は閲覧時間が短いため複雑度を削減
- **フォントの整合は行わない**：ポートフォリオは Inter / JetBrains Mono（Google Fonts CDN）を使用しているが、名刺はオフライン要件と独自の見た目を優先し、別フォントまたはシステムフォントを選択可能とする

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

### US-004: ポートフォリオと一貫した自動テーマ表示（日没連動・常時 Auto）
**As a** 名刺受取側 **I want to** 訪問時刻に応じて自動でライト/ダークが切り替わる名刺を見たい  
**So that** ポートフォリオサイトと同じ「日没で雰囲気が変わる」体験を名刺でも享受でき、視覚的一貫性が保たれる

**Acceptance Criteria:**
- WHEN 名刺ページが初期ロードされる THE SYSTEM SHALL ビルド時に埋め込まれた日の出/日没時刻と現在時刻（JST）を比較し、日中はライト・夜間はダークで起動する
- WHEN ページ表示中に時刻が日没/日の出をまたぐ THE SYSTEM SHALL ページリロードなしで自動的にテーマを切り替える
- THE SYSTEM SHALL **テーマの手動切替 UI を提供しない**（名刺は常時自動モードで動作。手動切替は Future Considerations で扱う）
- THE SYSTEM SHALL ポートフォリオと同一の CSS クラス命名規約（`body.light-mode` / `body.night-mode`）を使用する

**Note:** ポートフォリオは Light/Dark/Auto の 3 モードを手動選択可能だが、名刺は閲覧時間が短く意思決定の余地が少ないため、Auto オンリーに絞ってシンプル化する。「日没連動」というユニークな体験性は維持される

### US-005: 他者ポートフォリオへの再利用・カスタマイズ（副次目標）
**As a** 本リポジトリを参考に自分のサイトでもデジタル名刺を実装したい開発者 **I want to** リポジトリ内の統合ガイドに従い、自分のポートフォリオに本システムの構造を移植したい  
**So that** ゼロから設計せず、検証済みの設定ファイル契約とテーマトークン命名規約を雛形として再利用できる

**Acceptance Criteria:**
- WHEN 利用者がリポジトリの README または `docs/integration.md` を参照する THE SYSTEM SHALL 統合に必要な情報（コピー対象ファイル一覧・`card-config.json` スキーマ・必須/任意の CSS 変数一覧・`prefers-color-scheme` の購読方法）を一通り把握できる状態にする
- WHEN 利用者が `card-config.json` の profile / hierarchy / overrides を書き換える THE SYSTEM SHALL ソースコード変更なしで内容を反映する
- WHEN 利用者がテーマトークン（CSS 変数）定義ファイルを書き換える THE SYSTEM SHALL カラー・タイポグラフィ・スペーシングを UI 全体で一括反映する
- THE SYSTEM SHALL 個人特化情報（氏名・GitHub ユーザー名・SNS リンク・アバター画像パス）を一切ソースコードにハードコードしない
- THE SYSTEM SHALL ポートフォリオ（デザインソース）側との結合点（CSS 変数命名規約・`card-config.json` スキーマ契約・`prefers-color-scheme` の共通購読）をリポジトリ内ドキュメントに明記する

**Scope Note:** 本ストーリーは Primary（自分の名刺）達成の過程で副次的に成立する成果として位置づける。汎用化のためだけに追加ライブラリ・抽象化・別パッケージ化を行わない

---

## Functional Requirements

### FR-001: 表面（固定情報エリア）の表示
**Priority:** P0  
**Persona:** 名刺受取側

THE SYSTEM SHALL 氏名・アバター画像・肩書・リンク（GitHub を必須項目、X・Qiita・LinkedIn・Email を任意項目として受け付ける）を外部 API 通信なしで表示する  
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
WHEN `target` 値に対応するリポジトリが存在しない THE SYSTEM SHALL 裏面を初期表示しつつ All（全表示）にフォールバックする  
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
THE SYSTEM SHALL GitHub ユーザー名・プロフィール情報（氏名・肩書・SNS リンク・アバター画像パス）を `card-config.json` から取得し、ソースコードにハードコードしない  
**Rationale:** GitHub の生データは英語・未設定が多く、名刺として見せるための日本語上書きや除外制御が不可欠。同時に、再利用者が設定ファイル差し替えだけで本システムを自分用にカスタマイズできるよう、個人特化情報をすべて設定に集約する

### FR-009: QR コードアセットの管理
**Priority:** P1  
**Persona:** 発表側

THE SYSTEM SHALL リポジトリ内に以下の2種の QR コード画像アセットを格納する:
- `/card`（デジタル名刺）へのリンク QR
- ポートフォリオサイトトップへのリンク QR

THE SYSTEM SHALL QR コードを高解像度（最低 512px × 512px）で生成・格納する  
**Rationale:** 物理カードの代替として Galaxy 端末から即時表示できる QR を一元管理する。カード画面への直接埋め込みは行わない。

### FR-010: 日没連動の自動テーマ切り替え（Auto オンリー・オフライン対応）
**Priority:** P0  
**Persona:** 名刺受取側

#### CSS クラス
THE SYSTEM SHALL テーマ状態を `body.light-mode` / `body.night-mode` の CSS クラスで表現する（ポートフォリオと同一命名規約）  
THE SYSTEM SHALL 手動切替 UI（ドロップダウン・トグルボタン等）を**提供しない**（Auto オンリー）

#### 自動判定ロジック
WHEN ページが初期ロードされる THE SYSTEM SHALL ビルド時に埋め込まれた日の出/日没時刻データと現在時刻（JST）を比較してテーマを判定する  
- IF 現在時刻が `sunrise ≦ now ≦ sunset` の範囲内 THEN THE SYSTEM SHALL `body.light-mode` を適用する  
- IF 範囲外 THEN THE SYSTEM SHALL `body.night-mode` を適用する  

WHILE ページが表示中 THE SYSTEM SHALL 10 分ごとに自動判定を再実行し、日没/日の出をまたいだ場合はテーマを切り替える  
WHEN テーマクラスが切り替わる THE SYSTEM SHALL `transition: background 0.5s, color 0.3s` 相当の遷移でなめらかに反映する（ポートフォリオ互換）

#### オフライン整合（NFR Offline と連動）
THE SYSTEM SHALL ランタイムで sunrise-sunset.org 等の外部 API を呼び出さない  
THE SYSTEM SHALL 日の出/日没データはビルド時に **最低 365 日分** を計算し、`window.__CARD_DATA__` 等の埋め込みデータに含める  
THE SYSTEM SHALL 緯度・経度は `card-config.json` から取得しハードコードしない（ポートフォリオは東京 35.6762 / 139.6503 を使用、デフォルト値として採用）

**Rationale:** ポートフォリオの「日没で自動切替」というユニークな体験を再現しつつ、(a) NFR Offline 維持のため API 呼び出しを排除し、(b) 名刺は閲覧時間が短く意思決定の余地が少ないため手動切替 UI を省略してシンプル化する。緯度経度を設定可能にすることで副次目標（他者再利用）にも対応する

### FR-011: 汎用デザインカスタマイズ（テーマトークン集約・名刺側で新規導入）
**Priority:** P1  
**Persona:** 開発者（再利用者・自分）

THE SYSTEM SHALL カラー・タイポグラフィ・スペーシング・ボーダー半径などのデザイントークンを CSS 変数として単一ファイル（例: `src/styles/tokens.css`）に集約する  
THE SYSTEM SHALL コンポーネント実装内で色・フォント・サイズを直接記述（ハードコード）せず、全て CSS 変数経由で参照する  
THE SYSTEM SHALL ライト/ダークそれぞれのトークン値を `body.light-mode { --xxx: ... }` / `body.night-mode { --xxx: ... }` のスコープで切り替え可能にする  
WHEN 利用者がトークン定義ファイルを書き換える THE SYSTEM SHALL HTML/JS のコード変更なしで UI 全体の見た目を切り替える

**Note:** ポートフォリオ（デザインソース）は Tailwind 4 が生成するパレット変数（`--color-blue-500` 等）を持つが、**セマンティック CSS 変数**（`--color-bg`, `--color-text` 等）は未定義。本名刺リポジトリは **より整理された形** としてセマンティック CSS 変数集約を新規導入し、初期値はポートフォリオの現在カラーを写経して定義する。ポートフォリオ更新時は手動で値を同期する。**フォントの整合は対象外** とし、名刺は独自選択可能とする

**Rationale:** 名刺システムを汎用テンプレートとして再利用可能にする。本人のブランドでも、他者のブランドでも、トークン差し替えだけで適応できる構造とする。ポートフォリオ側より整理された設計を採ることで、副次目標（他者再利用）の価値を高める

### FR-012: デザイン整合および再利用のための契約点
**Priority:** P1  
**Persona:** 開発者（再利用者）／自分（ポートフォリオ更新時の同期者）

THE SYSTEM SHALL ポートフォリオ（デザインソース）とのデザイン整合および他者再利用のための契約点を以下の 3 点に限定する:
- **テーマクラス命名規約**: `body.light-mode` / `body.night-mode`（ポートフォリオと完全互換）
- **CSS 変数命名規約**: 名刺側で新規導入するトークン名一覧（`--color-bg`, `--color-text`, `--color-accent` 等）。値はポートフォリオの現在カラーを写経
- **`card-config.json` のスキーマ契約**: コンテンツ・プロフィール・緯度経度（自動テーマ判定用）の設定

THE SYSTEM SHALL ポートフォリオ（デザインソース）固有の DOM 構造・グローバル JS API・独自ルーティング機構には依存しない（別リポジトリ・別デプロイ前提）  
THE SYSTEM SHALL ランタイムでポートフォリオ側のリソース（CSS / JS / API）を fetch しない（クロスオリジン依存ゼロ）  
THE SYSTEM SHALL 上記 3 点の契約をリポジトリ内ドキュメント（README または `docs/integration.md`）に明記する  
**Rationale:** ポートフォリオが別リポジトリ・別デプロイである以上、ランタイム連携は不可能。命名規約と値定義を本リポジトリ内に複製しつつ、その契約をドキュメント化することで、(a) ポートフォリオ更新時の手動同期、(b) 他者による移植、の双方を低結合で実現する

---

## Non-Functional Requirements

- **Performance:** タグ切り替え応答時間 0ms（ネットワーク通信なし）。Lighthouse Performance スコア 95 以上を維持する
- **Offline:** 初期 HTML ロード完了後、以降の全操作（テーマ判定を含む）はネットワーク通信なしで動作すること。自動テーマ判定に必要な日の出/日没時刻データはビルド時に最低 365 日分を計算・埋め込みし、ランタイムでは外部 API（sunrise-sunset.org 等）を呼び出さない（FR-010 と連動）
- **Scalability:** GitHub API レートリミットの影響を受けない設計とする
- **API Auth（推奨）:** ビルド時の GitHub API 呼び出しは PAT（Personal Access Token）を環境変数で管理する。未認証は 60 req/h のため、ビルドパイプラインの安定性確保に PAT（5000 req/h）を推奨する
- **Responsive:** 画面幅 360px〜430px・縦 650px〜900px の範囲で、スクロールなしに表面コア情報と裏面セレクターが視認・操作できること
- **Accessibility:** WCAG 2.1 AA レベル準拠を目標とする。`prefers-reduced-motion: reduce` が有効な環境では CSS 3D フリップアニメーションを **クロスフェード（opacity 300ms ease の置換）** にフォールバックさせ、3D 回転は無効化する。階層ドロップダウンはキーボード操作（Tab / Enter / Esc）に対応する
- **Theme Consistency:** ポートフォリオ（デザインソース）はセマンティック CSS 変数を持たず、Tailwind 4 が生成するパレット変数 + `body.light-mode .xxx` 形式の手書きオーバーライドで実装されている。名刺側は独立にセマンティック CSS 変数によるトークン集約を行い、(a) テーマクラス命名（`body.light-mode` / `body.night-mode`）と (b) カラー値はポートフォリオの本番 CSS から写経して保つ（手動同期）。**フォント整合は対象外**（名刺は独自フォントまたはシステムフォントを選択可能）
- **Browser Support:** Chrome / Edge / Safari の最新 2 メジャーバージョンと、iOS Safari 16 以降を対象とする
- **Data Freshness:** リポジトリ更新の名刺への反映は **手動ビルド・手動デプロイ** によって行う（イベント前などの必要なタイミングで `git push --allow-empty` 等により再ビルドをトリガーする）。SLA としての反映時間目標は設定しない
- **Repo Count Boundary:** 公開リポジトリ 500 件以下の範囲で Performance 目標を維持する
- **Portability / Reusability（副次目標）:** 他者が自分のポートフォリオに本システムの構造を移植する際、`card-config.json` の差し替えと CSS 変数（テーマトークン）の上書きのみでコード変更なしに利用可能とする
- **Integration Contract Documentation（副次目標）:** 公開する CSS 変数の命名規約・`card-config.json` のスキーマ・統合手順を本リポジトリ内の README または `docs/integration.md` に明記し、他ポートフォリオへの組み込みを再現可能にする
- **Security:** PAT を含む認証情報はクライアントサイドに露出しない

## Configuration Management

- `card-config.json` はリポジトリに含めてバージョン管理する（推奨）
- コンテンツ設定（表示/非表示・タグ割り当て・説明文上書き）の変更履歴を Git で追跡できることがその理由
- 個人特化情報（氏名・肩書・GitHub ユーザー名・SNS リンク・アバター画像パス）は **すべて `card-config.json` に集約** し、ソースコード（`.astro` / `.ts` / `.tsx`）にハードコードしない
- テーマトークン（CSS 変数）の定義は単一ファイル（例: `src/styles/tokens.css`）に集約し、ポートフォリオ（デザインソース）側から命名規約に従って上書き可能とする
- `card-config.json` のスキーマと CSS 変数命名規約に破壊的変更が入った場合、README または `docs/integration.md` の変更履歴セクションに追記する（再利用者への配慮。SemVer 形式の厳格運用は本リポジトリの主目標ではないため必須としない）

---

## Future Considerations

- GitHub Actions による定期自動ビルド（週次 cron 等）の追加。手動運用で不足が出た場合に Data Freshness を SLA 化して導入する
- リポジトリ更新を webhook で検知して即時再ビルドする仕組み（さらに鮮度が必要になった場合）
- Galaxy 端末の「モードとルーチン」を活用した QR 即時表示マクロの構築
- 手動テーマトグル UI の追加（OS 設定とは独立に名刺画面上でテーマ切り替え可能にする拡張）
