# Originals Inc. - 공식 웹사이트

> 세상에 없던 혁신을 만드는 AI 기반 하드웨어 혁신 기업

[![Website](https://img.shields.io/badge/Website-www.originalshq.com-FF6B35?style=for-the-badge)](https://www.originalshq.com)
[![License](https://img.shields.io/badge/License-Proprietary-blue?style=for-the-badge)](LICENSE)

---

## 📌 프로젝트 개요

**주식회사 오리지널스(Originals Inc.)**의 공식 기업 소개 웹사이트입니다.

애덤 그랜트(Adam Grant)의 'Originals'에서 영감을 받아, 젊고 활기찬 아이디어로 AI 기반 혁신 하드웨어를 통해 일상의 불편함을 해결하고 세상에 없던 미래를 만들어갑니다.

---

## 🏢 회사 정보

| 항목               | 내용                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| **회사명**         | 주식회사 오리지널스 / Originals Inc.                                      |
| **대표자**         | 황정현                                                                    |
| **사업자등록번호** | 283-86-03872                                                              |
| **주소**           | 제주특별자치도 서귀포시 서호중앙로 55<br>유포리아 지식산업센터 비동 721호 |
| **웹사이트**       | [www.originalshq.com](https://www.originalshq.com)                        |

---

## 🚀 현재 구현된 기능

### ✅ 완료된 섹션

1. **Navigation Bar (네비게이션)**
   - 고정 상단 메뉴바 (스크롤 시 배경 활성화)
   - 반응형 햄버거 메뉴 (모바일)
   - 스무스 스크롤 링크
   - Active 상태 표시

2. **Hero Section (메인 비주얼)**
   - 풀스크린 히어로 섹션
   - 그라데이션 배경 + 그리드 오버레이
   - 애니메이션 배지, 타이틀, CTA 버튼
   - 통계 카운터 (출시 제품 / 개발중 / 혁신 진행중)
   - 스크롤 인디케이터

3. **About Section (회사 소개)**
   - 회사 비전 및 미션
   - 3개 핵심 가치 카드 (Innovation First / AI-Powered Hardware / Young & Dynamic)
   - 비전 선언문 (Vision Statement)
   - 스크롤 애니메이션

4. **Products Section (제품 소개)**
   - **QR 자동전환형 차량 전화번호판** (출시 완료)
   - **AI 기반 웻수트** (개발중)
   - **생존 시그널라인 아웃도어 자켓** (개발중)
   - 각 제품별 상세 설명 및 주요 기능
   - 상태 배지 (출시 완료 / 개발중)

5. **Contact Section (연락처)**
   - 회사 상세 정보 (회사명, 대표자, 주소, 사업자번호, 웹사이트)
   - 지도 플레이스홀더
   - 아이콘 기반 정보 디스플레이

6. **Footer (푸터)**
   - 회사 로고 및 태그라인
   - 링크 (Company, Legal, Location)
   - 저작권 정보
   - 법적 정보 (사업자등록번호, 대표자명)

7. **Interactive Features (인터랙션)**
   - Back to Top 버튼
   - 스크롤 기반 요소 등장 애니메이션
   - 모바일 메뉴 토글
   - 카드 호버 3D 효과
   - Parallax 효과

---

## 🎨 디자인 시스템

### 컬러 팔레트

```css
Primary Color:    #FF6B35 (오렌지)
Secondary Color:  #00D9FF (시안)
Accent Color:     #FFB627 (골드)
Background:       #0A0E27 (다크 네이비)
Text Primary:     #FFFFFF (화이트)
Text Secondary:   #B8C5D6 (라이트 그레이)
```

### 타이포그래피

- **헤딩 폰트**: Orbitron (기술적, 미래지향적)
- **본문 폰트**: Inter (깔끔하고 읽기 쉬움)

### 디자인 특징

- 🌑 **다크 테마**: 기술적이고 미래지향적인 느낌
- 🎨 **그라데이션**: 생동감 있는 오렌지-골드 그라데이션
- ✨ **애니메이션**: 부드러운 페이드 인/업 효과
- 📱 **반응형**: 모든 디바이스에서 완벽한 레이아웃

---

## 🛠️ 기술 스택

### Frontend

- **HTML5**: 시맨틱 마크업
- **CSS3**: Flexbox, Grid, Custom Properties, Animations
- **JavaScript (ES6+)**: 모듈 패턴, Class 기반 구조

### 외부 라이브러리 (CDN)

- **Google Fonts**: Inter, Orbitron
- **Font Awesome 6.4.0**: 아이콘

### 파일 구조

```
originals-inc-website/
├── index.html          # 메인 HTML
├── css/
│   └── style.css       # 메인 스타일시트
├── js/
│   └── main.js         # 메인 JavaScript
└── README.md           # 프로젝트 문서
```

---

## 🌐 주요 URI 및 섹션

| URI/Section  | 설명                |
| ------------ | ------------------- |
| `/#home`     | 메인 히어로 섹션    |
| `/#about`    | 회사 소개 및 비전   |
| `/#products` | 제품 라인업         |
| `/#contact`  | 연락처 및 회사 정보 |

---

## 📂 데이터 구조

현재 웹사이트는 **정적 데이터**를 사용하며, 별도의 데이터베이스나 API를 사용하지 않습니다.

### 제품 데이터 (Static)

```javascript
Products = [
	{
		id: 1,
		name: 'QR 자동전환형 차량 전화번호판',
		status: '출시 완료',
		description:
			'기존 종이·플라스틱 전화번호판의 불편함을 QR코드 자동전환 방식으로 완전히 혁신',
		features: ['QR 스캔으로 즉시 연락', '개인정보 보호', '번호 자동 전환'],
	},
	{
		id: 2,
		name: 'AI 기반 웻수트',
		status: '개발중',
		description: '인공지능 기술이 접목된 차세대 웻수트',
		features: ['AI 온도 조절', '실시간 모니터링', '데이터 분석'],
	},
	{
		id: 3,
		name: '생존 시그널라인 아웃도어 자켓',
		status: '개발중',
		description:
			'위급 상황에서 생존 신호를 발신하는 기능이 내장된 혁신적인 아웃도어 자켓',
		features: ['긴급 신호 발신', 'GPS 위치 추적', '생존 기능 통합'],
	},
];
```

---

## 🚧 아직 구현되지 않은 기능

### 단기 개발 항목

- [ ] **제품 상세 페이지** (각 제품별 개별 페이지)
- [ ] **다국어 지원** (한국어/영어 전환)
- [ ] **블로그/뉴스 섹션** (회사 소식 및 제품 업데이트)
- [ ] **실제 지도 통합** (Google Maps / Kakao Maps API)
- [ ] **문의 양식** (Contact Form)

### 장기 개발 항목

- [ ] **제품 예약/구매 시스템**
- [ ] **고객 리뷰 섹션**
- [ ] **팀 소개 페이지**
- [ ] **채용 정보 페이지**
- [ ] **파트너십/협력사 페이지**
- [ ] **SEO 최적화** (메타 태그, Open Graph, Schema.org)
- [ ] **PWA 기능** (오프라인 지원, 앱 설치)
- [ ] **성능 최적화** (이미지 최적화, Lazy Loading)

---

## 🎯 추천 다음 단계

### 1단계: 콘텐츠 강화 (우선순위: 높음)

1. **제품 실물 이미지 추가**
   - QR 전화번호판 실제 사용 사진
   - 웻수트, 자켓 렌더링 이미지
2. **팀 소개 섹션 추가**
   - 대표자 소개
   - 핵심 팀원 프로필

3. **연락처 정보 보완**
   - 이메일 주소
   - 전화번호
   - SNS 링크 (LinkedIn, Instagram, YouTube 등)

### 2단계: 기능 확장 (우선순위: 중간)

4. **Contact Form 구현**
   - 문의 양식 추가
   - 이메일 전송 기능 (FormSpree, EmailJS 등 활용)

5. **실제 지도 추가**
   - Kakao Maps API 또는 Google Maps 연동
   - 회사 위치 정확한 표시

6. **제품 상세 페이지**
   - 각 제품별 랜딩 페이지
   - 상세 스펙 및 사용 가이드

### 3단계: 마케팅 & SEO (우선순위: 중간)

7. **SEO 최적화**
   - 메타 태그 최적화
   - Open Graph 이미지 설정
   - Google Search Console 등록
   - 사이트맵 제출

8. **Analytics 통합**
   - Google Analytics 4 설정
   - 방문자 추적 및 분석

9. **SNS 통합**
   - 소셜 미디어 공유 버튼
   - 임베드 피드 (Instagram, YouTube)

### 4단계: 도메인 배포 (우선순위: 높음 🚨)

10. **웹사이트 배포**
    - **GitHub Pages** (무료, 추천)
    - **Netlify** (무료, 추천)
    - **Vercel** (무료, 추천)
    - Google Cloud Storage / AWS S3
11. **도메인 연결**
    - DNS 설정 (Google Domains → 호스팅 서버)
    - SSL 인증서 적용 (HTTPS)
    - www 리다이렉트 설정

---

## 📦 배포 가이드

### Option 1: GitHub Pages (추천)

```bash
# 1. GitHub 레포지토리 생성
git init
git add .
git commit -m "Initial commit: Originals Inc. website"
git remote add origin https://github.com/YOUR_USERNAME/originalshq.git
git push -u origin main

# 2. GitHub Pages 설정
# Settings > Pages > Source: main branch > Save

# 3. 도메인 연결
# Settings > Pages > Custom domain: www.originalshq.com
```

**DNS 설정 (Google Domains)**

```
Type: CNAME
Name: www
Data: YOUR_USERNAME.github.io
```

### Option 2: Netlify (추천)

```bash
# 1. Netlify 계정 생성 및 로그인
# 2. "Add new site" > "Deploy manually"
# 3. 프로젝트 폴더 드래그 앤 드롭
# 4. Domain settings > Add custom domain > www.originalshq.com
```

### Option 3: Vercel (추천)

```bash
# 1. Vercel 계정 생성
# 2. "Add New Project"
# 3. Import Git Repository 또는 Manual Upload
# 4. Settings > Domains > Add Domain
```

---

## 🔧 로컬 개발 환경

### 요구사항

- 웹 브라우저 (Chrome, Firefox, Safari, Edge)
- 텍스트 에디터 (VS Code 추천)
- Live Server (선택사항)

### 실행 방법

#### 방법 1: VS Code Live Server

1. VS Code에서 프로젝트 폴더 열기
2. "Live Server" 확장 프로그램 설치
3. `index.html` 우클릭 > "Open with Live Server"

#### 방법 2: Python Simple Server

```bash
# Python 3
python -m http.server 8000

# 브라우저에서 http://localhost:8000 접속
```

#### 방법 3: 직접 HTML 파일 열기

- `index.html` 파일을 브라우저로 드래그 앤 드롭

---

## 🎨 커스터마이징 가이드

### 색상 변경

`css/style.css`의 `:root` 섹션에서 CSS 변수 수정:

```css
:root {
	--primary-color: #ff6b35; /* 메인 컬러 */
	--secondary-color: #00d9ff; /* 보조 컬러 */
	--accent-color: #ffb627; /* 강조 컬러 */
}
```

### 폰트 변경

`index.html`의 Google Fonts 링크 수정:

```html
<link
	href="https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap"
	rel="stylesheet"
/>
```

### 콘텐츠 수정

`index.html`에서 각 섹션의 텍스트 직접 수정

---

## 📱 브라우저 지원

| Browser | Version | Support          |
| ------- | ------- | ---------------- |
| Chrome  | 90+     | ✅ Full          |
| Firefox | 88+     | ✅ Full          |
| Safari  | 14+     | ✅ Full          |
| Edge    | 90+     | ✅ Full          |
| IE 11   | -       | ❌ Not Supported |

---

## 📄 라이센스

© 2024 Originals Inc. All rights reserved.

본 웹사이트의 모든 콘텐츠, 디자인, 코드는 주식회사 오리지널스의 자산입니다.

---

## 🤝 기여

현재 내부 프로젝트로 운영되며, 외부 기여는 받지 않습니다.

---

## 📞 문의

- **Website**: [www.originalshq.com](https://www.originalshq.com)
- **Address**: 제주특별자치도 서귀포시 서호중앙로 55, 유포리아 지식산업센터 비동 721호
- **Business Registration**: 283-86-03872

---

## 🙏 Acknowledgments

- **Inspired by**: Adam Grant's "Originals"
- **Design Inspiration**: Modern tech companies (Apple, Tesla, Notion)
- **Fonts**: Google Fonts (Inter, Orbitron)
- **Icons**: Font Awesome

---

**Made with 💜 by Originals Team**

_"세상에 없던 것을 만들어내는 것. 그것이 우리가 존재하는 이유입니다."_
