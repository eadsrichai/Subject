-- Multi-program support. Moves the existing single-program data (ปวส. 31901)
-- into the new structure in place; works on an empty database too.

-- 1. Programs, with the one program the existing data belongs to.
CREATE TYPE "Level" AS ENUM ('PVC', 'PVS');

CREATE TABLE "Program" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "name" TEXT NOT NULL,
    "typeName" TEXT NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 2567,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

INSERT INTO "Program" ("code", "level", "name", "typeName")
VALUES ('31901', 'PVS', 'เทคโนโลยีสารสนเทศ', 'อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ');

-- 2. Every category belongs to 31901; category codes are unique per program only.
ALTER TABLE "Category" ADD COLUMN "programId" INTEGER;
UPDATE "Category" SET "programId" = (SELECT "id" FROM "Program" WHERE "code" = '31901');
ALTER TABLE "Category" ALTER COLUMN "programId" SET NOT NULL;

DROP INDEX "Category_code_key";
CREATE UNIQUE INDEX "Category_programId_code_key" ON "Category"("programId", "code");

ALTER TABLE "Category" ADD CONSTRAINT "Category_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Each course's category and source page become its placement in 31901.
CREATE TABLE "ProgramCourse" (
    "programId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "sourcePage" INTEGER,

    CONSTRAINT "ProgramCourse_pkey" PRIMARY KEY ("programId","courseId")
);

CREATE INDEX "ProgramCourse_categoryId_idx" ON "ProgramCourse"("categoryId");

INSERT INTO "ProgramCourse" ("programId", "courseId", "categoryId", "sourcePage")
SELECT p."id", c."id", c."categoryId", c."sourcePage"
FROM "Course" c CROSS JOIN "Program" p
WHERE p."code" = '31901';

ALTER TABLE "ProgramCourse" ADD CONSTRAINT "ProgramCourse_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgramCourse" ADD CONSTRAINT "ProgramCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramCourse" ADD CONSTRAINT "ProgramCourse_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Courses imported from the PDF (those with a source page) are owned by 31901;
--    courses created on the website have no owner.
ALTER TABLE "Course" ADD COLUMN "sourceProgramCode" TEXT;
UPDATE "Course" SET "sourceProgramCode" = '31901' WHERE "sourcePage" IS NOT NULL;

-- 5. The old single-program columns.
ALTER TABLE "Course" DROP CONSTRAINT "Course_categoryId_fkey";
ALTER TABLE "Course" DROP COLUMN "categoryId",
DROP COLUMN "sourcePage";
