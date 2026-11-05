# MarrySafe (메리세이프) 웹사이트 — 인수인계 문서

작성일: 2026-11-05
대상: 관리자툴 연동을 담당하는 외부 팀

> 이 문서는 추측 없이 **현재 코드에 실제로 존재하는 것만** 기록했습니다.
> 특히 중요한 점: **이 저장소에는 "예약" 데이터를 저장하는 기능이 없습니다.** 자세한 내용은 [3. 예약 데이터](#3-예약-데이터)를 반드시 먼저 읽어 주세요.

---

## 1. 사용 기술

| 항목 | 내용 |
|---|---|
| 프론트엔드 | 빌드 도구 없는 **순수 정적 HTML/CSS/JS**. 프레임워크·번들러·npm 스크립트 없음. 각 `.html` 파일에 `<style>`, `<script>` 가 인라인으로 들어 있음 |
| 백엔드 | Vercel 서버리스 함수 **1개**: `api/send-pdf.js` (Node.js, CommonJS) |
| 외부 서비스 | Google Apps Script(메일 발송), Firebase Realtime Database(REST, 사이트 배너·팝업 설정), EmailJS(웨딩홀 정보 폼), Google Fonts, html2pdf.js(CDN) |
| 의존성 | `package.json` 에 `nodemailer`, `puppeteer-core`, `@sparticuz/chromium`. **`nodemailer` 는 코드에서 전혀 사용하지 않는 미사용 의존성** |
| 데이터베이스 | **예약용 DB 없음.** Firebase RTDB 는 사이트 배너/팝업/가격 문구 설정만 저장 |

### 배포 위치

| 항목 | 값 |
|---|---|
| 호스팅 | Vercel |
| Vercel 프로젝트명 | `marrysafe-website` |
| 운영 주소 | https://marrysafe.co.kr |
| `www` 주소 | https://www.marrysafe.co.kr — `vercel.json` 에 non-www 리다이렉트 규칙이 있으나 **실제로 동작하지 않음**(www 가 200 응답). 알려진 문제 참조 |
| 테스트/스테이징 주소 | **고정된 테스트 주소 없음.** Vercel 이 브랜치별 preview 배포를 자동 생성하지만 Vercel Authentication 이 걸려 있어 로그인 없이는 401 |
| 소스 저장소 | GitHub `youngrl07-cmyk/marrysafe-website` (브랜치: `main`, `server-pdf`) |

### 주요 페이지

| 경로 | 파일 | 역할 |
|---|---|---|
| `/` | `index.html` | 메인 랜딩(서비스 소개, 요금, FAQ, 문의) |
| `/admin` | `admin.html` | 사이트 콘텐츠 관리자(배너·팝업·요금 문구). **예약 관리 기능 아님** |
| `/wedding-info-form` | `wedding-info-form.html` | 웨딩홀 안내 정보 제출 폼 |
| `/merrysafe-service-doc.html` | `merrysafe-service-doc.html` | 고객 작성용 사전 서류(체크리스트). 작성 후 PDF 로 메일 전송 |
| `/seo-*` | `seo-*.html` | SEO 랜딩 페이지 9종 |

경로 매핑은 `vercel.json` 의 `rewrites` 에 정의되어 있습니다.

---

## 2. 제출 데이터가 가는 곳

이 사이트에는 **데이터 저장소가 없습니다.** 고객이 제출한 내용은 모두 **이메일로 전송되고 끝납니다.** 전송 경로는 3가지입니다.

### (가) 사전 서류 체크리스트 → PDF 메일 (가장 핵심 경로)

```
merrysafe-service-doc.html  (브라우저에서 고객이 작성)
        │  POST /api/send-pdf   { docHtml, filename, customerName, weddingHall,
        │                         weddingDate, serviceType, emailBody, emailBodyHtml }
        ▼
api/send-pdf.js  (Vercel 서버리스 함수)
        │  ① puppeteer-core + @sparticuz/chromium 으로 docHtml 을 인쇄 → PDF
        │  ② POST (JSON) → Google Apps Script 배포 URL
        ▼
Google Apps Script  doPost()   ← 소스: gas-script-update.gs
        │  GmailApp.sendEmail(...)  PDF 첨부
        ▼
marrysafe.official@gmail.com  (메일함에만 남음)
```

처리 코드 파일 경로:

- 클라이언트: `merrysafe-service-doc.html` — `buildDocHtml()`, `#btn-submit` 클릭 핸들러
- 서버: `api/send-pdf.js` — `renderPdf()`, `module.exports` 핸들러
- Apps Script: `gas-script-update.gs` (**현재 git 미추적 파일**. GAS 에디터에 붙여넣는 사본이며, 실제 실행 코드는 Google 쪽에 있음)

메일 수신 주소는 `gas-script-update.gs` 에 하드코딩: `marrysafe.official@gmail.com`

### (나) 웨딩홀 안내 정보 폼 → EmailJS

- 파일: `wedding-info-form.html` (하단 `<script>`)
- `emailjs.send('service_marrysafe', 'template_kxtg4li', { subject, body })`
- 폼 값을 **하나의 텍스트 본문으로 합쳐서** 보냅니다. 항목별 구조화 데이터로 저장되지 않습니다.
- 서버 코드를 거치지 않고 브라우저에서 EmailJS 로 직접 전송합니다.

### (다) 제휴 문의 → `mailto:`

- 파일: `index.html` — `#cw-form` submit 핸들러
- `window.location.href = 'mailto:marrysafe.official@gmail.com?subject=...&body=...'`
- 고객 PC 의 메일 클라이언트를 띄우는 방식. 서버 전송 없음.

### (라) 사이트 설정 → Firebase Realtime Database

예약 데이터가 아니라 **운영자가 바꾸는 사이트 문구/이미지**만 저장합니다.

- 파일: `admin.html` (쓰기), `index.html` (읽기)
- DB: `https://marrysafe-96312-default-rtdb.firebaseio.com`
- 접근: REST (`fetch` + `PUT`/`GET`), **인증 없음**
- 저장 항목: 팝업 설정, 상단 배너 설정, 요금 안내 문구

---

## 3. 예약 데이터

### 결론: 이 저장소에 "예약 한 건"이라는 데이터 구조가 없습니다.

요청하신 항목(계약자명, 한측·양측, 밀봉·개수, 금액, 할인, 계약금 등)을 코드 전체에서 확인한 결과:

| 요청 항목 | 코드에 존재하는가 | 실제 위치 |
|---|---|---|
| 예식일 | ○ | 입력 필드 (저장 안 됨, 메일로만) |
| 예식 시간 | ○ | 입력 필드 |
| 예식장 | ○ | 입력 필드 |
| 계약자명 | △ | `merrysafe-service-doc.html` 에 "계약자" 라는 **표시 문구**로만 존재. 별도 입력 필드는 `f-name`(고객명) 하나 |
| 연락처 | ○ | 입력 필드 |
| 한측 / 양측 | ○ | 라디오 `service-type`: `4인2팀(양측)`, `2인1팀(신랑측)`, `2인1팀(신부측)` |
| 밀봉 · 개수 | ✕ | **입력 필드 없음.** `index.html`, `seo-*.html` 의 **홍보 문구**에만 등장 |
| 금액 | ✕ | **입력 필드 없음.** 요금표는 고정 HTML 과 Firebase 문구 설정 |
| 할인 | ✕ | **입력 필드 없음.** `admin.html` 의 팝업 설명 텍스트에만 등장 |
| 계약금 / 입금 | ✕ | **코드 없음.** `index.html` FAQ 의 안내 문구(환불 규정 등)에만 등장 |

### 실제로 수집되는 전체 항목

#### 3-1. `wedding-info-form.html` (웨딩홀 안내 정보 폼)

`name` 속성 기준 전체 목록입니다. 필수 여부는 **JS 검증 기준**입니다(HTML `required` 가 있어도 `novalidate` 로 브라우저 검증을 끄고, JS 에서 4개만 검사합니다).

| name | 형식 | 필수 | 예시 값 |
|---|---|---|---|
| `groom` | text | **필수** | 홍길동 |
| `bride` | text | **필수** | 김영희 |
| `wedding_date` | date (`YYYY-MM-DD`) | **필수** | 2026-12-05 |
| `wedding_time` | time (`HH:MM`) | **필수** | 13:30 |
| `hall_name` | text | 선택 | 강동 루벨 웨딩홀 |
| `hall_address` | text | 선택 | 서울 강동구 천호대로 000 |
| `contact` | tel | 선택 | 010-0000-0000 |
| `banquet_location` | text | 선택 | 35층 그랜드볼룸 |
| `meal_open_time` | text (자유 문자열) | 선택 | 예식 시작 1시간 전 |
| `bridal_room` | text | 선택 | 35층, 엘리베이터 좌측 |
| `restroom` | text | 선택 | 엘리베이터 끝 쪽, 각 층 |
| `atm` | text | 선택 | B1층 에스컬레이터 뒷편 |
| `hall_etc` | textarea | 선택 | 웨딩홀 내 음식물 반입 금지 |
| `parking_free` | text | 선택 | 2시간 |
| `parking_fee` | text | 선택 | 10분당 500원 |
| `parking_register` | text | 선택 | 피로연장 입구 |
| `parking_etc` | textarea | 선택 | 발렛 이용 가능 |
| `ticket_free_age` | text | 선택 | 4세 이하 / 2022년생~ |
| `ticket_free_note` | text | 선택 | 식권 없이 입장 가능 |
| `ticket_child_age` | text | 선택 | 5~7세 / 2019~2021년생 |
| `ticket_child_note` | text | 선택 | 소인 식권 별도 수령 |
| `ticket_adult_age` | text | 선택 | 8세 이상 / 2018년생~ |
| `ticket_adult_note` | text | 선택 | 일반 식권 필요 |
| `ticket_etc` | textarea | 선택 | 식권은 축의대에서 수령 |
| `meal_menu` | textarea | 선택 | 콜드디쉬, 수프, 꽃등심 스테이크 |
| `steak_option` | checkbox (다중) | 선택 | `미디엄` / `웰던 요청 가능` / `선택 불가` / `스테이크 없음` |
| `kids_meal` | text | 선택 | 어린이 — 잔치국수 별도 제공 |
| `allergy` | textarea | 선택 | 채식 메뉴 별도 없음 |
| `meal_etc` | textarea | 선택 | 음료는 셀프 |
| `extra[]` | text (가변 개수, 기본 3행 + 추가 가능) | 선택 | 포토존은 3층 로비에 있습니다 |
| `staff_note` | textarea | 선택 | 신랑 측 어머니께서 직접 인수인계 원하심 |

금액·할인·계약금·밀봉·개수 항목은 이 폼에 **없습니다.**

#### 3-2. `merrysafe-service-doc.html` (사전 서류 체크리스트)

`contenteditable` 요소와 체크박스/라디오로 구성되어 있고, **`<form>` 이 아니라 DOM 요소를 그대로 PDF 로 인쇄**하는 구조입니다. 따라서 "항목 = 값" 형태의 JSON 이 만들어지지 않습니다. 메일 본문용으로만 일부 값을 읽어 씁니다.

제출 시 JS 가 값으로 읽는 필드(메일 제목·파일명에 사용):

| 요소 id / name | 의미 | 필수 | 예시 |
|---|---|---|---|
| `f-name` | 고객명 | 값이 없으면 `고객명` 으로 대체 | 김수지 |
| `f-hall` | 예식장 | 없으면 `예식장` | 루이비스 컨벤션 강서점 |
| `f-date` | 예식일 | 없으면 `예식일` | 2026-12-05 |
| `service-type` (radio) | 서비스 유형 | 없으면 `서비스유형` | `4인2팀(양측)` |
| `privacy-yes` (checkbox) | 개인정보 수집·이용 동의 | **필수 (미체크 시 제출 차단)** | checked |
| `filming-agree` (checkbox) | 촬영(녹화) 동의 | **필수 (미체크 시 제출 차단)** | checked |
| `sig-canvas` (canvas) | 서명 | **필수 (빈 서명 시 제출 차단)** | 손글씨 이미지 |

그 외 PDF 안에만 들어가는 입력 요소 id 목록(값은 읽지 않고 인쇄만 함):

`f-groom`, `f-bride`, `f-address`, `f-contact`, `f-holname`, `f-banquet`,
`f-bridal-room`, `f-atm`, `f-meal-time`, `f-parking-free`, `f-parking-fee`,
`f-ticket-free`, `f-ticket-child`, `f-ticket-adult`,
`f-guests-groom`, `f-guests-bride`, `f-guests-total`,
`f-rg1~3-name / -phone / -gender` (신랑 측 접수 담당 3인),
`f-rb1~3-name / -phone / -gender` (신부 측 접수 담당 3인),
`f-note-g1~g3`, `f-note-b1~b3` (측별 추가 안내),
`f-yt-groom-1/-2`, `f-yt-bride-1/-2`

라디오/체크박스 그룹: `c-mode`, `gift`, `meal-type`, `transfer`(`-b`/`-g`),
`ticket-basis`(`-b`/`-g`), `ticket-count`(`-b`/`-g`), `ticket-remain`(`-b`/`-g`),
`no-cash`(`-b`/`-g`), `empty-env`(`-b`/`-g`), `helper-ticket`, `helper-extra`

파일명 규칙: `{고객명}_{예식장}_{예식일}_{서비스유형}.pdf` (각 조각은 `/\:*?"<>|` 제거 후 40자로 자름)

---

## 4. 예약 상태

**상태(접수/확정/취소 등)를 다루는 코드가 없습니다.**

- 상태 값을 정의한 상수, enum, 문자열 목록이 없습니다.
- 상태를 저장하거나 변경하는 함수, API, DB 경로가 없습니다.
- `index.html` FAQ 에 운영 규칙이 **안내 문구로만** 적혀 있습니다: "상담 후 계약금(서비스 대금의 50%)을 입금하시면 예약이 확정됩니다." → 이는 사람이 수동으로 처리하는 절차이며 코드와 연결되어 있지 않습니다.

실제 운영 흐름(코드 기준으로 확인 가능한 부분):

1. 고객이 `index.html` 에서 카카오톡 채널(`http://pf.kakao.com/_pcrKX`) 또는 `mailto:` 로 문의
2. (코드 밖) 상담·계약·입금을 사람이 처리
3. 고객이 `merrysafe-service-doc.html` 로 사전 서류 작성 → PDF 가 메일로 도착
4. 고객이 `wedding-info-form.html` 로 웨딩홀 정보 제출 → 메일로 도착

→ **관리자툴을 연동하려면 2~4단계를 담을 데이터 모델과 저장소를 새로 만들어야 합니다.**

---

## 5. 결제 / 계약금 입금 확인

**다루지 않습니다.**

- 결제 모듈(PG, 토스페이먼츠, 아임포트 등) 연동 코드가 없습니다.
- 입금 확인, 계좌 조회, 영수증 발행 코드가 없습니다.
- 금액을 입력·계산·저장하는 코드가 없습니다.
- 요금표는 `index.html` 의 고정 HTML 과 `admin.html` 에서 Firebase 에 저장하는 **안내 문구**뿐입니다.
- 환불 규정과 "계약금 50% 입금 시 예약 확정" 은 FAQ 텍스트입니다.

---

## 6. 환경 변수

**사용하는 환경 변수가 없습니다.** 코드 전체에서 `process.env` 참조가 0건입니다.

외부 서비스 접속에 필요한 값이 모두 **소스에 하드코딩**되어 있습니다. 어떤 종류의 값이 하드코딩되어 있는지만 적습니다(값은 기재하지 않음).

| 값의 종류 | 하드코딩 위치 | 환경 변수로 빼야 할 것 |
|---|---|---|
| Google Apps Script 배포 URL (메일 발송 엔드포인트) | `api/send-pdf.js` 상단 `GAS_URL` | ○ |
| Firebase Realtime Database URL | `admin.html`, `index.html` 의 `FB_URL` | ○ |
| EmailJS Public Key / Service ID / Template ID | `wedding-info-form.html` 의 `emailjs.init(...)`, `emailjs.send(...)` | ○ |
| 관리자 기본 비밀번호 | `admin.html` 의 `DEFAULT_PW` | ○ (아래 7. 보안 참조) |
| 수신 메일 주소 | `gas-script-update.gs` | △ |
| 카카오 채널 URL | `index.html` | △ |

연동 작업 시 권장 환경 변수 이름(아직 코드에 없음, 제안):
`GAS_WEBHOOK_URL`, `FIREBASE_DB_URL`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `NOTIFY_EMAIL`

---

## 7. 보안상 반드시 알아야 할 점

연동 전에 검토가 필요한 사항입니다.

1. **관리자 인증이 사실상 없습니다.** `admin.html` 은 `localStorage` 에 저장한 비밀번호와 문자열을 비교하는 방식이고, 기본값이 소스에 하드코딩되어 있습니다. 서버 검증이 없어 브라우저 콘솔로 우회할 수 있습니다.
2. **Firebase RTDB 가 인증 없이 열려 있습니다.** `admin.html` 이 토큰 없이 REST `PUT` 으로 쓰기를 하므로, 데이터베이스 규칙이 공개 쓰기 상태일 가능성이 높습니다. Firebase 콘솔에서 Rules 확인이 필요합니다.
3. **Google Apps Script 엔드포인트가 인증 없는 공개 메일 발송 창구입니다.** URL 을 아는 사람은 누구나 `marrysafe.official@gmail.com` 으로 첨부파일 메일을 보낼 수 있습니다.
4. **EmailJS Public Key 가 소스에 있습니다.** EmailJS 설정에서 도메인 제한을 걸지 않으면 외부에서 같은 템플릿으로 메일을 보낼 수 있습니다.
5. **개인정보가 메일함에만 쌓입니다.** 고객명·연락처·서명 이미지가 포함된 PDF 가 Gmail 한 곳에 보관됩니다. 보관 기간·접근 권한 정책을 정해야 합니다.

---

## 8. 로컬에서 실행하는 방법

### 정적 페이지 확인 (빌드 불필요)

```bash
cd "메리세이프 (개발)"
python3 -m http.server 3100
```

브라우저에서 `http://localhost:3100/index.html` 등으로 접속합니다.
`vercel.json` 의 `rewrites`(`/admin` → `/admin.html`)는 적용되지 않으므로 `.html` 확장자를 붙여 접속해야 합니다.

### 서버리스 함수까지 포함해 실행

`api/send-pdf.js` 는 Vercel 런타임 함수이므로 Vercel CLI 가 필요합니다.

```bash
npm install
npx vercel dev
```

주의사항:

- `@sparticuz/chromium` 은 AWS Lambda 용 바이너리입니다. 로컬(특히 macOS)에서는 실행되지 않을 수 있으며, 그 경우 로컬에 설치된 Chrome 경로를 `puppeteer.launch({ executablePath })` 에 직접 넣어 테스트해야 합니다.
- `npx vercel dev` 로 띄운 `/api/send-pdf` 를 호출하면 **실제 운영 Gmail 로 메일이 발송됩니다.** 테스트 시 `gas-script-update.gs` 의 수신 주소를 바꾼 별도 GAS 배포를 쓰거나, `api/send-pdf.js` 의 GAS 호출 부분을 임시로 막아야 합니다.

### 배포

`main` 브랜치에 푸시하면 Vercel 이 자동 배포합니다. 별도 빌드 명령은 없습니다.

---

## 9. 아직 안 만든 부분 / 알려진 문제

### 미구현

| 항목 | 상태 |
|---|---|
| 예약 데이터 저장 (DB) | 없음. 전부 메일 기반 |
| 예약 상태 관리 | 없음 |
| 결제 / 입금 확인 | 없음 |
| 금액·할인·밀봉 개수 등 계약 조건 입력 | 없음 |
| 관리자용 예약 목록·검색 | 없음 (`admin.html` 은 사이트 문구 관리 전용) |
| 서버 측 인증·권한 | 없음 |
| 자동화 테스트 | 없음 |
| 로그 / 모니터링 | 없음 (Vercel 기본 함수 로그만) |

### 알려진 문제

1. **`www` → non-www 리다이렉트가 동작하지 않습니다.** `vercel.json` 에 `redirects` 규칙이 있는데도 `www.marrysafe.co.kr` 이 200 을 반환합니다. Google Search Console 색인 경고의 원인으로 추정됩니다.
2. **`robots.txt` 가 없습니다** (404).
3. **`seo-when.html` 이 git 미추적 상태입니다.** 운영에 배포되지 않아 404 이며 `sitemap.xml` 과 `vercel.json` rewrites 에도 없습니다.
4. **`gas-script-update.gs` 가 git 미추적 상태입니다.** 메일 발송 로직의 유일한 사본인데 저장소에 없습니다. 커밋 권장.
5. **`marrysafe_updated.html` 이 git 미추적 상태입니다.** 용도 불명의 중복 파일로 보입니다.
6. **`nodemailer` 가 미사용 의존성입니다.**
7. **중복/구버전 파일이 섞여 있습니다.** `marry safe webpage.html`, `marry safe admin.html`, `index.html.bak` 성격의 파일들이 `.gitignore` 로 제외되어 있거나 남아 있습니다.
8. **PDF 화질 개선 작업이 진행 중입니다.** 브랜치 `server-pdf` 에서 클라이언트 html2canvas 캡처(이미지 PDF, 모바일 약 96dpi) → 서버 Chromium 인쇄(벡터 텍스트) 로 전환하는 작업이 **커밋되지 않은 상태로** 작업 트리에 남아 있습니다. 해당 변경은 로컬 Chrome 으로 13페이지·빈 페이지 없음까지 검증했으나 **운영 배포 검증은 하지 않았습니다.**
9. **`merrysafe-service-doc.html` 의 체크리스트는 `<form>` 이 아닙니다.** `contenteditable` DOM 을 인쇄하는 구조라서 구조화 데이터를 뽑으려면 별도 직렬화 로직이 필요합니다(현재 `buildDocHtml()` 은 PDF 인쇄용 HTML 만 만듭니다).

---

## 10. 관리자툴 연동 시 권장 접근

현재 구조상 "기존 예약 API 에 붙이는" 방식은 불가능합니다. 실질적으로 다음 중 하나를 새로 만들어야 합니다.

1. **데이터 모델 신설** — 위 3-1, 3-2 의 필드 목록을 기준으로 예약 스키마를 정의하고, 금액·할인·밀봉 개수·계약금 상태 등 코드에 없는 항목을 추가 설계
2. **제출 경로 교체** — 현재 메일 발송 3경로를 관리자툴 API 호출(또는 메일과 병행 전송)로 변경
3. **상태 머신 정의** — 접수 → 확정(입금 확인) → 서류 수령 → 완료 / 취소. 현재는 전부 수동
4. **인증 추가** — 서버 측 관리자 인증 없이는 관리자툴 연동이 위험

연동 지점으로 가장 손을 대기 쉬운 곳은 `api/send-pdf.js` 핸들러입니다. 이미 서버를 거치는 유일한 경로이고, 요청 본문에 고객명·예식장·예식일·서비스유형이 구조화되어 들어옵니다.
