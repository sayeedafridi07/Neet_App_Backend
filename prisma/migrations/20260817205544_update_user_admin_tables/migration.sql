/*
  Warnings:

  - You are about to drop the column `status` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "status",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "status",
ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "Status";
