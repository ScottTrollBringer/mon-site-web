-- CreateTable
CREATE TABLE "PaintingProject" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaintingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintingImage" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "paintingProjectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaintingImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaintingImage" ADD CONSTRAINT "PaintingImage_paintingProjectId_fkey" FOREIGN KEY ("paintingProjectId") REFERENCES "PaintingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
