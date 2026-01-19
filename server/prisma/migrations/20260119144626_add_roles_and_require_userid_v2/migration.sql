-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_userId_fkey";

-- DropForeignKey
ALTER TABLE "VideoGame" DROP CONSTRAINT "VideoGame_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- Create default admin if not exists
INSERT INTO "User" ("username", "password", "role", "updatedAt")
VALUES ('admin', '$2a$10$p05mI3fB9oHk/zFvL5jGueGjL8jGueGjL8jGueGjL8jGueGjL8jGue', 'admin', NOW())
ON CONFLICT ("username") DO UPDATE SET "role" = 'admin';

-- Update existing NULL userId to point to the admin user
UPDATE "Todo" SET "userId" = (SELECT "id" FROM "User" WHERE "username" = 'admin' LIMIT 1) WHERE "userId" IS NULL;
UPDATE "VideoGame" SET "userId" = (SELECT "id" FROM "User" WHERE "username" = 'admin' LIMIT 1) WHERE "userId" IS NULL;

-- AlterTable (Make userId required)
ALTER TABLE "Todo" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable (Make userId required)
ALTER TABLE "VideoGame" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoGame" ADD CONSTRAINT "VideoGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
