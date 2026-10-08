# CO2 테이블 트레이너 — 설계 스펙

- 날짜: 2026-10-08
- 상태: 사용자 검토 대기

## 1. 목적

프리다이빙 CO2 테이블 연습용 웹 앱. 휴대폰을 옆에 두고 눈을 감은 채 영어 음성 안내만으로 테이블 전체를 진행할 수 있어야 한다.

**성공 기준**
- 입력 3개로 테이블이 규칙대로 생성된다.
- 시작을 누르면 화면을 보지 않아도 음성만으로 모든 라운드를 끝까지 진행할 수 있다.
- 진행 중 화면이 꺼지지 않는다(지원 브라우저).
- 장시간 진행해도 타이머가 밀리지 않는다.

## 2. 요구사항

### 2.1 입력 (정수 초)

| 필드 | 의미 | 기본값 | 허용 범위 |
|---|---|---|---|
| `start` | 첫 행의 숨쉬기 시간 | 120 | 정수, ≥ 15 |
| `step` | 행마다 줄어드는 숨쉬기 시간 | 15 | 정수, ≥ 1 |
| `hold` | 숨참기 시간(모든 행 동일) | 60 | 정수, ≥ 1 |

빈 값, 소수, 숫자 아님, 범위 밖이면 해당 입력 아래에 오류를 표시하고 테이블을 만들지 않는다.

### 2.2 테이블 생성

- 열은 숨쉬기와 숨참기 2개다(화면에는 행 번호 `#`도 표시한다).
- k번째 행(k = 0, 1, …)의 숨쉬기는 `start − k × step`이다. 숨쉬기 값이 **15 이상인 행까지만** 만든다.
- 숨참기는 모든 행이 `hold`다.
- 예시
  - 120 / 15 → 숨쉬기 120, 105, 90, 75, 60, 45, 30, 15 (8행)
  - 100 / 30 → 100, 70, 40 (3행)
  - 15 / 아무 값 → 15 (1행)

### 2.3 진행 순서

`R1 숨쉬기 → R1 숨참기 → R2 숨쉬기 → R2 숨참기 → … → 마지막 행 숨참기 → 종료`

### 2.4 음성 안내 (영어, Web Speech API)

- 단계 시작
  - 숨쉬기: `"Round {n}. Breathe. {d} seconds."`
  - 숨참기: `"Hold. {d} seconds."`
- 카운트다운 지점은 남은 시간 기준으로 60, 30, 15, 10, 5, 4, 3, 2, 1초다.
  - 60, 30, 15, 10초 → `"{N} seconds"`
  - 5, 4, 3, 2, 1초 → `"{N}"`
  - 단계 시간 이상인 지점은 생략한다. 시작 멘트와 중복되지 않게 하기 위해서다.
    - d = 60이면 시작 멘트 다음이 30이다.
    - d = 45이면 60을 생략한다.
- 전체 종료: `"Table complete. Well done."`

### 2.5 조작

- **[테이블 만들기]**: 입력을 검증하고 테이블을 그린다.
- **[시작]**: 테이블이 있을 때만 활성화된다. 누르면 R1 숨쉬기부터 진행한다.
- 진행 중에는 버튼이 **[정지]**로 바뀐다.
  - 누르면 음성을 즉시 취소하고, 타이머를 멈추고, 강조를 제거하고, 시작 전 상태로 돌아간다.
- 진행 중에는 입력칸과 [테이블 만들기]를 비활성화한다.
- 일시정지와 라운드 건너뛰기는 없다(범위 밖).

### 2.6 대상 환경

모바일 우선(세로 화면, 큰 글씨·버튼). 최신 iOS Safari, Android Chrome, 데스크톱 브라우저.

## 3. 화면

한 페이지, 위에서 아래 순서:

1. 입력 3칸, 각 칸 아래 오류 메시지 영역, [테이블 만들기] 버튼
2. 음성 미지원 시 경고 배너("이 브라우저는 음성 안내를 지원하지 않습니다")
3. 테이블 `# | 숨쉬기 | 숨참기`
   - 진행 중인 행에 강조 표시
   - 현재 단계 칸에 추가 강조
4. 진행 패널
   - 현재 단계 라벨(BREATHE / HOLD / READY / DONE)
   - 남은 초(큰 글씨)
   - 라운드 `n / 총`
   - 단계별 배경색: 숨쉬기와 숨참기를 구분
5. [시작]/[정지] 큰 버튼

## 4. 구조

