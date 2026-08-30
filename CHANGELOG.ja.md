# 変更履歴

`dsh-thinking-levels` の主な変更を記録します。

- [English changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

## [0.7.0] — 2026-08-30

### 追加

- **マルチレベル コンテキストウィンドウ プリセット**（モデル別能力エディター）：`64K / 128K / 256K / 400K / 512K / 1M` のプリセットボタンに加え、カスタム整数入力とクリアボタンを追加。`llm-pi-ai` モデルの `contextWindow` に書き込まれ、ハーネスが次のリクエストから再起動なしでライブに消費します（圧縮 / コンテキストオーバーフロー検出 / コンテキスト圧力予測）。
- 新しい純粋モジュール `src/context-window.ts`（範囲定数 `2000`–`1_000_000`、プリセット一覧、`formatContextWindow`、`validateContextWindow`）を追加。設定スキーマ、設定カード、テストで共有されます。
- 設定面：`models[].contextWindow` オーバーライドを整数 `2000`–`1000000` の検証付きで受け付けます（範囲外の値は fail-loud）。
- コンテキストウィンドウコントロールの `zh` / `en` / `ja` / `ko` コピーを追加。

### 変更

- コンテキストバッジが共有の `formatContextWindow` を再利用するように変更。書き込まれたプリセットがそのまま表示されます（例：`256000` → `256K`、`1000000` → `1M`）。

## [0.6.0] — 2026-02-?

### 追加

- **8 つの標準レベル**（dsh-thinking-effort に合わせて）：`off / on / minimal / low / medium / high / xhigh / max`（+ `auto` スケジューラーマスク）。`on` は思考有効化トグルで、モデルの既定強度（`high` または最高の宣言済み思考レベル）にクランプされます。`minimal` / `medium` / `xhigh` はカスタムゲートウェイが宣言していれば透過し、公式アダプターでは `high` に畳み込まれます。
- **設定カードのカスタム送信値マッピング**（dsh-thinking-effort から借用）：各レベルにチェックを入れ、ゲートウェイに送信する値を入力（例：`high` → `ultra`）。`off` を空欄にすると送信されません。モデルの `reasoningEfforts` テーブルとして保存されます。
- **設定カードの表示刷新**（dsh-thinking-effort から借用）：プロバイダーがモデルをグループ化し、各モデル行はテキスト/画像/コンテキストバッジを表示、モデルはレベル別エディターに展開、検索ボックスでモデルを絞り込み、ワンクリックプリセット（公式 DeepSeek 形式 / 汎用）を全思考モデルに適用。
- **多言語対応**：日本語（`ja`）と韓国語（`ko`）の辞書、`README.ja.md` / `README.ko.md`、`INSTALL.{md,zh,ja,ko}.md`、`CHANGELOG.{md,ja,ko}.md`。注：公式 DSH の locale ランタイムはまだ `zh` / `en` のみ公開しているため、`ja` / `ko` の選択には DSH フォークが必要です（README の互換性注記を参照）。

### 変更

- `level` 設定面は 9 値すべてを受け付けます（`off | on | minimal | low | medium | high | xhigh | max | auto`）。
- `models[].efforts` オーバーライドは拡張レベルを受け付けます。
- カードレンダラーをリファクタリング。能力エディターは即時チェックボックスコミットではなく、明示的な「レベルを適用」ボタン付きのステージ型ワイヤードラフトを使用します。

### 修正

- 未使用ヘルパー `effortLevelsOf` を削除。レガシー `_N` 未使用パラメータの lint 警告を抑制。

## [0.5.2] — 2026-02-?

### 追加

- **`dsh-llm-openai-completions` の自動引き継ぎ**：カスタム openai-completions ゲートウェイ（`api: openai-completions` または非公式 baseURL）**かつ** いずれかのモデルが `reasoningEfforts` テーブルを宣言する provider を `llm-openai-completions.providers` に `enabled: true` でマージ。プラグイン起動、`llm/adapters-updated`、設定変更時に実行。ソフト結合（名前空間未登録なら書き込みをスキップ）。

## [0.5.1] — 2026-02-?

### 追加

- モデル能力エディターカード：すべてのカスタム `llm-pi-ai` プロバイダーモデルに視覚 / 思考 / effort サポート / effort レベル / 思考形式を提供し、`llm-pi-ai` 設定名前空間へ直接書き込み（公式パッケージの変更なし）。

## [0.5.0] — 2026-02-?

### 追加

- モデル能力ガード：推論能力を宣言していないモデルに `reasoning_effort` を送信しない（Qwen3.6 などのカスタム openai-completions ルートは除去）。
- dsh rc.7+ での `low` 透過。rc.6 時代のアダプターは構成者が確認した `models` オーバーライドで `low` を広告可能。
- `models` 設定セクション（`provider/model` → `vision` / `thinking` / `efforts`）。

## [0.4.1] — 2026-02-?

### 修正

- adapter `resolveModel` のラップが `llm/adapters-updated` で再実行されるようにし、アダプターがプラグイン適用後に登録されても `Auto` マスクが表示されるように。

## [0.4.0] — 2026-02-?

### 変更

- `@deepseek-ai/dsh-settings` への値依存を撤廃。設定登録は cordis `settings` サービス経由（ローカルの `installSettingsSection` 相当）。
- カード登録に `id` と `key` の両方を指定し、CLI（keyed）と DSH Desktop（list）の slot 宣言の両方で動作。

## [0.3.0] — 2026-02-?

### 追加

- モデルセレクターの `Auto`（マスク）：adapter `resolveModel` の efforts に注入。プラグインが `agent/request` waterfall（`prepend` 登録）で `low` / `high` / `max` をステップごとにスケジュール。

## [0.2.1] — 2026-02-?

### 修正

- `exports["./client"]` を追加し、dsh の client-modules ローダーが client bundle を発見できるように。

## [0.2.0] — 2026-02-?

### 追加

- 最初の client 設定カード（レベルピッカー + スケジューラートグル）。

## [0.1.1] — 2026-02-?

### 修正

- 生の TS ソースではなくコンパイル済み `lib/` を公開（Node 22 は `node_modules` 配下の `.ts` の type-stripping を禁止）。

## [0.1.0] — 2026-02-?

### 追加

- 初回リリース：固定 reasoning effort の `agent/request` 注入。
