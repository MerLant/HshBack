-- CreateTable
CREATE TABLE "user" (
    "id" VARCHAR(36) NOT NULL,
    "nickName" VARCHAR(12),
    "displayName" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roleId" INTEGER,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token" (
    "id" VARCHAR(36) NOT NULL,
    "token" VARCHAR(36) NOT NULL,
    "exp" TIMESTAMP(3) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "userAgent" TEXT NOT NULL,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_test" (
    "id" VARCHAR(36) NOT NULL,
    "taskId" INTEGER NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,

    CONSTRAINT "task_test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solution" (
    "id" VARCHAR(36) NOT NULL,
    "buildId" VARCHAR(36) NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT,
    "is_passed" BOOLEAN NOT NULL,
    "statusCode" INTEGER NOT NULL,

    CONSTRAINT "solution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build" (
    "id" VARCHAR(36) NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userCode" TEXT NOT NULL,
    "buildDate" TIMESTAMP(3) NOT NULL,
    "lang" VARCHAR(8),

    CONSTRAINT "build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "description" TEXT,
    "isDisable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "description" TEXT,
    "courseId" INTEGER NOT NULL,
    "isDisable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "description" TEXT,
    "runTimeout" INTEGER NOT NULL,
    "runMemoryLimit" INTEGER NOT NULL,
    "compileTimeout" INTEGER NOT NULL,
    "compileMemoryLimit" INTEGER NOT NULL,
    "themeId" INTEGER NOT NULL,
    "isDisable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(12) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider" (
    "id" SERIAL NOT NULL,
    "userId" VARCHAR(36) NOT NULL,
    "providerUserId" VARCHAR(255) NOT NULL,
    "providerTypeId" INTEGER NOT NULL,

    CONSTRAINT "provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_token" (
    "id" VARCHAR(36) NOT NULL,
    "providerToken" VARCHAR(255) NOT NULL,
    "providerTypeId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,

    CONSTRAINT "provider_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_type" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(12) NOT NULL,

    CONSTRAINT "provider_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" VARCHAR(36) NOT NULL,
    "refreshTokenId" VARCHAR(36) NOT NULL,
    "providerTokenId" VARCHAR(36) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_group" (
    "userId" VARCHAR(36) NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "users_group_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateTable
CREATE TABLE "group" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "admin" VARCHAR(36) NOT NULL,
    "code" VARCHAR(6) NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_nickName_key" ON "user"("nickName");

-- CreateIndex
CREATE INDEX "user_displayName_idx" ON "user"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "token_token_key" ON "token"("token");

-- CreateIndex
CREATE INDEX "token_exp_userId_idx" ON "token"("exp", "userId");

-- CreateIndex
CREATE INDEX "build_userId_taskId_idx" ON "build"("userId", "taskId");

-- CreateIndex
CREATE INDEX "theme_name_idx" ON "theme"("name");

-- CreateIndex
CREATE INDEX "task_name_idx" ON "task"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE INDEX "role_name_idx" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "provider_providerUserId_providerTypeId_key" ON "provider"("providerUserId", "providerTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_type_name_key" ON "provider_type"("name");

-- CreateIndex
CREATE UNIQUE INDEX "session_refreshTokenId_key" ON "session"("refreshTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "session_providerTokenId_key" ON "session"("providerTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "group_code_key" ON "group"("code");

-- CreateIndex
CREATE INDEX "group_name_code_idx" ON "group"("name", "code");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token" ADD CONSTRAINT "token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_test" ADD CONSTRAINT "task_test_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution" ADD CONSTRAINT "solution_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build" ADD CONSTRAINT "build_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "build" ADD CONSTRAINT "build_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theme" ADD CONSTRAINT "theme_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider" ADD CONSTRAINT "provider_providerTypeId_fkey" FOREIGN KEY ("providerTypeId") REFERENCES "provider_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_token" ADD CONSTRAINT "provider_token_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_refreshTokenId_fkey" FOREIGN KEY ("refreshTokenId") REFERENCES "token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_providerTokenId_fkey" FOREIGN KEY ("providerTokenId") REFERENCES "provider_token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_group" ADD CONSTRAINT "users_group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_group" ADD CONSTRAINT "users_group_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group" ADD CONSTRAINT "group_admin_fkey" FOREIGN KEY ("admin") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
