/*
  Warnings:

  - You are about to drop the column `promptsLimit` on the `Usage` table. All the data in the column will be lost.
  - You are about to drop the column `promptsUsed` on the `Usage` table. All the data in the column will be lost.
  - You are about to drop the column `resetDate` on the `Usage` table. All the data in the column will be lost.
  - You are about to drop the column `tier` on the `Usage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Canvas" ADD COLUMN     "initialPrompt" TEXT;

-- AlterTable
ALTER TABLE "CanvasLayout" ADD COLUMN     "initialPrompt" TEXT;

-- AlterTable
ALTER TABLE "Usage" DROP COLUMN "promptsLimit",
DROP COLUMN "promptsUsed",
DROP COLUMN "resetDate",
DROP COLUMN "tier",
ADD COLUMN     "lastReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requests" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CustomAction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "code" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggers" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecuted" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "condition" TEXT,
    "dependsOn" TEXT[],
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomAction_createdBy_idx" ON "CustomAction"("createdBy");

-- CreateIndex
CREATE INDEX "CustomAction_category_idx" ON "CustomAction"("category");

-- CreateIndex
CREATE INDEX "CustomAction_isPublic_idx" ON "CustomAction"("isPublic");

-- CreateIndex
CREATE INDEX "Workflow_createdBy_idx" ON "Workflow"("createdBy");

-- CreateIndex
CREATE INDEX "Workflow_workspaceId_idx" ON "Workflow"("workspaceId");

-- CreateIndex
CREATE INDEX "Workflow_isActive_idx" ON "Workflow"("isActive");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowId_idx" ON "WorkflowStep"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowStep_position_idx" ON "WorkflowStep"("position");

-- AddForeignKey
ALTER TABLE "CustomAction" ADD CONSTRAINT "CustomAction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
