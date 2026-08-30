# 변경 기록

`dsh-thinking-levels`의 주요 변경 사항을 기록합니다.

- [English changelog](./CHANGELOG.md)
- [日本語 changelog](./CHANGELOG.ja.md)
- [한국어 changelog](./CHANGELOG.ko.md)

## [0.7.0] — 2026-08-30

### 추가

- **다중 수준 컨텍스트 창 프리셋**(모델별 기능 편집기): `64K / 128K / 256K / 400K / 512K / 1M` 프리셋 버튼과 사용자 지정 정수 입력 및 지우기 버튼. `llm-pi-ai` 모델의 `contextWindow`에 기록되고 하네스가 다음 요청부터 재시작 없이 라이브로 소비합니다(압축 / 컨텍스트 오버플로 감지 / 컨텍스트 압력 예측).
- 새 순수 모듈 `src/context-window.ts`(범위 상수 `2000`–`1_000_000`, 프리셋 목록, `formatContextWindow`, `validateContextWindow`)를 추가했습니다. 설정 스키마, 설정 카드, 테스트에서 공유합니다.
- 구성 표면: `models[].contextWindow` 오버라이드를 정수 `2000`–`1000000` 검증과 함께 허용합니다(범위 밖 값은 fail-loud).
- 컨텍스트 창 컨트롤의 `zh` / `en` / `ja` / `ko` 문구를 추가했습니다.

### 변경

- 컨텍스트 배지가 공유 `formatContextWindow`를 재사용하여 기록된 프리셋이 그대로 표시됩니다(예: `256000` → `256K`, `1000000` → `1M`).

## [0.6.0] — 2026-02-?

### 추가

- **8개 표준 수준**(dsh-thinking-effort에 맞춤): `off / on / minimal / low / medium / high / xhigh / max`(+ `auto` 스케줄러 마스크). `on`은 사고 활성화 토글로 모델 기본 강도(`high` 또는 가장 높은 선언 사고 수준)로 클램프됩니다. `minimal` / `medium` / `xhigh`는 사용자 지정 게이트웨이가 선언하면 통과하고 공식 어댑터에서는 `high`로 접힙니다.
- **설정 카드의 사용자 지정 전송 값 매핑**(dsh-thinking-effort에서 차용): 각 수준을 체크하고 게이트웨이에 보낼 값을 입력(예: `high` → `ultra`). `off`를 비워 두면 전송되지 않습니다. 모델의 `reasoningEfforts` 테이블로 저장됩니다.
- **설정 카드 표시 개편**(dsh-thinking-effort에서 차용): 제공자가 모델을 그룹화하고, 각 모델 행은 텍스트/이미지/컨텍스트 배지를 표시하며, 모델을 펼치면 수준별 편집기가 되고, 검색 상자로 모델을 필터링하며, 원클릭 프리셋(공식 DeepSeek 방식 / 일반 방식)을 모든 사고 모델에 적용합니다.
- **다국어 지원**: 일본어(`ja`)와 한국어(`ko`) 사전, `README.ja.md` / `README.ko.md`, `INSTALL.{md,zh,ja,ko}.md`, `CHANGELOG.{md,ja,ko}.md`. 참고: 공식 DSH locale 런타임은 아직 `zh` / `en`만 제공하므로 `ja` / `ko` 선택에는 DSH 포크가 필요합니다(README 호환성 참고 참조).

### 변경

- `level` 구성 표면이 9개 값 전체를 받습니다(`off | on | minimal | low | medium | high | xhigh | max | auto`).
- `models[].efforts` 오버라이드가 확장 수준을 받습니다.
- 카드 렌더러 리팩터링. 능력 편집기는 즉시 체크박스 커밋 대신 명시적「수준 적용」버튼이 있는 스테이지형 와이어 드래프트를 사용합니다.

### 수정

- 미사용 헬퍼 `effortLevelsOf` 제거. 레거시 `_N` 미사용 매개변수 lint 경고 억제.

## [0.5.2] — 2026-02-?

### 추가

- **`dsh-llm-openai-completions` 자동 인계**: 사용자 지정 openai-completions 게이트웨이(`api: openai-completions` 또는 비공식 baseURL) **그리고** 어떤 모델이 `reasoningEfforts` 테이블을 선언한 provider를 `llm-openai-completions.providers`에 `enabled: true`로 병합. 플러그인 시작, `llm/adapters-updated`, 설정 변경 시 실행. 소프트 결합(네임스페이스 미등록이면 쓰기 건너뜀).

## [0.5.1] — 2026-02-?

### 추가

- 모델 기능 편집기 카드: 모든 사용자 지정 `llm-pi-ai` 제공자 모델에 시각 / 사고 / effort 지원 / effort 수준 / 사고 형식을 제공하고 `llm-pi-ai` 설정 네임스페이스에 직접 기록(공식 패키지 변경 없음).

## [0.5.0] — 2026-02-?

### 추가

- 모델 기능 가드: 추론 기능을 선언하지 않은 모델에 `reasoning_effort`를 보내지 않음(Qwen3.6 등 사용자 지정 openai-completions 라우트는 제거).
- dsh rc.7+에서 `low` 통과. rc.6 시대 어댑터는 구성자가 확인한 `models` 오버라이드로 `low`를 광고 가능.
- `models` 구성 섹션(`provider/model` → `vision` / `thinking` / `efforts`).

## [0.4.1] — 2026-02-?

### 수정

- adapter `resolveModel` 래핑이 `llm/adapters-updated`에서 다시 실행되어 어댑터가 플러그인 적용 후 등록되어도 `Auto` 마스크가 표시됩니다.

## [0.4.0] — 2026-02-?

### 변경

- `@deepseek-ai/dsh-settings` 값 의존성 제거. 설정 등록은 cordis `settings` 서비스 경유(로컬 `installSettingsSection` 동등물).
- 카드 등록에 `id`와 `key`를 모두 지정하여 CLI(keyed)와 DSH Desktop(list) slot 선언 모두에서 작동.

## [0.3.0] — 2026-02-?

### 추가

- 모델 선택기 `Auto`(마스크): adapter `resolveModel` efforts에 주입. 플러그인이 `agent/request` waterfall(`prepend` 등록)에서 `low` / `high` / `max`를 스텝별로 스케줄링.

## [0.2.1] — 2026-02-?

### 수정

- `exports["./client"]` 추가로 dsh의 client-modules 로더가 client bundle을 발견.

## [0.2.0] — 2026-02-?

### 추가

- 첫 client 설정 카드(수준 선택기 + 스케줄러 토글).

## [0.1.1] — 2026-02-?

### 수정

- 원본 TS 소스 대신 컴파일된 `lib/`를 게시(Node 22는 `node_modules` 아래 `.ts`의 type-stripping 금지).

## [0.1.0] — 2026-02-?

### 추가

- 최초 릴리스: 고정 reasoning effort의 `agent/request` 주입.
