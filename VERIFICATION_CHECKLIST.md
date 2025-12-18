# ✅ 로컬 API 검증 체크리스트

이 체크리스트를 순서대로 따라하면 모든 기능이 정상 작동하는지 확인할 수 있습니다.

---

## 📋 사전 준비

### 필수 요구사항
- [ ] Node.js 설치 (v18 이상 권장)
- [ ] npm 설치
- [ ] 터미널/PowerShell 접근

---

## 🔧 Step 1: 의존성 설치

### 명령어
```bash
npm install
```

### 확인 사항
- [ ] `node_modules` 폴더 생성됨
- [ ] 에러 없이 설치 완료
- [ ] "found 0 vulnerabilities" 메시지 확인

**예상 시간:** 2-3분

---

## 📝 Step 2: 환경 변수 설정

### 명령어 (Windows)
```bash
copy .env.example .env
```

### 명령어 (Mac/Linux)
```bash
cp .env.example .env
```

### .env 파일 수정

파일을 열어서 다음 값을 변경하세요:

```env
PORT=8787
ADMIN_BOOTSTRAP_KEY=my_secure_admin_key_12345678901234567890
JWT_SECRET=my_secure_jwt_secret_12345678901234567890
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 확인 사항
- [ ] `.env` 파일이 프로젝트 루트에 생성됨
- [ ] `ADMIN_BOOTSTRAP_KEY` 변경됨 (최소 32자)
- [ ] `JWT_SECRET` 변경됨 (최소 32자)

**예상 시간:** 1분

---

## 🚀 Step 3: 서버 실행

### 명령어
```bash
npm run dev
```

또는

```bash
node server.js
```

### 확인 사항
- [ ] 서버가 시작됨
- [ ] 콘솔에 다음 메시지 표시:
  ```
  ============================================================
  ✅ Admin 자동 생성 완료!
  API Key: abc123def456...
  ⚠️  이 키를 안전한 곳에 저장하세요!
  ============================================================
  ✅ CMS API Server running on http://127.0.0.1:8787
  📊 Admin UI: http://localhost:8787/admin
  🎨 Creator UI: http://localhost:8787/creator
  ```
- [ ] **Admin API Key를 메모장에 복사** (중요!)
- [ ] 에러 메시지 없음

**예상 시간:** 5초

---

## 🌐 Step 4: 브라우저 접속 확인

### 4-1. Health Check

**브라우저 주소창:**
```
http://localhost:8787/health
```

**예상 결과:**
```json
{"ok":true,"time":"2025-12-02T..."}
```

- [ ] 200 OK 응답
- [ ] `ok: true` 표시

---

### 4-2. Admin UI 접속

**브라우저 주소창:**
```
http://localhost:8787/admin
```

**예상 결과:**
- [ ] 페이지 로드됨
- [ ] 보라색 그라데이션 배경
- [ ] "🔐 CMS Admin Panel" 제목 표시
- [ ] "API Key 설정" 섹션 표시

---

### 4-3. Creator 로그인 페이지 접속

**브라우저 주소창:**
```
http://localhost:8787/creator/login.html
```

**예상 결과:**
- [ ] 페이지 로드됨
- [ ] "🎨 Creator 로그인" 제목 표시
- [ ] "이메일 로그인" / "API Key 로그인" 탭 표시

**예상 시간:** 1분

---

## 👤 Step 5: Admin으로 사이트 생성

### 5-1. Admin API Key 입력

1. Admin UI (`http://localhost:8787/admin`)로 이동
2. "API Key 설정" 섹션 찾기
3. Step 3에서 복사한 Admin API Key 붙여넣기
4. **"저장"** 버튼 클릭

**확인 사항:**
- [ ] 녹색 성공 메시지: "✅ API Key가 저장되었습니다."
- [ ] 사이트 목록과 Creator 목록이 자동 로드됨

---

### 5-2. 사이트 생성

