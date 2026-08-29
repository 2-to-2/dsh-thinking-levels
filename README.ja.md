# dsh-thinking-levels

**[DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 向けのラウンド単位思考レベル（`reasoning_effort`）制御：セッションのモデルセレクターで `Auto`（マスク）を選ぶと、プラグインが直近のツール呼び出し履歴から `low` / `high` / `max` をスケジュールして API に提出します。あるいは `off` / `on` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max` を手動で固定。軽いツールラウンドは軽いまま、重い作業も推論不足になりません。**

- [English README](./README.md)
- [中文 README](./README.zh.md)
- [日本語 README](./README.ja.md)
- [한국어 README](./README.ko.md)
- [インストールガイド](./INSTALL.ja.md)
- [English installation guide](./INSTALL.md)
- [中文安装指南](./INSTALL.zh.md)
- [한국어 설치 안내](./INSTALL.ko.md)
- [Changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

> **互換性について：** `0.6.0` には日本語（`ja`）と韓国語（`ko`）の辞書と選択項目が含まれていますが、現在の公式 DSH は `LocaleRuntime` 経由で `zh` と `en` のみを提供しています。純正 DSH で `ja` または `ko` を選択すると `locale "<id>" is not registered` で失敗します。公式 DSH が対応 locale ID を追加するまで利用できません。上級ユーザーは DSH フォークを保守し、`packages/client/locale/src/locale-settings.ts` の `LOCALE_IDS` と `packages/client/locale/src/client/index.ts` の `LOCALES` ラベルを更新し、コア辞書とテストを追加して再ビルド・実行してください。このプラグインだけでは DSH のグローバル locale 一覧を拡張できません。

マルチステップのツールチェーンでは、モデルは**ツール呼び出しのたびに**再思考します——その思考がウォールクロック時間の大半を占めます（50 ステップのエージェントタスクはツール間に数分の推論を費やし得ます）。`dsh-thinking-levels` は、dsh が毎ステップ再解決する `agent/request` waterfall（`prepend` で最外層に登録し、セッションのモデル選択アセンブリに上書きされないようにする）に接続し、次のモデルリクエストに思考レベルを注入します。

## レベル

| レベル | 意味 | 場所 |
|---|---|---|
| `off` | 思考無効（手動のみ。自動スケジュールでは選択されません） | モデルセレクター / 既定レベル |
| `on` | 思考有効化（トグルのみのモデル向け）：`enable_thinking` のみ送信し、think effort は送信しません | モデルセレクター / 既定レベル |
| `minimal` | 最小（非常に軽いタスク） | モデルセレクター / 既定レベル |
| `low` | シンプルなチャットタスク用の手動低レベル（軽いラウンドは軽いまま） | モデルセレクター / 既定レベル |
| `medium` | 中 | モデルセレクター / 既定レベル |
| `high` | 公式既定レベル | モデルセレクター / 既定レベル |
| `xhigh` | 特高 | モデルセレクター / 既定レベル |
| `max` | 重い作業 | モデルセレクター / 既定レベル |
| `auto` | **マスク**：直近のツール呼び出し履歴からステップごとにスケジュールし、提出前に具体レベルへ解決 | モデルセレクター（プラグインが注入）/ 既定レベル |

ワイヤーレベルの事実（公式 DeepSeek ドキュメントと dsh の `llm-deepseek` アダプターで確認）：deepseek-v4-flash / v4-pro では `low` が 1:1 で有効、`medium` / `xhigh` は `high` に畳み込まれます。アダプターは `off | low | high | max` のみ受け付け、それ以外は `UNSUPPORTED_REASONING_EFFORT` で拒否します——`auto` はプラグインのマスク層で、API には送信されず、注入前に必ず具体的なワイヤーレベルへ解決されます。`on` は **effort レベルではありません**：トグルのみのモデル（Qwen3.6 形式）だけが広告し、`enable_thinking` を true にするだけ——`reasoning_effort` は送信されません。effort 対応モデルは `on` を広告しないため、手動で `on` を選んでも除去されます。

## カスタム送信値マッピング

`llm-pi-ai` で手動宣言したモデルでは、設定カードで各レベルをゲートウェイが実際に受け付ける値にマッピングできます（dsh-thinking-effort から借用）：レベルにチェックを入れ、送信値を入力します（例：`high` → `ultra`）。マッピングはモデルの `reasoningEfforts` テーブルとして保存され、Composer で `High` を選ぶとゲートウェイには `ultra` が送信されます。`off` を空欄にすると送信されません。

- 公式プリセット：`Off / High / Max`（公式 DeepSeek 形式）
- 汎用プリセット：`Off / Low / Medium / High`

## モデル能力ガード（v0.5.0）

このプラグインは、推論能力を宣言していないモデルに `reasoning_effort` を**送信しません**。カスタム openai-completions ルート（例：`reasoningEfforts` のないローカル Qwen3.6）は `ctx.llm.resolveModelInfo` で非推論モデルと判定され、継承・スケジュールを問わずすべてのレベルは**除去**されて送信されません——dsh のリクエスト毎 `UNSUPPORTED_REASONING_EFFORT` 拒否は発生しません。サポートされないフィールドが API に渡されることはありません。

| dsh バージョン | `low` の扱い |
|---|---|
| rc.6（旧） | 非ネイティブ：`models` オーバーライドで確認された場合のみセレクターに表示。表示（セレクター + リクエスト検証）後にそのまま透過 |
| rc.7+（新） | ネイティブ：プラグインは書き換えも再注入もしません。手動 `low` はそのまま透過 |

auto スケジューラーは対応モデルで `low` を選ぶことがあります——上記の能力ガードが受け取れないモデルから遠ざけます。

## モデルセレクターの Auto

セッションのモデルセレクター（モデルの横）には、ワイヤーレベルの後に **Auto** が表示されます（プラグインがモデルディレクトリのメタデータに注入）：

| セレクター選択 | 動作 |
|---|---|
| **Auto** | ツール履歴 + 昇降トグルでスケジュールし、提出前に `low` / `high` / `max` へ解決 |
| `off` / `on` / `minimal` / `low` / `medium` / `high` / `xhigh` / `max` | **手動選択が優先**——プラグインは介入しません（トグルのみのモデルでは `on` は `on` のまま。effort へ引き上げられず、effort 対応モデルでは除去されます） |
| 未選択 | プラグインの既定レベルが適用されます（下記） |

## 自動スケジューラー

ハブは `high`（公式既定）。`auto` は `low` / `high` / `max` の間でのみスケジュールし、`off` は選びません。

| 直近のツール呼び出し | レベル |
|---|---|
| なし（新しいプロンプト、純粋なチャット） | `low` |
| ≥75% がシンプルなツール・小さい引数・降格許可 | `low` |
| 混合 / 重いツール | `high` |
| 非常に重いペイロード・昇格許可 | `max` |

スケジュールポリシーは [dsh-tool-turbo](https://github.com/drscrewdriver/dsh-tool-turbo) と同源です（同じシンプルツールのホワイトリスト / ペイロード閾値 / 75% 比率ルール）。

## インストール

完全な手順（profile の確認、アップグレード、移行、検証、トラブルシューティング）は [INSTALL.ja.md](./INSTALL.ja.md) を参照してください。クイックスタート：

```bash
# 1. npm から profile へプラグインをインストール（例は web。任意の profile で可）
#    （web profile は pnpm workspace root なので -w が必須）
dsh plugin --profile web add dsh-thinking-levels -w
#    GitHub 版：
#    dsh plugin --profile web add https://github.com/drscrewdriver/dsh-thinking-levels.git -w
#    ローカルパス版（ネットワーク不要）：
#    dsh plugin --profile web add /absolute/path/to/dsh-thinking-levels

# 2. dsh web を再起動（実行中のインスタンスは新しい bundle 層をホットロードしない）
dsh web
```

> 注意：dsh ランタイムは pnpm 11 を使用し、新規公開バージョンは `minimumReleaseAge` のクーリング期間の対象です。`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` が発生したら、`~/.dsh/profiles/web/pnpm-workspace.yaml` の `minimumReleaseAgeExclude` にバージョンを追加してください。

手動 `link:` 登録（`dsh plugin add` の代替）：

```bash
#    ~/.dsh/profiles/web/package.json dependencies:
#      "dsh-thinking-levels": "link:<dsh-thinking-levels の絶対パス>"
#    ~/.dsh/profiles/web/cordis.patch.yml:
#      - insert:
#          - id: thinking-levels
#            name: dsh-thinking-levels
cd ~/.dsh/profiles/web && pnpm install && dsh web
```

## 設定

2 つの面が同じスキーマを共有します：

- **アセンブリ** — profile 構成のプラグイン行の `config:`（例：`cordis.yml`）：
  ```yaml
  config:
    level: auto            # off | on | minimal | low | medium | high | xhigh | max | auto — セッションが何も選ばないときの既定レベル
    allowDowngrade: true   # スケジューラーが `high` より下へ下げるのを許可
    allowUpgrade: false    # スケジューラーが `max` へ上げるのを禁止
  ```
- **ランタイム** — dsh-settings 名前空間 `thinking-levels`（`level`、`allowDowngrade`、`allowUpgrade`、`enabled`、`models`）：変更は次のモデルリクエストから有効、再起動不要。設定パネル（設定 → プラグイン → 設定可能なプラグイン）にビジュアルエディターがあります（レベルグリッド + 送信値入力 + 検索 + ワンクリックプリセット）。

モデル毎の能力オーバーライド（`models`、キーは `provider/model`）は自動検出の結果を確定します。構成者が最終判断します：

```yaml
config:
  level: auto
  models:
    llm-pi-ai/Qwen3.6-35B-A3B:   # 非 effort 思考モデル（思考トグル + budget）
      vision: false
      thinking: true
      efforts: false             # reasoning_effort を送信しない（リクエスト時に除去）
    llm-pi-ai/Qwen3.8-27B:       # effort 対応モデル（rc.6 時代のアダプターに low なし）
      efforts: [low, high]       # low を確認 → セレクター表示 + 透過
```

> Qwen の思考オン/オフ + budget は **llm-pi-ai** ルート側で設定します：
> `compat.thinkingFormat: qwen`（→ ワイヤー `enable_thinking` + `thinking_budget`、`thinkingBudgets` 経由）、または effort モデル（Qwen3.8-27B 等）では `qwen-chat-template`（→ `chat_template_kwargs.enable_thinking`）。

既定値：`{ enabled: true, level: 'auto', allowDowngrade: true, allowUpgrade: false, models: {} }`。

> 意味：モデルセレクターの選択はプラグインの既定レベルより優先されます。`auto`（マスク）→ プラグインがスケジュール。ワイヤーレベル → 直接適用。未選択 → プラグインの `level` 既定値。`allowDowngrade` / `allowUpgrade` は `auto` スケジュールのみを制約します。

## dsh-llm-openai-completions の自動引き継ぎ（v0.5.2）

カスタムゲートウェイ（vLLM / LM Studio / 自前の OpenAI 互換プロキシ）は、思考を宣言したら（`llm-pi-ai` のモデル行に `reasoningEfforts` テーブル）[dsh-llm-openai-completions](https://github.com/drscrewdriver/dsh-llm-openai-completions) がそのルートを引き継ぐ必要があります——そうしないと pi-ai が `role: "developer"`（400）を送信したり `enable_thinking` を落としたりします。このプラグインは引き継ぎリストを**自動保守**します：

- `llm-pi-ai.providers` をスキャンし、「カスタム openai-completions ゲートウェイ（`api: openai-completions` または非公式 baseURL）**かつ** いずれかのモデルが `reasoningEfforts` テーブルを宣言」する provider を特定；
- 自動的に `llm-openai-completions.providers` へマージし `enabled: true` に（手動追加分は保持、重複排除）；
- トリガー：プラグイン起動、`llm/adapters-updated`、`llm-pi-ai` または引き継ぎリストの設定変更——手動編集不要；
- ソフト結合：`llm-openai-completions` 未インストール（名前空間未登録）なら書き込みをスキップし、他機能に影響しません。

## 依存関係

host 側は `@deepseek-ai/dsh-settings` に値依存しません（設定登録は cordis の `settings` サービス経由。dsh ランタイムが提供）。profile への公式パッケージ手動インストールは不要です。`dependencies` は `@deepseek-ai/schemastery` のみ（パッケージと一緒に自動インストール）。

## 開発

```bash
npm run lint        # eslint（typescript-eslint flat config）
npm run typecheck   # tsc --noEmit
npm test            # vitest — 46 テスト
```

テストカバレッジ：レベルポリシー（手動透過・拡張レベル、`on` のクランプ、auto スケジューラー、検証、シンプルツール境界）、モデル能力ガード（`reasoningEffortSupported`、`resolveEffortInjection` の除去/透過）、セッションイベント解析（ガード、ウィンドウ上限、不正レコード）、設定スキーマ（既定値ロックステップ、越界拒否、`models` オーバーライド）、引き継ぎ同期（特定、重複排除マージ、ソフト結合）。

## ライセンス

MIT
