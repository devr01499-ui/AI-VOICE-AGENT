-- CreateTable
CREATE TABLE "ProgrammaticPage" (
    "id" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "variableData" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "bodyContent" TEXT NOT NULL,
    "faqItems" JSONB NOT NULL,
    "schemaMarkup" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notionPageId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gscImpressions" INTEGER DEFAULT 0,
    "gscClicks" INTEGER DEFAULT 0,
    "gscAvgPosition" DOUBLE PRECISION,

    CONSTRAINT "ProgrammaticPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammaticPage_slug_key" ON "ProgrammaticPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammaticPage_notionPageId_key" ON "ProgrammaticPage"("notionPageId");
