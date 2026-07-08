-- AlterTable
ALTER TABLE "User" ADD COLUMN "managerId" TEXT;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "managerId" TEXT;

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE INDEX "Invitation_managerId_idx" ON "Invitation"("managerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
