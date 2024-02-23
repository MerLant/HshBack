-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('VK', 'YANDEX');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider" "Provider";
