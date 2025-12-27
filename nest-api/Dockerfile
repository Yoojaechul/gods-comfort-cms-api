# ==================== Builder Stage ====================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. package.json과 package-lock.json만 먼저 복사 (의존성 캐시 최적화)
COPY package*.json ./

# 2. 모든 의존성 설치 (빌드에 devDependencies 필요)
RUN npm ci

# 3. 소스 코드 복사
COPY . .

# 4. TypeScript 빌드 실행 (dist/main.js 생성)
RUN npm run build

# ==================== Runtime Stage ====================
FROM node:20-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
# PORT는 Cloud Run이 자동으로 주입하므로 하드코딩하지 않음

# 빌드 산출물만 복사 (dist/main.js 포함)
COPY --from=builder /app/dist ./dist

# package.json과 package-lock.json 복사 (프로덕션 의존성 설치용)
COPY --from=builder /app/package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --omit=dev

# DB 디렉터리 생성 (SQLite 파일 저장용)
# Cloud Run의 ephemeral filesystem이지만, 컨테이너 실행 중에는 유지됨
RUN mkdir -p /app/data

# 포트 노출 (Cloud Run이 8080을 사용하지만, PORT 환경변수로 변경 가능)
EXPOSE 8080

# NestJS 서버 실행
CMD ["node", "dist/main.js"]


FROM node:20-alpine AS builder

WORKDIR /app

# 1. package.json과 package-lock.json만 먼저 복사 (의존성 캐시 최적화)
COPY package*.json ./

# 2. 모든 의존성 설치 (빌드에 devDependencies 필요)
RUN npm ci

# 3. 소스 코드 복사
COPY . .

# 4. TypeScript 빌드 실행 (dist/main.js 생성)
RUN npm run build

# ==================== Runtime Stage ====================
FROM node:20-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
# PORT는 Cloud Run이 자동으로 주입하므로 하드코딩하지 않음

# 빌드 산출물만 복사 (dist/main.js 포함)
COPY --from=builder /app/dist ./dist

# package.json과 package-lock.json 복사 (프로덕션 의존성 설치용)
COPY --from=builder /app/package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --omit=dev

# DB 디렉터리 생성 (SQLite 파일 저장용)
# Cloud Run의 ephemeral filesystem이지만, 컨테이너 실행 중에는 유지됨
RUN mkdir -p /app/data

# 포트 노출 (Cloud Run이 8080을 사용하지만, PORT 환경변수로 변경 가능)
EXPOSE 8080

# NestJS 서버 실행
CMD ["node", "dist/main.js"]


FROM node:20-alpine AS builder

WORKDIR /app

# 1. package.json과 package-lock.json만 먼저 복사 (의존성 캐시 최적화)
COPY package*.json ./

# 2. 모든 의존성 설치 (빌드에 devDependencies 필요)
RUN npm ci

# 3. 소스 코드 복사
COPY . .

# 4. TypeScript 빌드 실행 (dist/main.js 생성)
RUN npm run build

# ==================== Runtime Stage ====================
FROM node:20-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
# PORT는 Cloud Run이 자동으로 주입하므로 하드코딩하지 않음

# 빌드 산출물만 복사 (dist/main.js 포함)
COPY --from=builder /app/dist ./dist

# package.json과 package-lock.json 복사 (프로덕션 의존성 설치용)
COPY --from=builder /app/package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --omit=dev

# DB 디렉터리 생성 (SQLite 파일 저장용)
# Cloud Run의 ephemeral filesystem이지만, 컨테이너 실행 중에는 유지됨
RUN mkdir -p /app/data

# 포트 노출 (Cloud Run이 8080을 사용하지만, PORT 환경변수로 변경 가능)
EXPOSE 8080

# NestJS 서버 실행
CMD ["node", "dist/main.js"]




FROM node:20-alpine AS builder

WORKDIR /app

# 1. package.json과 package-lock.json만 먼저 복사 (의존성 캐시 최적화)
COPY package*.json ./

# 2. 모든 의존성 설치 (빌드에 devDependencies 필요)
RUN npm ci

# 3. 소스 코드 복사
COPY . .

# 4. TypeScript 빌드 실행 (dist/main.js 생성)
RUN npm run build

# ==================== Runtime Stage ====================
FROM node:20-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
# PORT는 Cloud Run이 자동으로 주입하므로 하드코딩하지 않음

# 빌드 산출물만 복사 (dist/main.js 포함)
COPY --from=builder /app/dist ./dist

# package.json과 package-lock.json 복사 (프로덕션 의존성 설치용)
COPY --from=builder /app/package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --omit=dev

# DB 디렉터리 생성 (SQLite 파일 저장용)
# Cloud Run의 ephemeral filesystem이지만, 컨테이너 실행 중에는 유지됨
RUN mkdir -p /app/data

# 포트 노출 (Cloud Run이 8080을 사용하지만, PORT 환경변수로 변경 가능)
EXPOSE 8080

# NestJS 서버 실행
CMD ["node", "dist/main.js"]


FROM node:20-alpine AS builder

WORKDIR /app

# 1. package.json과 package-lock.json만 먼저 복사 (의존성 캐시 최적화)
COPY package*.json ./

# 2. 모든 의존성 설치 (빌드에 devDependencies 필요)
RUN npm ci

# 3. 소스 코드 복사
COPY . .

# 4. TypeScript 빌드 실행 (dist/main.js 생성)
RUN npm run build

# ==================== Runtime Stage ====================
FROM node:20-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
# PORT는 Cloud Run이 자동으로 주입하므로 하드코딩하지 않음

# 빌드 산출물만 복사 (dist/main.js 포함)
COPY --from=builder /app/dist ./dist

# package.json과 package-lock.json 복사 (프로덕션 의존성 설치용)
COPY --from=builder /app/package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --omit=dev

# DB 디렉터리 생성 (SQLite 파일 저장용)
# Cloud Run의 ephemeral filesystem이지만, 컨테이너 실행 중에는 유지됨
RUN mkdir -p /app/data

# 포트 노출 (Cloud Run이 8080을 사용하지만, PORT 환경변수로 변경 가능)
EXPOSE 8080

# NestJS 서버 실행
CMD ["node", "dist/main.js"]


FROM node:20-alpine AS builder

WORKDIR /app

# 1. package.json과 package-lock.json만 먼저 복사 (의존성 캐시 최적화)
COPY package*.json ./

# 2. 모든 의존성 설치 (빌드에 devDependencies 필요)
RUN npm ci

# 3. 소스 코드 복사
COPY . .

# 4. TypeScript 빌드 실행 (dist/main.js 생성)
RUN npm run build

# ==================== Runtime Stage ====================
FROM node:20-alpine

WORKDIR /app

# 프로덕션 환경 설정
ENV NODE_ENV=production
# PORT는 Cloud Run이 자동으로 주입하므로 하드코딩하지 않음

# 빌드 산출물만 복사 (dist/main.js 포함)
COPY --from=builder /app/dist ./dist

# package.json과 package-lock.json 복사 (프로덕션 의존성 설치용)
COPY --from=builder /app/package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --omit=dev

# DB 디렉터리 생성 (SQLite 파일 저장용)
# Cloud Run의 ephemeral filesystem이지만, 컨테이너 실행 중에는 유지됨
RUN mkdir -p /app/data

# 포트 노출 (Cloud Run이 8080을 사용하지만, PORT 환경변수로 변경 가능)
EXPOSE 8080

# NestJS 서버 실행
CMD ["node", "dist/main.js"]










