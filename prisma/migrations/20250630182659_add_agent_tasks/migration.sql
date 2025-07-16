/*
  Warnings:

  - You are about to drop the column `assignedBy` on the `AgentTask` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `AgentTask` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `AgentTask` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `AgentTask` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "AgentTask" DROP CONSTRAINT "AgentTask_assignedBy_fkey";

-- AlterTable
ALTER TABLE "AgentTask" DROP COLUMN "assignedBy",
DROP COLUMN "description",
DROP COLUMN "startedAt",
DROP COLUMN "title",
ADD COLUMN     "tags" TEXT[];

-- CreateIndex
CREATE INDEX "AgentTask_createdBy_idx" ON "AgentTask"("createdBy");
