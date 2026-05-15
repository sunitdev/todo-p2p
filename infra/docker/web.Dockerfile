FROM oven/bun:1.3-alpine

WORKDIR /workspace

COPY package.json bun.lock bunfig.toml ./
COPY tooling/typescript/base.json ./tooling/typescript/
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile || bun install

EXPOSE 5173
CMD ["bun", "--filter", "@todo-p2p/web", "dev"]
