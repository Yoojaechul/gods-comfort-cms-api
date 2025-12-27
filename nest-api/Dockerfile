# ===== Builder Stage (딱 1번만) =====
FROM node:20-alpine AS builder

WORKDIR /app

# deps
COPY package*.json ./
RUN npm ci

# build
COPY . .
RUN npm run build


# ===== Runtime Stage =====
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# 런타임 의존성만
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# 빌드 산출물
COPY --from=builder /app/dist ./dist

# (선택) sqlite 폴더 (있어도 무방)
RUN mkdir -p /app/data

EXPOSE 8080
CMD ["node", "dist/main.js"]
