# Google Cloud Storage 설정 가이드

썸네일 파일을 Google Cloud Storage(GCS)에 저장하고 공개 접근 가능한 URL을 제공하도록 변경되었습니다.

## 📋 필수 설정

### 1. GCS 버킷 생성

```bash
# 버킷 생성 (asia-northeast3 리전 권장)
gsutil mb -p YOUR_PROJECT_ID -l asia-northeast3 gs://YOUR_BUCKET_NAME

# 버킷 확인
gsutil ls -b gs://YOUR_BUCKET_NAME
```

### 2. 버킷 공개 설정

썸네일 파일을 공개 접근 가능하게 만들기 위해 버킷을 공개로 설정합니다.

```bash
# 버킷 전체를 공개로 설정 (권장하지 않음)
gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET_NAME

# 또는 thumbnails 폴더만 공개로 설정 (권장)
gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET_NAME/thumbnails
```

또는 Cloud Console에서:
1. Cloud Storage > 버킷 선택
2. 권한(Permissions) 탭
3. 주 구성원(Principal)에 `allUsers` 추가
4. 역할(Role)에 `Storage Object Viewer` 선택

### 3. Cloud Run 서비스 계정 권한 설정

Cloud Run 서비스가 GCS에 파일을 업로드/삭제할 수 있도록 권한을 부여합니다.

```bash
# 서비스 계정에 Storage 권한 부여
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 또는 Cloud Run 기본 서비스 계정 사용
gcloud run services update cms-api \
  --service-account=YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --region=asia-northeast3
```

### 4. 환경변수 설정

Cloud Run 서비스에 GCS 버킷 이름을 환경변수로 설정합니다.

```bash
# Cloud Run 서비스 업데이트
gcloud run services update cms-api \
  --set-env-vars="GCS_BUCKET_NAME=YOUR_BUCKET_NAME" \
  --region=asia-northeast3
```

또는 Cloud Console에서:
1. Cloud Run > 서비스 선택
2. 수정 및 새 버전 배포
3. 변수 및 시크릿 > 환경 변수 추가
4. 이름: `GCS_BUCKET_NAME`, 값: 버킷 이름

### 5. 로컬 개발 환경 설정

로컬에서 테스트하려면 Google Cloud 인증이 필요합니다.

#### 방법 1: Application Default Credentials (ADC)

```bash
# Google Cloud CLI 로그인
gcloud auth login

# Application Default Credentials 설정
gcloud auth application-default login
```

#### 방법 2: 서비스 계정 키 파일 사용

```bash
# 서비스 계정 키 생성 (JSON)
gcloud iam service-accounts keys create key.json \
  --iam-account=SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com

# 환경변수 설정
export GOOGLE_APPLICATION_CREDENTIALS="path/to/key.json"
```

Windows PowerShell:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\key.json"
```

## 🔧 환경변수 목록

| 변수명 | 설명 | 필수 | 예시 |
|--------|------|------|------|
| `GCS_BUCKET_NAME` | GCS 버킷 이름 | ✅ | `cms-api-thumbnails` |
| `GOOGLE_APPLICATION_CREDENTIALS` | 서비스 계정 키 파일 경로 (로컬 개발용) | ❌ | `/path/to/key.json` |

## 📁 파일 구조

GCS 버킷 내부 구조:
```
gs://YOUR_BUCKET_NAME/
└── thumbnails/
    ├── 1705123456789_abc123.jpg
    ├── 1705123456790_def456.png
    └── ...
```

## 🔗 URL 형식

업로드된 썸네일은 다음 형식의 공개 URL로 접근 가능합니다:

```
https://storage.googleapis.com/YOUR_BUCKET_NAME/thumbnails/FILENAME
```

예시:
```
https://storage.googleapis.com/cms-api-thumbnails/thumbnails/1705123456789_abc123.jpg
```

## 🧪 테스트

### 1. 버킷 생성 및 권한 확인

```bash
# 버킷 확인
gsutil ls gs://YOUR_BUCKET_NAME

# 버킷 권한 확인
gsutil iam get gs://YOUR_BUCKET_NAME
```

### 2. API 테스트

```bash
# 썸네일 업로드
curl -X POST http://localhost:8080/uploads/thumbnail \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@thumbnail.jpg"

# 응답 예시:
# {
#   "thumbnailUrl": "https://storage.googleapis.com/YOUR_BUCKET_NAME/thumbnails/1705123456789_abc123.jpg"
# }
```

### 3. 공개 접근 확인

브라우저에서 반환된 URL로 직접 접근하여 이미지가 표시되는지 확인합니다.

## ⚠️ 주의사항

1. **비용**: GCS 스토리지 및 네트워크 비용이 발생합니다.
   - 스토리지: 약 $0.020/GB/월
   - 네트워크: 약 $0.12/GB (다운로드)

2. **보안**: 버킷을 공개로 설정하면 누구나 URL을 알고 있으면 접근 가능합니다.
   - 썸네일은 공개 콘텐츠이므로 일반적으로 문제되지 않습니다.
   - 민감한 파일은 Signed URL을 사용하는 것을 고려하세요.

3. **로컬 개발**: 로컬에서 테스트할 때는 `GOOGLE_APPLICATION_CREDENTIALS` 환경변수가 필요합니다.

4. **버전 관리**: 기존 로컬 파일 저장 방식에서 GCS로 마이그레이션할 때, 기존 썸네일 URL은 DB에 그대로 유지되며 접근할 수 없을 수 있습니다.

## 📚 참고 자료

- [Google Cloud Storage 문서](https://cloud.google.com/storage/docs)
- [@google-cloud/storage Node.js 클라이언트](https://cloud.google.com/nodejs/docs/reference/storage/latest)
- [Cloud Run 서비스 계정](https://cloud.google.com/run/docs/securing/service-identity)
- [GCS 버킷 권한 설정](https://cloud.google.com/storage/docs/access-control/making-data-public)

