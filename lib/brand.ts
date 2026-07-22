export const DEFAULT_BRAND_NAME = "Deero Institute"

export function getBrandName(): string {
  const fromEnv = process.env.EMAIL_BRAND_NAME?.trim() || process.env.INSTITUTE_NAME?.trim()
  return fromEnv || DEFAULT_BRAND_NAME
}
