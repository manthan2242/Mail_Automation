-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "lastSSOLogin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "lastSSOLogin" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "externalProvider" TEXT,
ADD COLUMN     "lastSSOLogin" TIMESTAMP(3);
