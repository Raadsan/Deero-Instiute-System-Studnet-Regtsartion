ALTER TABLE "Student" ADD COLUMN "studentCode" TEXT;

WITH class_codes AS (
  SELECT
    c.id,
    COALESCE(
      NULLIF(
        (
          SELECT string_agg(
            CASE
              WHEN token ~* '^batch[0-9]*$' THEN upper(token)
              ELSE upper(left(token, 1))
            END,
            ''
          )
          FROM regexp_split_to_table(trim(c.name), E'\\s+') AS token
        ),
        ''
      ),
      'STU'
    ) AS prefix
  FROM "Class" c
),
numbered_students AS (
  SELECT
    s.id,
    COALESCE(cc.prefix, 'STU') AS prefix,
    row_number() OVER (
      PARTITION BY COALESCE(cc.prefix, 'STU')
      ORDER BY s."createdAt", s.id
    ) AS sequence_number
  FROM "Student" s
  LEFT JOIN class_codes cc ON cc.id = s."classId"
)
UPDATE "Student" s
SET "studentCode" = ns.prefix || '-' || lpad(ns.sequence_number::text, 3, '0')
FROM numbered_students ns
WHERE ns.id = s.id;

CREATE UNIQUE INDEX "Student_studentCode_key" ON "Student"("studentCode");
