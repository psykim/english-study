# 에스텔 영어 공부 — 프로젝트 규칙

> 공통 연결 지도는 ../../CLAUDE.md (소프트웨어 허브). 이 파일은 이 앱에만 해당하는 것을 적는다.

유튜브 「에스텔잉글리쉬」 채널 영상을 올라온 순서대로 보며 공부하는 웹앱. 맥·안드로이드폰 브라우저에서 쓰고
진도(다 봤음·이어 볼 위치·다시 볼 것)는 두 기기가 공유한다. 사용자는 플랜비포유 대표(의사, 비개발자).

## 세션 시작 절차
1. `STATUS.md`를 읽는다(전체 정독 금지). 2. `git status` 확인. 3. 과거 결정은 `docs/history/INDEX.md`에서 찾는다.

## 구조 (빌드 단계 없음 — 파일을 고치면 그대로 배포물)
- `index.html`·`style.css`·`app.js`(화면·재생·동기화)·`core.js`(순수 로직: 합치기·시간 표기 — 시험 대상)
- `data/videos.json` — 영상·쇼츠·재생목록 목록(오래된 것부터). `tools/update_videos.py`가 만든다.
- 진도 저장: Supabase 프로젝트 `english-study`(ref `zvrrhhgxcbbqiphgxnap`, 서울). 표 `progress`는 RLS로 잠겨 있고
  `get_progress`·`save_progress` 함수로만 접근한다. 기기는 32자 열쇠(`#k=`)로 같은 줄을 공유한다.
- 재생: YouTube IFrame Player API(공식 퍼가기). 영상을 내려받거나 다시 올리지 않는다.

## 명령
```bash
node --test tests/*.test.js            # 시험 — 커밋 전 통과
python3 -m http.server 8765            # 로컬 확인 → http://localhost:8765/
python3 tools/update_videos.py         # 채널 새 영상 반영(yt-dlp) → 편수 변화 출력, 커밋·push하면 배포
git push origin main                   # 배포: GitHub Pages가 main 루트를 그대로 내보낸다(1~2분)
```
- 주소: https://psykim.github.io/english-study/ · 저장소: https://github.com/psykim/english-study (공개 — Pages 무료 조건)

## 절대 규칙 (실사고에서 나온 것만 — 사고가 날 때마다 추가)
- (아직 없음)

## 주의 (사고는 아니지만 구조상 지킬 것)
- 저장소가 공개다. 비밀 키를 넣지 않는다 — `app.js`의 Supabase 키는 공개용(publishable) 키뿐이다.
- 진도 형식 `v[id] = [고친 시각, 다 봤음, 위치(초), 다시 볼 것]`을 바꾸면 이미 저장된 진도와 맞지 않는다. 바꿀 땐 옮기는 코드를 같이.
- 화면을 바꾸면 커밋 전에 데스크톱(1280)·폰(400) 스크린샷을 사용자에게 보인다. AI 티 점검은 `/unslop`.

## git 운영 (Claude 전담)
작업 단위마다 커밋(한국어 제목: 무엇을 왜) → 시험 통과 → push(=배포). 버전 태그는 사용자가 쓰는 판이 바뀔 때.

## 분업
메인 세션: 원인 진단·판단·검수·사용자 소통. 위임: 잘 규정된 구현·넓은 탐색. 위임 결과는 diff 검수 + 시험 통과 뒤 반영.

## 사용자 소통
한국어, 결론부터. 결정이 필요한 것은 결재표(선택지+추천). 유료 전환·외부 공개 범위 변경은 반드시 결재.
