-- CreateTable
CREATE TABLE "AgentTrainingFile" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ready',

    CONSTRAINT "AgentTrainingFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentTrainingFile" ADD CONSTRAINT "AgentTrainingFile_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
