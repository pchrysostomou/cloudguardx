FROM node:22-bookworm-slim AS development

WORKDIR /workspace

COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace", "@cloudguardx/web", "--", "--host", "0.0.0.0"]

FROM development AS build
RUN npm run build --workspace @cloudguardx/web

FROM nginx:1.27-alpine AS production
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

