-- Hidden students keep their class assignment so restoring visibility returns
-- them to the same class, while class/teacher rosters can exclude them.
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Student_classId_isHidden_isActive_idx"
ON "Student"("classId", "isHidden", "isActive");
