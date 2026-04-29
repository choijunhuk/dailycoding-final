FROM node:20-alpine

# 언어 런타임 설치 (Docker 없이 직접 채점용)
RUN apk add --no-cache python3 gcc g++ musl-dev openjdk21

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY init.sql ./

EXPOSE 4000

CMD ["node", "src/index.js"]