1. "사이트 관리" 섹션으로 스크롤
2. **사이트 ID**: `gods` 입력
3. **사이트 이름**: `Gods Site` 입력
4. **"사이트 생성"** 버튼 클릭

**확인 사항:**
- [ ] 녹색 성공 메시지: "✅ 사이트가 생성되었습니다."
- [ ] 테이블에 새 사이트 표시:
  - ID: gods
  - 이름: Gods Site
  - 생성일: 현재 시간
  - 작업: [선택] 버튼

**예상 시간:** 1분

---

## 👥 Step 6: Creator 생성 및 키 발급

### 6-1. Creator 생성 (이메일 로그인용)

1. "Creator 관리" 섹션으로 스크롤
2. **사이트 선택**: `gods - Gods Site` 선택
3. **Creator 이름**: `John Doe` 입력
4. **이메일**: `john@example.com` 입력
5. **비밀번호**: `password123` 입력
6. **"Creator 생성"** 버튼 클릭

**확인 사항:**
- [ ] 모달 팝업이 나타남
- [ ] 제목: "⚠️ Creator "John Doe"의 API Key (1회만 표시)"
- [ ] API Key 표시됨 (64자 16진수)
- [ ] 이메일/비밀번호 정보 표시됨
- [ ] **API Key를 메모장에 복사** (백업용)
- [ ] "확인" 버튼 클릭
- [ ] Creator 목록에 추가됨:
  - 이름: John Doe
  - 사이트 ID: gods
  - 상태: active (녹색 배지)

**저장할 정보:**
```
이메일: john@example.com
비밀번호: password123
API Key: abc123def456... (백업용)
```

**예상 시간:** 2분

---

## 🎨 Step 7: Creator 이메일 로그인

### 7-1. 로그인 페이지 접속

**브라우저 주소창:**
```
http://localhost:8787/creator/login.html
```

---

### 7-2. 이메일 로그인

1. **"이메일 로그인"** 탭 선택 (기본값)
2. **이메일**: `john@example.com` 입력
3. **비밀번호**: `password123` 입력
4. **"로그인"** 버튼 클릭

**확인 사항:**
- [ ] 녹색 성공 메시지: "✅ 로그인 성공! 이동 중..."
- [ ] 자동으로 Creator UI로 리다이렉트
- [ ] 사용자 정보 박스 표시:
  - 사용자: John Doe
  - 사이트: Gods Site
- [ ] 우측 상단에 "🚪 로그아웃" 버튼 표시

**예상 시간:** 1분

---

## 🎬 Step 8: YouTube 영상 등록 (메타 자동 생성 확인)

### 8-1. 영상 등록

1. "영상 관리" 섹션으로 스크롤
2. **플랫폼**: `YouTube` 선택 (기본값)
3. **공개 설정**: `Public` 선택 (기본값)
4. **소스 URL**: `https://www.youtube.com/watch?v=dQw4w9WgXcQ` 입력
5. **제목**: 비워두기 (자동 생성 테스트)
6. **썸네일 URL**: 비워두기 (자동 생성 테스트)
7. **"영상 등록"** 버튼 클릭

**확인 사항:**
- [ ] 녹색 성공 메시지: "✅ 영상이 등록되었습니다."
- [ ] 테이블에 새 영상 추가됨
- [ ] **메타정보 자동 생성 확인:**
  - ✅ 플랫폼: youtube
  - ✅ 제목: "Rick Astley - Never Gonna Give You Up" (자동!)
  - ✅ 썸네일: YouTube 이미지 표시 (자동!)
  - ✅ 공개: public (녹색 배지)
  - ✅ 생성일: 현재 시간

**예상 시간:** 1분

---

### 8-2. 다른 YouTube URL 형식 테스트 (선택사항)

**짧은 URL:**
```
https://youtu.be/jNQXAC9IVRw
```

**Shorts URL:**
```
https://www.youtube.com/shorts/ABC123XYZ
```

**확인 사항:**
- [ ] 모든 형식에서 정상 등록
- [ ] 메타정보 자동 생성

---

