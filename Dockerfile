# Используйте официальный образ Node.js 20-slim как базовый образ
FROM node:20-slim AS base

# Установите переменные среды для PNPM
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Включаем corepack для поддержки pnpm
RUN corepack enable

RUN apt-get update -y && apt-get install -y openssl libssl-dev

# Установите pnpm
RUN corepack prepare pnpm@latest --activate

# Создайте директорию для приложения
WORKDIR /app

# Копируем файлы `package.json` и `pnpm-lock.yaml` для использования кеша
COPY package.json pnpm-lock.yaml ./

# Установите зависимости приложения, используя pnpm
RUN pnpm install --frozen-lockfile

# Копируем оставшиеся файлы исходного кода приложения
COPY . .

# Генерируем Prisma клиент
RUN pnpm prisma generate && pnpm prisma migrate deploy

# Соберите ваше приложение
RUN pnpm run build

# Используйте стадию production для уменьшения размера конечного образа
FROM node:20-slim AS production

# Установите переменные среды для PNPM
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Включаем corepack для поддержки pnpm
RUN corepack enable

# Установите pnpm
RUN corepack prepare pnpm@latest --activate

WORKDIR /app

# Копируем зависимости из base стадии
COPY --from=base /app/node_modules ./node_modules

# Копируем собранные файлы и сгенерированный Prisma клиент из стадии base
COPY --from=base /app/dist ./dist

# Определяем команду для запуска миграций Prisma и старта приложения
CMD node dist/main
