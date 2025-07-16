-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "icon" TEXT NOT NULL DEFAULT '🤖',
ADD COLUMN     "memoryScope" TEXT NOT NULL DEFAULT 'workspace',
ADD COLUMN     "model" TEXT NOT NULL DEFAULT 'GPT-4',
ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '{"canAccessFiles": true, "canReadJots": true, "canTakeActions": true}',
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'Assistant';
