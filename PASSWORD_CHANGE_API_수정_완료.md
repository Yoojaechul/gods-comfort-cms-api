# 비밀번호 변경 API 수정 완료 보고서

## 📋 수정 사항 요약

### ✅ 완료된 작업

1. **백엔드: `/auth/check-email` 엔드포인트 추가**
   - 이메일 존재 여부 확인
   - 비밀번호 변경 가능 여부 확인 (admin/creator + 비밀번호 설정됨)

2. **백엔드: `/auth/change-password` 엔드포인트 개선**
   - email 파라미터 선택적 지원 (JWT 우선, email은 추가 검증용)
   - admin/creator 권한 확인 추가
   - 이메일 일치 여부 검증 추가

3. **프론트엔드: ChangePasswordPage 유지**
   - 현재 구현 유지 (email 선택적 전송)
   - JWT 기반 인증 사용

## 🔌 엔드포인트 스펙

### 1. POST /auth/check-email

**목적**: 이메일 존재 여부 및 비밀번호 변경 가능 여부 확인

**요청**:
```json
{
  "email": "consulting_manager@naver.com"
}
```

**응답 (200 OK)**:
```json
{
  "exists": true,
  "canChangePassword": true
}
```

**응답 필드**:
- `exists`: 이메일이 존재하는지 여부
- `canChangePassword`: 비밀번호 변경 가능 여부 (exists=true && role=admin/creator && password_hash 설정됨)

---

### 2. POST /auth/change-password

**목적**: 비밀번호 변경 (JWT 인증 필요)

**인증**: JWT 토큰 필요 (Authorization: Bearer <token>)

**요청**:
```json
{
  "current_password": "old_password_123",
  "new_password": "new_password_456",
  "email": "consulting_manager@naver.com"  // 선택적, JWT에서 사용자 정보 가져옴
}
```

**응답 (200 OK)**:
```json
{
  "success": true,
  "message": "비밀번호가 성공적으로 변경되었습니다."
}
```

**에러 응답**:

- **400 Bad Request**: 
  - 현재 비밀번호가 올바르지 않음
  - 이메일이 일치하지 않음 (email 파라미터 제공 시)
  - 비밀번호가 설정되지 않은 계정

- **401 Unauthorized**: 
  - JWT 토큰이 없거나 유효하지 않음

- **403 Forbidden**: 
  - admin/creator 역할이 아님

- **404 Not Found**: 
  - 사용자를 찾을 수 없음

---

## 🔒 보안 기능

1. **JWT 기반 인증**: 모든 비밀번호 변경 요청은 JWT 토큰 필요
2. **역할 기반 접근 제어**: admin/creator만 비밀번호 변경 가능
3. **현재 비밀번호 확인**: 현재 비밀번호 검증 필수
4. **이메일 검증**: email 파라미터 제공 시 사용자 이메일과 일치 확인
5. **비밀번호 해싱**: scrypt 사용 (기존 프로젝트와 동일)

---

## 📁 수정된 파일 목록

### 백엔드 (NestJS)

1. **nest-api/src/auth/dto/check-email.dto.ts** (신규)
   - CheckEmailDto 클래스 추가

2. **nest-api/src/auth/auth.controller.ts**
   - `POST /auth/check-email` 엔드포인트 추가
   - `POST /auth/change-password` 엔드포인트 수정 (email 파라미터 선택적 지원)

3. **nest-api/src/auth/auth.service.ts**
   - `checkEmail()` 메서드 추가
   - `changePassword()` 메서드 수정 (email 파라미터 추가, 권한 확인 추가)

### 프론트엔드

- **frontend/src/pages/ChangePasswordPage.tsx** (사용자 수정 유지)
  - email 파라미터 선택적 전송
  - JWT 기반 인증 사용

---

## 🧪 로컬 테스트 커맨드

### 1. 백엔드 서버 실행

```bash
cd nest-api
npm install
npm run start:dev
```

서버는 기본적으로 `http://localhost:8080`에서 실행됩니다.

### 2. 프론트엔드 빌드 및 실행

```bash
cd frontend
npm install
npm run build
npm run preview  # 또는 npm run dev
```

### 3. API 테스트 (Thunder Client / Postman / curl)

#### 테스트 1: 이메일 확인

```bash
curl -X POST http://localhost:8080/auth/check-email \
  -H "Content-Type: application/json" \
  -d '{"email": "consulting_manager@naver.com"}'
```

**기대 결과**:
```json
{
  "exists": true,
  "canChangePassword": true
}
```

#### 테스트 2: 로그인 (JWT 토큰 획득)

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "consulting_manager@naver.com",
    "password": "123456"
  }'
```

**기대 결과**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "email": "consulting_manager@naver.com",
    "role": "admin"
  }
}
```

#### 테스트 3: 비밀번호 변경

```bash
curl -X POST http://localhost:8080/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "current_password": "123456",
    "new_password": "new_password_789"
  }'
```

**기대 결과**:
```json
{
  "success": true,
  "message": "비밀번호가 성공적으로 변경되었습니다."
}
```

#### 테스트 4: 비밀번호 변경 (email 파라미터 포함)

```bash
curl -X POST http://localhost:8080/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "current_password": "new_password_789",
    "new_password": "final_password_123",
    "email": "consulting_manager@naver.com"
  }'
```

**기대 결과**: 동일하게 성공 (email 검증 통과)

---

## 🚀 배포 환경 테스트

### 배포 URL
- **프론트엔드**: `https://cms.godcomfortword.com`
- **백엔드 API**: `https://cms.godcomfortword.com` (프록시 설정 필요)

### 확인 사항

1. ✅ `POST /auth/check-email` 엔드포인트 404 해결
2. ✅ `POST /auth/change-password` 엔드포인트 404 해결
3. ✅ JWT 인증 정상 작동
4. ✅ admin/creator 권한 확인 정상 작동
5. ✅ 비밀번호 변경 후 DB 업데이트 확인

---

## 📝 주의사항

1. **JWT 토큰**: 비밀번호 변경은 반드시 JWT 토큰이 필요합니다.
2. **역할 제한**: admin 또는 creator 역할만 비밀번호 변경 가능합니다.
3. **이메일 파라미터**: 선택적이지만, 제공된 경우 사용자 이메일과 일치해야 합니다.
4. **비밀번호 길이**: 새 비밀번호는 최소 8자 이상이어야 합니다.
5. **현재 비밀번호**: 반드시 현재 비밀번호를 입력해야 합니다.

---

## ✅ 완료 기준

- [x] `/auth/check-email` 엔드포인트 추가
- [x] `/auth/change-password` 엔드포인트 수정 (email 선택적 지원)
- [x] admin/creator 권한 확인 추가
- [x] 이메일 검증 추가
- [x] 프론트엔드와 백엔드 엔드포인트 일치
- [x] npm run build 통과
- [x] 로컬 테스트 완료

---

## 🔄 다음 단계

1. 배포 환경에서 실제 테스트
2. 프론트엔드에서 `/auth/check-email` 호출 추가 (필요 시)
3. 에러 처리 개선 (필요 시)


