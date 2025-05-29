-- CreateTable
CREATE TABLE "CanvasLayout" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Canvas',
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanvasBlock" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "title" TEXT,
    "config" JSONB NOT NULL,
    "data" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanvasBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanvasLayout_workspaceId_idx" ON "CanvasLayout"("workspaceId");

-- CreateIndex
CREATE INDEX "CanvasLayout_createdAt_idx" ON "CanvasLayout"("createdAt");

-- CreateIndex
CREATE INDEX "CanvasBlock_canvasId_idx" ON "CanvasBlock"("canvasId");

-- CreateIndex
CREATE INDEX "CanvasBlock_position_idx" ON "CanvasBlock"("position");

-- CreateIndex
CREATE INDEX "CanvasBlock_type_idx" ON "CanvasBlock"("type");

-- AddForeignKey
ALTER TABLE "CanvasLayout" ADD CONSTRAINT "CanvasLayout_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanvasBlock" ADD CONSTRAINT "CanvasBlock_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CanvasLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
