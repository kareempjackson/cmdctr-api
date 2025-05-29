-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "lastModifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainingStatus" TEXT NOT NULL DEFAULT 'untrained',
    "lastTrainedAt" TIMESTAMP(3),
    "trainingMetrics" JSONB,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeAgentAccess" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL DEFAULT 'read',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeAgentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeTraining" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metrics" JSONB,
    "errorMessage" TEXT,
    "triggeredBy" TEXT NOT NULL,

    CONSTRAINT "KnowledgeTraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_KnowledgeEntryToKnowledgeTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_KnowledgeEntryToKnowledgeTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "KnowledgeEntry_workspaceId_idx" ON "KnowledgeEntry"("workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_type_idx" ON "KnowledgeEntry"("type");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_status_idx" ON "KnowledgeEntry"("status");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_trainingStatus_idx" ON "KnowledgeEntry"("trainingStatus");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_createdAt_idx" ON "KnowledgeEntry"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeTag_workspaceId_idx" ON "KnowledgeTag"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeTag_name_workspaceId_key" ON "KnowledgeTag"("name", "workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeAgentAccess_agentId_idx" ON "KnowledgeAgentAccess"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeAgentAccess_knowledgeEntryId_agentId_key" ON "KnowledgeAgentAccess"("knowledgeEntryId", "agentId");

-- CreateIndex
CREATE INDEX "KnowledgeTraining_knowledgeEntryId_idx" ON "KnowledgeTraining"("knowledgeEntryId");

-- CreateIndex
CREATE INDEX "KnowledgeTraining_status_idx" ON "KnowledgeTraining"("status");

-- CreateIndex
CREATE INDEX "KnowledgeTraining_startedAt_idx" ON "KnowledgeTraining"("startedAt");

-- CreateIndex
CREATE INDEX "_KnowledgeEntryToKnowledgeTag_B_index" ON "_KnowledgeEntryToKnowledgeTag"("B");

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_lastModifiedBy_fkey" FOREIGN KEY ("lastModifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeTag" ADD CONSTRAINT "KnowledgeTag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAgentAccess" ADD CONSTRAINT "KnowledgeAgentAccess_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAgentAccess" ADD CONSTRAINT "KnowledgeAgentAccess_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeTraining" ADD CONSTRAINT "KnowledgeTraining_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeTraining" ADD CONSTRAINT "KnowledgeTraining_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KnowledgeEntryToKnowledgeTag" ADD CONSTRAINT "_KnowledgeEntryToKnowledgeTag_A_fkey" FOREIGN KEY ("A") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KnowledgeEntryToKnowledgeTag" ADD CONSTRAINT "_KnowledgeEntryToKnowledgeTag_B_fkey" FOREIGN KEY ("B") REFERENCES "KnowledgeTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
