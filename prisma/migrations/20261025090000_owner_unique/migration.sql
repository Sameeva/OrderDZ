-- One store per owner, enforced by the database (two simultaneous sign-ups cannot both create one).
DROP INDEX "Store_ownerId_idx";
CREATE UNIQUE INDEX "Store_ownerId_key" ON "Store"("ownerId");
