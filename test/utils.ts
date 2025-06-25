export function stringifyValues(
  options: Record<string, any>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [key, String(value)]),
  )
}