## 🌐 Step 9: 공개 API 조회 확인

### 9-1. 브라우저에서 확인

**브라우저 주소창:**
```
http://localhost:8787/public/videos?site_id=gods
```

**확인 사항:**
- [ ] JSON 응답 표시
- [ ] `videos` 배열에 등록한 영상 포함
- [ ] 각 영상에 다음 필드 포함:
  - ✅ `id`: 영상 ID
  - ✅ `site_id`: "gods"
  - ✅ `platform`: "youtube"
  - ✅ `source_url`: 원본 URL
  - ✅ `title`: 자동 생성된 제목
  - ✅ `thumbnail_url`: YouTube 썸네일 URL
  - ✅ `embed_url`: YouTube embed URL
  - ✅ `owner_name`: "John Doe"
  - ✅ `visibility`: "public"
  - ✅ `created_at`: 생성 시간
  - ✅ `updated_at`: 수정 시간
- [ ] `cursor`: 페이지네이션 커서

---

### 9-2. cURL로 확인

```bash
curl "http://localhost:8787/public/videos?site_id=gods&limit=10"
```

**확인 사항:**
- [ ] JSON 응답 정상
- [ ] 인증 없이 조회 가능

**예상 시간:** 1분

---

## 🎥 Step 10: 데모 뷰어 확인

**브라우저 주소창:**
```
http://localhost:8787/demo.html
```

**확인 사항:**
- [ ] 페이지 로드됨
- [ ] "🎬 CMS 영상 갤러리" 제목 표시
- [ ] 통계 표시: "📊 총 1개 영상 (YouTube: 1, Facebook: 0)"
- [ ] 영상 카드 표시:
  - 썸네일 이미지
  - 제목
  - 작성자 이름
  - 플랫폼 배지 (빨간색 YouTube)
- [ ] 카드 클릭 시:
  - 모달 팝업
  - YouTube 영상 재생
  - ESC 키로 닫기 가능

**예상 시간:** 1분

---

## 🔄 Step 11: 추가 기능 테스트 (선택사항)

### 11-1. 영상 수정

1. Creator UI에서 영상 목록의 **"수정"** 버튼 클릭
2. 모달에서 제목/썸네일/공개 여부 수정
3. **"저장"** 클릭

**확인 사항:**
- [ ] 녹색 성공 메시지
- [ ] 테이블에 수정 내용 반영

---

### 11-2. 영상 삭제

1. Creator UI에서 영상 목록의 **"삭제"** 버튼 클릭
2. 확인 대화상자에서 **"확인"** 클릭

**확인 사항:**
- [ ] 녹색 성공 메시지: "✅ 영상이 삭제되었습니다."
- [ ] 테이블에서 영상 사라짐

**참고:** 캐시 문제가 있으면 Ctrl+F5로 새로고침

---

### 11-3. 로그아웃

1. Creator UI 우측 상단의 **"🚪 로그아웃"** 버튼 클릭

**확인 사항:**
- [ ] 로그인 페이지로 리다이렉트
- [ ] localStorage 초기화됨

---

### 11-4. API Key 로그인 테스트

1. `/creator/login.html` 접속
2. **"API Key 로그인"** 탭 선택
3. Step 6에서 복사한 API Key 입력
4. **"로그인"** 클릭

**확인 사항:**
- [ ] 로그인 성공
- [ ] Creator UI로 이동
- [ ] 영상 관리 가능

---

### 11-5. Facebook 영상 등록

1. Creator UI에서 **플랫폼**: `Facebook` 선택
2. **소스 URL**: `https://www.facebook.com/watch/?v=123456789` 입력
3. **제목**: `Facebook 테스트 영상` 입력 (필수)
4. **"영상 등록"** 클릭

**확인 사항:**
- [ ] 영상 등록 성공
- [ ] `embed_url` 자동 생성됨
- [ ] 제목은 입력한 값 그대로

---

### 11-6. 플랫폼 키 저장

