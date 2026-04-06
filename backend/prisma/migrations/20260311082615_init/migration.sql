-- CreateEnum
CREATE TYPE "AllergyCategory" AS ENUM ('dairy', 'peanuts', 'gluten', 'soy', 'eggs', 'shellfish', 'tree_nuts', 'sesame', 'fragrance', 'preservatives', 'colorants', 'sulfates', 'parabens');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllergyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "medicalConditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllergyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileAllergy" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "category" "AllergyCategory" NOT NULL,
    "severity" "SeverityLevel" NOT NULL,

    CONSTRAINT "ProfileAllergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientKnowledge" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "synonyms" TEXT[],
    "derivatives" TEXT[],
    "categories" "AllergyCategory"[],
    "sourceList" TEXT[],
    "scientificName" TEXT,
    "description" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceImageName" TEXT,
    "productQuery" TEXT,
    "rawExtractedText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisProfileHit" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "matchedRisk" JSONB NOT NULL,
    "safeIngredients" JSONB NOT NULL,
    "notes" JSONB NOT NULL,

    CONSTRAINT "AnalysisProfileHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileAllergy_profileId_category_key" ON "ProfileAllergy"("profileId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientKnowledge_canonicalName_key" ON "IngredientKnowledge"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientKnowledge_normalizedName_key" ON "IngredientKnowledge"("normalizedName");

-- AddForeignKey
ALTER TABLE "AllergyProfile" ADD CONSTRAINT "AllergyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileAllergy" ADD CONSTRAINT "ProfileAllergy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AllergyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisHistory" ADD CONSTRAINT "AnalysisHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisProfileHit" ADD CONSTRAINT "AnalysisProfileHit_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AnalysisHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisProfileHit" ADD CONSTRAINT "AnalysisProfileHit_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AllergyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
