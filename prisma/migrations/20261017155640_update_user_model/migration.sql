/*
  Warnings:

  - You are about to drop the column `created_by` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `user` table. All the data in the column will be lost.
  - Added the required column `password_hash` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "created_by",
DROP COLUMN "passwordHash",
ADD COLUMN     "password_hash" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'user',
ALTER COLUMN "status" SET DEFAULT 'active';
