-- CreateTable
CREATE TABLE "GameRanking" (
    "id" SERIAL NOT NULL,
    "gameName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "genre" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRanking_pkey" PRIMARY KEY ("id")
);
