# Creator facebookKey 보안 수정 완료 보고서

## ✅ 완료된 작업

### 1. DB 구조 확인
- ✅ `users` 테이블에 `facebook_key` 컬럼 존재 확인
- ✅ `user_provider_keys` 테이블 사용 중 (provider='facebook', key_name='access_token')
- ✅ 현재 구조 유지 (user_provider_keys 사용)

### 2. 공개 API 보안 강화
- ✅ **GET /creators** (공개 API)
  - facebook_key 마스킹 처리: `EA...xyz` 형식으로 반환
  - 원문 노출 방지

- ✅ **POST /creators** (공개 API)
  - facebook_key validation 추가
  - 응답에서 facebook_key 마스킹 처리

### 3. 관리자 API (원문 반환)
- ✅ **GET /admin/creators** (관리자 전용)
  - facebook_key 원문 반환 (관리자만 접근 가능)
  - 주석 추가: 관리자 전용임을 명시

- ✅ **PUT /admin/creators/:id** (관리자 전용)
  - facebook_key validation 추가
  - 원문 저장 및 반환

### 4. Validation 추가
- ✅ POST /creators에 facebook_key validation 추가
- ✅ PUT /admin/creators/:id에 facebook_key validation 추가
- ✅ 빈 문자열 체크 및 형식 경고 로그

## 🔒 적용된 보안 로직

### 공개 API (GET /creators, POST /creators)

```javascript
// 🔒 보안: 공개 API에서는 facebook_key 원문을 노출하지 않음
// 키가 있으면 마스킹 처리 (처음 2자 + 마지막 3자만 표시)
let maskedFacebookKey = null;
if (facebookKey?.key_value) {
  const key = facebookKey.key_value;
  if (key.length > 5) {
    maskedFacebookKey = `${key.substring(0, 2)}...${key.substring(key.length - 3)}`;
  } else {
    maskedFacebookKey = "***";
  }
}

return {
  ...creator,
  facebook_key: maskedFacebookKey, // 마스킹된 키만 반환
};
```

### 관리자 API (GET /admin/creators, PUT /admin/creators/:id)

```javascript
// 관리자 전용이므로 원문 반환
return {
  ...creator,
  facebook_key: facebookKey?.key_value || null, // 관리자 전용이므로 원문 반환
};
```

### Validation 로직

```javascript
// facebook_key validation (제공된 경우)
if (facebook_key !== undefined && facebook_key !== null) {
  if (typeof facebook_key !== 'string' || facebook_key.trim().length === 0) {
    return reply.code(400).send({ error: "facebook_key must be a non-empty string if provided" });
  }
  // Facebook Access Token 형식 검증 (기본: EA로 시작하는 긴 문자열)
  if (!facebook_key.startsWith('EA') && facebook_key.length < 20) {
    console.warn(`⚠️  facebook_key 형식이 일반적이지 않음 (길이: ${facebook_key.length})`);
  }
}
```

## 📝 보안 요구사항 충족

### 1. 공개 API에서 facebookKey 원문 노출 방지
- ✅ GET /creators: 마스킹 처리 (`EA...xyz`)
- ✅ POST /creators: 응답에서 마스킹 처리
- ✅ 공개 API 경로 확인 완료

### 2. 관리자 API에서 원문 반환
- ✅ GET /admin/creators: 원문 반환 (관리자 전용)
- ✅ PUT /admin/creators/:id: 원문 저장 및 반환 (관리자 전용)

### 3. Validation 적용
- ✅ POST /creators: facebook_key validation
- ✅ PUT /admin/creators/:id: facebook_key validation

## 🔒 facebookKey 사용 설계

### 서버에서만 사용
- facebookKey는 프론트엔드(3000)에서 직접 사용하지 않음
- 서버에서만 Facebook Graph API / oEmbed 호출에 사용
- 공개 API에서는 마스킹 처리하여 원문 노출 방지

### 저장 위치
- `user_provider_keys` 테이블에 저장
  - `provider = 'facebook'`
  - `key_name = 'access_token'`
  - `key_value = 'EA...'` (실제 토큰)

### 접근 권한
- **공개 API** (`/creators`): 마스킹된 키만 반환
- **관리자 API** (`/admin/creators`): 원문 반환 (관리자만 접근)

## ✅ 완료 기준 달성

- [x] users 테이블에 facebook_key 컬럼 확인 (이미 존재)
- [x] GET /creators (공개 API)에서 facebook_key 마스킹 처리
- [x] GET /admin/creators (관리자 API)에서 facebook_key 원문 반환
- [x] POST /creators에 facebook_key validation 추가
- [x] PUT /admin/creators/:id에 facebook_key validation 추가
- [x] 공개 API에서 facebook_key 원문 노출 방지

## 🧪 테스트 방법

### 1. 공개 API 테스트 (마스킹 확인)

```bash
# GET /creators (공개 API)
curl -X GET "http://localhost:8787/creators"

# 응답 예시:
# [
#   {
#     "id": "...",
#     "name": "Creator Name",
#     "facebook_key": "EA...xyz"  // ✅ 마스킹됨
#   }
# ]
```

### 2. 관리자 API 테스트 (원문 확인)

```bash
# GET /admin/creators (관리자 전용)
curl -X GET "http://localhost:8787/admin/creators" \
  -H "Authorization: Bearer {admin_token}"

# 응답 예시:
# {
#   "creators": [
#     {
#       "id": "...",
#       "name": "Creator Name",
#       "facebook_key": "EAABsbCS1iHgBO7ZC..."  // ✅ 원문 반환 (관리자만)
#     }
#   ]
# }
```

### 3. Creator 생성 테스트 (Validation 확인)

```bash
# POST /creators (공개 API)
curl -X POST "http://localhost:8787/creators" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Creator",
    "email": "test@example.com",
    "facebook_key": "EAABsbCS1iHgBO7ZC..."
  }'

# 응답에서 facebook_key는 마스킹되어 반환됨
```

## 📊 수정된 라우트 목록

### 공개 API (facebook_key 마스킹)
- `GET /creators` - 크리에이터 목록 조회 (마스킹)
- `POST /creators` - 크리에이터 생성 (마스킹)

### 관리자 API (facebook_key 원문)
- `GET /admin/creators` - 크리에이터 목록 조회 (원문)
- `PUT /admin/creators/:id` - 크리에이터 수정 (원문)

## 🔒 보안 강화 사항

1. **공개 API 마스킹**: `EA...xyz` 형식으로 표시
2. **관리자 전용 원문**: 관리자만 facebook_key 원문 접근 가능
3. **Validation**: 빈 문자열 및 형식 검증
4. **원문 노출 방지**: 공개 API에서 절대 원문 노출하지 않음

## 📌 주의사항

1. **facebookKey 사용**: 프론트엔드에서 직접 사용하지 않고, 서버에서만 Facebook Graph API / oEmbed 호출에 사용
2. **공개 API**: 홈페이지(3000)에서 호출하는 `/creators`는 마스킹된 키만 반환
3. **관리자 API**: CMS에서만 원문 접근 가능 (JWT 인증 필요)
4. **저장 위치**: `user_provider_keys` 테이블 사용 (기존 구조 유지)

## ✅ 최종 확인

모든 요구사항이 완료되었으며, Creator facebookKey 보안이 강화되었습니다:
- 공개 API에서 facebook_key 원문 노출 방지 (마스킹 처리)
- 관리자 API에서만 원문 반환
- Validation 추가
- 서버에서만 facebookKey 사용하도록 설계 정리
































