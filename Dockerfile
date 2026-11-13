# เว็บฐานข้อมูลรายวิชา — Next.js + Prisma
# รันแล้ว container จะ migrate ฐานข้อมูลก่อนเปิดเว็บที่พอร์ต 3000
# seed ข้อมูลครั้งแรก: docker compose run --rm app npx prisma db seed

FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build && rm -rf .next/cache

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    AUTH_TRUST_HOST=true
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx next start"]
