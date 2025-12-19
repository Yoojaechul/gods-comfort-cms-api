FROM node:20-alpine

WORKDIR /app

# 패키지 먼저 복사 (캐시 효율)
COPY package*.json ./

# 프로덕션 설치 (필요하면 npm ci로)
RUN npm ci --omit=dev

# 나머지 소스 복사
COPY . .

# Cloud Run 기본 포트
ENV PORT=8080
EXPOSE 8080

# 서버 실행 (server.js가 PORT를 사용해야 함)
CMD ["node", "server.js"]
