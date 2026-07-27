-- CreateTable
CREATE TABLE "GmpProject" (
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "organization" TEXT,
    "workspaceId" TEXT NOT NULL,
    "ownerActorId" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "businessProfileRef" TEXT,
    "businessGenomeRef" TEXT,
    "defaultLanguage" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpProject_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "GmpSite" (
    "siteId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "primaryDomain" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "publishingPlatform" TEXT NOT NULL,
    "publishingStatus" TEXT NOT NULL,
    "authenticationMethod" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "publishingCapabilities" JSONB NOT NULL,
    "defaultLanguage" TEXT NOT NULL,
    "defaultTheme" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpSite_pkey" PRIMARY KEY ("siteId")
);

-- CreateTable
CREATE TABLE "GmpBrandProfile" (
    "brandProfileId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tagline" TEXT,
    "mission" TEXT,
    "brandVoice" TEXT,
    "writingStyle" TEXT,
    "primaryAudience" TEXT,
    "secondaryAudience" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "logoReferences" JSONB NOT NULL,
    "typography" JSONB,
    "assetReferences" JSONB NOT NULL,
    "socialLinks" JSONB NOT NULL,
    "contactInformation" JSONB,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpBrandProfile_pkey" PRIMARY KEY ("brandProfileId")
);

-- CreateTable
CREATE TABLE "GmpPublishingConnection" (
    "connectionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "publishingStatus" TEXT NOT NULL,
    "authenticationMethod" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "publishingCapabilities" JSONB NOT NULL,
    "configuration" JSONB,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastValidatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPublishingConnection_pkey" PRIMARY KEY ("connectionId")
);

-- CreateTable
CREATE TABLE "GmpEnvironmentConfig" (
    "configId" TEXT NOT NULL,
    "projectId" TEXT,
    "siteId" TEXT,
    "environment" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpEnvironmentConfig_pkey" PRIMARY KEY ("configId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmpProject_workspaceId_slug_key" ON "GmpProject"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "GmpProject_workspaceId_updatedAt_idx" ON "GmpProject"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpProject_status_updatedAt_idx" ON "GmpProject"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSite_projectId_updatedAt_idx" ON "GmpSite"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSite_environment_updatedAt_idx" ON "GmpSite"("environment", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSite_connectionStatus_updatedAt_idx" ON "GmpSite"("connectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpBrandProfile_projectId_key" ON "GmpBrandProfile"("projectId");

-- CreateIndex
CREATE INDEX "GmpBrandProfile_updatedAt_idx" ON "GmpBrandProfile"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingConnection_siteId_updatedAt_idx" ON "GmpPublishingConnection"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingConnection_provider_updatedAt_idx" ON "GmpPublishingConnection"("provider", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingConnection_connectionStatus_updatedAt_idx" ON "GmpPublishingConnection"("connectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEnvironmentConfig_projectId_environment_idx" ON "GmpEnvironmentConfig"("projectId", "environment");

-- CreateIndex
CREATE INDEX "GmpEnvironmentConfig_siteId_environment_idx" ON "GmpEnvironmentConfig"("siteId", "environment");

-- AddForeignKey
ALTER TABLE "GmpSite"
ADD CONSTRAINT "GmpSite_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpBrandProfile"
ADD CONSTRAINT "GmpBrandProfile_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPublishingConnection"
ADD CONSTRAINT "GmpPublishingConnection_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "GmpSite"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpEnvironmentConfig"
ADD CONSTRAINT "GmpEnvironmentConfig_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpEnvironmentConfig"
ADD CONSTRAINT "GmpEnvironmentConfig_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "GmpSite"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;
