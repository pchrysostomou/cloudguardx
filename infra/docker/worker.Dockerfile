FROM node:22-bookworm-slim AS development

WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/policy-engine/package.json packages/policy-engine/package.json
COPY packages/risk-engine/package.json packages/risk-engine/package.json
COPY packages/aws-connectors/package.json packages/aws-connectors/package.json

RUN npm install

COPY . .

CMD ["npm", "run", "start:dev", "--workspace", "@cloudguardx/worker"]

FROM development AS build
RUN npm run build --workspace @cloudguardx/worker

FROM node:22-bookworm-slim AS production
WORKDIR /workspace
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/policy-engine/package.json packages/policy-engine/package.json
COPY packages/risk-engine/package.json packages/risk-engine/package.json
COPY packages/aws-connectors/package.json packages/aws-connectors/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm install --omit=dev

COPY --from=build /workspace/apps/worker/dist apps/worker/dist

CMD ["node", "apps/worker/dist/main.js"]
