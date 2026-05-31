-- AlterTable: add sourceKey and contentHash to Skill
ALTER TABLE "Skill" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "Skill" ADD COLUMN "contentHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Skill_authorId_sourceKey_key" ON "Skill"("authorId", "sourceKey");

-- CreateTable: PersonalAccessToken
CREATE TABLE "PersonalAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAccessToken_tokenHash_key" ON "PersonalAccessToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "PersonalAccessToken" ADD CONSTRAINT "PersonalAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
