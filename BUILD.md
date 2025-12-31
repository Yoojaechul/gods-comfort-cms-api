# 빌드 가이드

이 프로젝트는 모노레포 구조로, 백엔드(NestJS)와 프론트엔드(React/Vite)가 별도로 빌드됩니다.

## 📁 프로젝트 구조

```
.
├── nest-api/          # NestJS 백엔드 API 서버
├── frontend/          # React/Vite 프론트엔드
└── package.json       # 루트 패키지 (Fastify 서버)
```

## 🔨 빌드 명령어

### 루트 디렉토리에서 빌드 (권장)

모든 서브프로젝트를 한 번에 빌드:

```bash
# 전체 빌드 (백엔드 + 프론트엔드)
npm run build

# 백엔드만 빌드
npm run build:backend

# 프론트엔드만 빌드
npm run build:frontend
```

### 개별 디렉토리에서 빌드

#### 백엔드 (NestJS)

```bash
cd nest-api
npm install
npm run build          # TypeScript 컴파일
npm run start:prod     # 프로덕션 서버 실행
```

**빌드 결과**: `nest-api/dist/` 디렉토리에 컴파일된 JavaScript 파일 생성

**사용 가능한 스크립트**:
- `npm run build` - 프로덕션 빌드
- `npm run start` - 개발 모드 (컴파일 없이 실행)
- `npm run start:dev` - 개발 모드 (watch 모드)
- `npm run start:prod` - 프로덕션 모드 (빌드 후 실행)

#### 프론트엔드 (React/Vite)

```bash
cd frontend
npm install
npm run build          # 프로덕션 빌드
npm run preview        # 빌드 결과 미리보기
```

**빌드 결과**: `frontend/dist/` 디렉토리에 정적 파일 생성

**사용 가능한 스크립트**:
- `npm run build` - 프로덕션 빌드
- `npm run dev` - 개발 서버 실행
- `npm run preview` - 빌드 결과 미리보기
- `npm run typecheck` - TypeScript 타입 체크
- `npm run lint` - ESLint 실행

## 🚀 배포 명령어

### Firebase Hosting 배포

```bash
# 프론트엔드 빌드
cd frontend
npm run build

# Firebase Hosting 배포
cd ..
firebase deploy --only hosting:cms
```

**배포 폴더**: `frontend/dist/` (firebase.json에 설정됨)

### 백엔드 배포

백엔드는 별도의 서버에서 실행됩니다. 빌드 후 `npm run start:prod`로 실행하거나, Docker/Cloud Run 등에 배포합니다.

```bash
cd nest-api
npm run build
npm run start:prod
```

## 📝 빌드 순서

프로덕션 배포 시 권장 순서:

1. **백엔드 빌드 및 배포**
   ```bash
   cd nest-api
   npm install
   npm run build
   npm run start:prod
   ```

2. **프론트엔드 빌드**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

3. **Firebase Hosting 배포**
   ```bash
   cd ..
   firebase deploy --only hosting:cms
   ```

## 🔍 빌드 확인

### 백엔드 빌드 확인

```bash
cd nest-api
ls dist/  # 컴파일된 파일 확인
```

### 프론트엔드 빌드 확인

```bash
cd frontend
ls dist/  # 정적 파일 확인
npm run preview  # 로컬에서 빌드 결과 미리보기
```

## ⚠️ 주의사항

1. **루트 디렉토리의 `npm run build`**
   - 루트에서 실행하면 백엔드와 프론트엔드를 모두 빌드합니다.
   - 개별 빌드가 필요한 경우 각 디렉토리로 이동하여 실행하세요.

2. **환경 변수**
   - 백엔드: `nest-api/.env` 파일 확인
   - 프론트엔드: `frontend/.env` 또는 `frontend/.env.production` 파일 확인

3. **의존성 설치**
   - 각 서브프로젝트의 `node_modules`는 별도로 설치됩니다.
   - 루트의 `npm install`만으로는 서브프로젝트의 의존성이 설치되지 않습니다.

4. **Firebase Functions**
   - Firebase Functions는 `functions/` 디렉토리에 있습니다.
   - Functions 배포: `firebase deploy --only functions`

## 🛠️ 개발 환경 설정

### 전체 개발 환경 실행

```bash
# 터미널 1: 백엔드 개발 서버
cd nest-api
npm run start:dev

# 터미널 2: 프론트엔드 개발 서버
cd frontend
npm run dev
```

백엔드: http://localhost:8080 (또는 설정된 포트)  
프론트엔드: http://localhost:5173 (Vite 기본 포트)







