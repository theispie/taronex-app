FROM node:22-slim AS base
# ฟอนต์ไทยใส่ไว้ตั้งแต่แรก แม้ยังไม่ทำส่งออกไฟล์ฝั่งเซิร์ฟเวอร์
# วันที่เปิดฟีเจอร์จะได้ไม่ต้องไล่หาสาเหตุว่าทำไมตัวหนังสือกลายเป็นสี่เหลี่ยม
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-thai-tlwg fontconfig && fc-cache -fv && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && pnpm build

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=320
# output: 'standalone' ใน next.config.ts ทำให้ก้อนนี้เล็กมาก
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node","server.js"]
