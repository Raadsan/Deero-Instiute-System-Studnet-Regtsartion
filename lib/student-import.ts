const STUDENT_NAME_HEADERS = new Set([
  "name",
  "student name",
  "student names",
  "students name",
  "students names",
  "full name",
  "full names",
])

export function normalizeImportHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
}

export function isStudentNameHeader(value: unknown) {
  return STUDENT_NAME_HEADERS.has(normalizeImportHeader(value))
}

export function parseStudentFullName(value: unknown) {
  const fullName = String(value ?? "").trim().replace(/\s+/g, " ")
  if (!fullName) return null

  const [firstName, ...remainingNames] = fullName.split(" ")
  return {
    firstName,
    lastName: remainingNames.join(" ") || "Unknown",
  }
}
