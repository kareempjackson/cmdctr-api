-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "visualData" JSONB,
ADD COLUMN     "workflowType" TEXT NOT NULL DEFAULT 'sequential';
