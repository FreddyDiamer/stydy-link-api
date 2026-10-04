FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile 

COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma

RUN npx prisma generate

COPY src ./src

RUN pnpm run build


FROM node:22-slim AS production

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod --ignore-scripts

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

RUN npx prisma generate

EXPOSE 3000
ENV PORT=3000

USER node

CMD [ "sh","-c", "npx prisma migrate deploy && node dist/main" ]