순수 로직(Node에서 테스트)과 브라우저 의존 코드를 분리한다. 빌드 도구와 런타임 의존성은 없다. ES 모듈을 사용한다.

```
index.html
styles.css
package.json        # {"type":"module","scripts":{"test":"node --test"}} — 의존성 없음
src/table.js        # 순수
src/schedule.js     # 순수
src/runner.js       # 시계·예약·음성 주입식
src/speech.js       # Web Speech 래퍼 (브라우저)
src/app.js          # DOM, Wake Lock (브라우저)
test/table.test.js
test/schedule.test.js
test/runner.test.js
```

### 4.1 `src/table.js`

```js
export const MIN_BREATHE = 15;

// raw: { start, step, hold } — 값은 문자열 또는 숫자
// 반환: { ok: true,  values: { start, step, hold }, errors: {} }
//     | { ok: false, errors: { start?: string, step?: string, hold?: string } }
export function validate(raw);

// 입력은 이미 검증된 정수
// 반환: [{ round: 1, breathe: 120, hold: 60 }, ...]
export function buildTable({ start, step, hold });
```

- 정수 판정: 앞뒤 공백을 제거한 문자열이 `/^\d+$/`에 맞아야 한다.
- 오류 메시지(한국어):
  - 정수가 아닐 때: `"정수를 입력하세요"`
  - start < 15: `"15초 이상이어야 합니다"`
  - step, hold < 1: `"1초 이상이어야 합니다"`

### 4.2 `src/schedule.js`

```js
export const COUNTDOWN_MARKS = [60, 30, 15, 10, 5, 4, 3, 2, 1];
export const COMPLETE_TEXT = 'Table complete. Well done.';

// 반환: [{ round, type: 'breathe' | 'hold', duration }, ...]  (2 × 행 수)
export function phases(table);

// 반환: 남은 초(at) 내림차순 [{ at, text }]
//   첫 항목은 { at: duration, text: 시작 멘트 }
//   이어서 COUNTDOWN_MARKS 중 mark < duration 인 것
export function announcements(phase);
```

### 4.3 `src/runner.js`

```js
// deps:
//   now(): number                 — ms (app: performance.now)
//   setTimer(fn, ms): handle      — app: setTimeout
//   clearTimer(handle)            — app: clearTimeout
//   speak(text)
//   onTick({ phaseIndex, phase, remaining })   — remaining: 표시할 남은 초(정수)
//   onPhase(phaseIndex, phase)                 — 단계 진입 시
//   onComplete()
export function createRunner(table, deps); // → { start(), stop() }
```

**타이밍 규칙**
- 틱 주기는 200ms다. 매 틱마다 `now()`로 다시 계산하고, 누적 덧셈을 쓰지 않는다.
- 단계 i의 종료 시각은 `phaseStart_i + duration × 1000`이다. 다음 단계 시작 시각은 이전 단계의 종료 시각과 같다(`now()`가 아님). 그래서 오차가 쌓이지 않는다.
- `remaining = Math.ceil((phaseEnd − now) / 1000)`
- 안내 발화 조건: 그 단계에서 아직 처리하지 않은 안내 중 `at === remaining`인 것을 말한다.
  - `at > remaining`인데 처리하지 않은 안내(틱이 늦어 건너뛴 것)는 말하지 않고 처리 완료로 표시한다. 밀린 안내를 몰아서 말하지 않기 위해서다.
- `remaining ≤ 0`이면 다음 단계로 넘어간다.
  - 한 번의 틱에서 여러 단계를 건너뛰어야 하면, 지나간 단계는 조용히 넘긴다. 단, `onPhase`는 각 단계마다 호출한다.
  - 현재 단계의 시작 멘트도 위의 at/remaining 규칙을 그대로 따른다.
- 마지막 단계가 끝나면 `speak(COMPLETE_TEXT)`와 `onComplete()`를 호출하고 틱을 멈춘다.
- `start()`
  - 단계 0으로 진입하면서 `onPhase(0, …)`를 호출한다.
  - 즉시 1회 틱을 실행한다. 이 틱에서 시작 멘트가 나간다.
- `stop()`
  - 예약된 타이머를 해제한다.
  - 이후 어떤 콜백도 호출하지 않는다.
  - 음성 취소는 app이 맡는다.

### 4.4 `src/speech.js`

```js
// 반환: { supported: boolean, unlock(), speak(text), cancel() }
export function createSpeech(win = window);
```

