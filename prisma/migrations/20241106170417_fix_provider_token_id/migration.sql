-- DropIndex
DROP INDEX "session_providerTokenId_key";

-- CreateIndex
CREATE INDEX "session_providerTokenId_idx" ON "session"("providerTokenId");