1. "플랫폼 키/토큰 관리" 섹션으로 스크롤
2. **플랫폼**: `YouTube` 선택
3. **키 이름**: `api_key` 입력
4. **키 값**: `test_key_12345` 입력
5. **"저장"** 클릭

**확인 사항:**
- [ ] 녹색 성공 메시지
- [ ] 테이블에 키 추가됨

---

## 📊 Step 12: 최종 검증

### 12-1. 공개 API 필터링 테스트

```bash
# 전체 조회
curl "http://localhost:8787/public/videos?site_id=gods"

# YouTube만
curl "http://localhost:8787/public/videos?site_id=gods&platform=youtube"

# 개수 제한
curl "http://localhost:8787/public/videos?site_id=gods&limit=5"
```

**확인 사항:**
- [ ] 모든 쿼리 파라미터 정상 작동
- [ ] 필터링 정확함

---

### 12-2. 권한 테스트

다른 사이트 생성 후:

```bash
# Admin으로 새 사이트 생성
curl -X POST http://localhost:8787/admin/sites \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -d '{"id":"test2","name":"Test Site 2"}'
```

Creator UI에서 `test2` 사이트의 영상에 접근 시도:

**확인 사항:**
- [ ] 접근 거부됨 (자기 site_id만 접근 가능)

---

## ✅ 전체 체크리스트 요약

- [ ] Step 1: npm install 완료
- [ ] Step 2: .env 파일 생성 및 설정
- [ ] Step 3: 서버 실행 및 Admin API Key 저장
- [ ] Step 4-1: /health 접속 확인
- [ ] Step 4-2: /admin 접속 확인
- [ ] Step 4-3: /creator/login.html 접속 확인
- [ ] Step 5-1: Admin API Key 입력
- [ ] Step 5-2: 사이트 생성 (gods)
- [ ] Step 6: Creator 생성 (이메일/비밀번호 포함)
- [ ] Step 7: Creator 이메일 로그인
- [ ] Step 8: YouTube 영상 등록 (메타 자동 생성 확인)
- [ ] Step 9: /public/videos 조회 확인
- [ ] Step 10: 데모 뷰어 확인

### 선택사항
- [ ] Step 11-1: 영상 수정
- [ ] Step 11-2: 영상 삭제
- [ ] Step 11-3: 로그아웃
- [ ] Step 11-4: API Key 로그인
- [ ] Step 11-5: Facebook 영상 등록
- [ ] Step 11-6: 플랫폼 키 저장
- [ ] Step 12-1: 공개 API 필터링
- [ ] Step 12-2: 권한 테스트

---

## 🎊 검증 완료!

모든 체크리스트를 통과했다면 시스템이 정상 작동하는 것입니다!

---

## 🐛 문제 발생 시

### 서버가 시작되지 않음
```bash
# 포트 확인
netstat -ano | findstr :8787

# Node 프로세스 종료
Get-Process -Name node | Stop-Process -Force
```

### 브라우저에서 404 에러
- URL에 `/admin` 또는 `/creator/login.html` 포함 확인
- 루트 경로(`/`)는 404 정상

### 버튼 클릭 시 반응 없음
- **Ctrl + Shift + Delete**: 캐시 삭제
- **Ctrl + F5**: 강력 새로고침
- F12 → Console 탭에서 에러 확인

### API Key 잃어버림
```bash
# DB 초기화 (주의: 모든 데이터 삭제)
Remove-Item cms.db
node server.js
```

---

## 📞 추가 문서

- **API_DOCUMENTATION.md**: 전체 API 레퍼런스
- **UPGRADE_GUIDE.md**: 로그인 시스템 가이드
- **ERD.md**: 데이터베이스 구조
- **SUMMARY.md**: 시스템 요약

---

## ⏱️ 예상 소요 시간

- **최소 테스트** (Step 1-10): 약 15분
- **전체 테스트** (Step 1-12): 약 25분

---

**이 체크리스트를 따라하면 모든 기능이 정상 작동함을 확인할 수 있습니다!** ✅






























































