- **음성 선택**: `en-US` → `en-`으로 시작하는 음성 → 없으면 voice를 지정하지 않고 `lang = 'en-US'`
  - `voiceschanged` 이벤트가 오면 다시 선택한다.
- **`speak(text)`**: 진행 중인 발화가 있으면 `speechSynthesis.cancel()`로 끊고 새 발화를 즉시 재생한다(최신 발화 우선). 카운트다운이 늦게 들리는 것보다 이전 멘트가 잘리는 편이 낫다. 실제로 잘리는 경우는 단계 시간이 5초 이하일 때뿐이다.
- **`unlock()`**: [시작] 클릭 핸들러 안에서 빈 발화(`' '`)를 1회 재생한다(iOS 대응).
- **미지원(`!('speechSynthesis' in win)`)**: `supported = false`로 두고 메서드는 아무것도 하지 않는다.

### 4.5 `src/app.js`

- DOM을 연결하고 버튼 상태와 표시를 갱신한다.
- `createRunner`를 생성할 때 실제 `performance.now`, `setTimeout`, `clearTimeout`, `speech.speak`를 주입한다.
- **Wake Lock**
  - 시작 시 `navigator.wakeLock?.request('screen')`을 호출하고, 실패하면 무시한다.
  - `document.visibilityState === 'visible'`이 되면 진행 중일 때 재요청한다.
  - 정지하거나 완료되면 해제한다.
- **[정지]**: `runner.stop()` → `speech.cancel()` → Wake Lock 해제 → UI를 READY로 되돌린다.

## 5. 예외 처리

| 상황 | 동작 |
|---|---|
| 음성 미지원 | 경고 배너를 띄우고, 타이머·화면 표시는 정상 동작 |
| 영어 음성 없음 | `lang='en-US'`로 기본 음성 사용 |
| Wake Lock 미지원·거부 | 무시 |
| 탭이 백그라운드로 가 타이머가 지연 | 경과 시간으로 현재 단계를 다시 계산하고, 밀린 안내는 생략 |
| 잘못된 입력 | 필드별 오류를 표시하고, 테이블과 [시작]은 갱신하지 않음 |

## 6. 테스트

`npm test` (= `node --test`), 의존성 없음.

**table**
- 120/15/60 → 8행, 숨쉬기 [120 … 15], 모든 hold 60
- 100/30 → [100, 70, 40]
- start = 15 → 1행
- 오류: start = 14, step = 0, hold = 0, `""`, `"1.5"`, `"abc"`
- 공백이 섞인 `" 120 "` → 허용

**schedule**
- `phases`: 길이 2n, 순서 breathe/hold 교대, round 번호
- `announcements`
  - d = 120 → at [120, 60, 30, 15, 10, 5, 4, 3, 2, 1]
  - d = 60 → [60, 30, 15, 10, 5, 4, 3, 2, 1] (60은 시작 멘트 하나뿐)
  - d = 45 → [45, 30, 15, …]
  - d = 15 → [15, 10, 5, …]
  - d = 5 → [5, 4, 3, 2, 1]이고, 그중 at = 5는 시작 멘트
  - 텍스트 형식: 시작 멘트, `"30 seconds"`, `"3"`

**runner (가짜 시계와 가짜 타이머)**
- 1행 테이블(15/x/10)을 끝까지 진행했을 때 발화 순서 전체와 `onComplete`
- 단계 전환 시 `onPhase` 호출 순서
- 200ms 틱 지터가 있어도 각 안내는 정확히 1회만 발화
- `stop()` 이후 콜백 없음
- 시간을 크게 건너뛰면(예: 숨쉬기 중 40초 점프) 밀린 안내는 생략하고 현재 시점부터 정상 진행

**수동 (실기기)**
- iOS Safari와 Android Chrome에서 음성 발화, 화면 꺼짐 방지, 정지 동작 확인

## 7. 구현 분담 (팀 모드)

인터페이스는 4장에 고정되어 있으므로 병렬로 진행할 수 있다.

| 담당 | 작업 |
|---|---|
| 에이전트 1 | `table.js`, `schedule.js`, 해당 테스트 |
| 에이전트 2 | `runner.js`, 해당 테스트 (schedule 인터페이스만 의존) |
| 에이전트 3 | `index.html`, `styles.css`, `speech.js`, `app.js` |
| 리드 | `package.json`, 통합, 전체 테스트, 코드 리뷰 |

## 8. 범위 밖

일시정지, 라운드 건너뛰기, 기록 저장, 설정 저장, 진동, 다국어 음성, PWA/오프라인.
