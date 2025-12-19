# 🔄 로그인 시스템 업그레이드 가이드

## 새로운 기능

### ✅ 하이브리드 인증 시스템

이제 두 가지 방식으로 로그인할 수 있습니다:

1. **이메일 + 비밀번호** (권장)
   - 일반 사용자 친화적
   - 3시간 세션 유지
   - 만료 전 알람 (10분, 5분, 1분)

2. **API Key** (개발자용)
   - 외부 앱/스크립트 연동
   - 만료 없음
   - 기존 방식 유지

---

## 🆕 새로운 Admin API Key

DB를 초기화했으므로 새 Admin API Key를 사용하세요:

```
ea36fd955ad7a700bd3736eaf43b616ca34fd9183c55d8327fb0ab21d08386bd
```

---

## 📝 사용 방법

### 1. Admin에서 Creator 생성 (개선됨)

`http://localhost:8787/admin` 접속 후:

#### 옵션 A: 이메일 로그인 가능한 Creator 생성

1. 사이트 선택: `gods`
2. Creator 이름: `John Doe`
3. **이메일**: `john@example.com` 입력
4. **비밀번호**: `password123` 입력 (최소 8자)
5. "Creator 생성" 클릭

**모달에 표시:**
- API Key (백업용)
- 이메일: john@example.com
- 비밀번호: password123

#### 옵션 B: API Key만 사용하는 Creator 생성

1. 사이트 선택: `gods`
2. Creator 이름: `Jane Doe`
3. 이메일/비밀번호 **비워두기**
4. "Creator 생성" 클릭

**모달에 표시:**
- API Key만 표시

---

### 2. Creator 로그인

#### 방법 1: 이메일 로그인 (새로운 방식)

`http://localhost:8787/creator/login.html` 접속:

1. **"이메일 로그인"** 탭 선택 (기본)
2. 이메일: `john@example.com`
3. 비밀번호: `password123`
4. "로그인" 클릭

**특징:**
- ✅ 3시간 세션 유지
- ✅ 만료 10분 전 알람
- ✅ 만료 5분 전 알람
- ✅ 만료 1분 전 알람
- ✅ 자동 로그아웃

#### 방법 2: API Key 로그인 (기존 방식)

`http://localhost:8787/creator/login.html` 접속:

1. **"API Key 로그인"** 탭 선택
2. API Key 입력
3. "로그인" 클릭

**특징:**
- ✅ 만료 없음
- ✅ 개발자/스크립트용

---

### 3. 로그아웃

Creator UI 우측 상단의 **"🚪 로그아웃"** 버튼 클릭

---

## 🔔 세션 만료 알람

이메일 로그인 시:

- **10분 전**: 빨간색 알람 팝업 (우측 상단)
- **5분 전**: 빨간색 알람 팝업
- **1분 전**: 빨간색 알람 팝업
- **만료 시**: alert 창 + 자동 로그아웃

알람은 10초 후 자동으로 사라집니다.

---

## 🔑 API 엔드포인트

### 새로 추가된 엔드포인트

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**응답:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1764684049622,
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "creator",
    "site_id": "gods"
  }
}
```

### 인증 방법

**방법 1: JWT 토큰** (이메일 로그인)
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**방법 2: API Key** (기존 방식)
```bash
x-api-key: abc123def456...
```

둘 다 지원됩니다!

---

## 📊 비교

| 항목 | 이메일 로그인 | API Key |
|------|--------------|---------|
| **사용자 친화성** | ✅ 높음 | ❌ 낮음 |
| **세션 시간** | 3시간 | 무제한 |
| **만료 알람** | ✅ 있음 | ❌ 없음 |
| **외부 앱 연동** | ❌ 어려움 | ✅ 쉬움 |
| **권장 대상** | 일반 사용자 | 개발자 |

---

## 🎯 권장 사용 방법

- **일반 Creator**: 이메일 로그인 사용
- **개발자/스크립트**: API Key 사용
- **Admin**: API Key 사용 (기존 방식)

---

## 🚀 테스트 순서

1. Admin UI에서 사이트 생성
2. Creator 생성 (이메일/비밀번호 포함)
3. `/creator/login.html`에서 이메일 로그인
4. 영상 등록/수정/삭제 테스트
5. 로그아웃 테스트
6. API Key로도 로그인 테스트

---

## 📌 주의사항

- DB를 초기화했으므로 기존 데이터가 삭제되었습니다
- 새 Admin API Key를 사용하세요
- Creator를 다시 생성해야 합니다































































































