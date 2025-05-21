/*
  Warnings:

  - You are about to drop the column `intent` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Workspace` table. All the data in the column will be lost.
  - Added the required column `config` to the `Agent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purpose` to the `Agent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_userId_fkey";

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "config" JSONB NOT NULL,
ADD COLUMN     "purpose" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "intent",
DROP COLUMN "role",
ADD COLUMN     "createdBy" TEXT NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
