export function stringifyValues(options: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [key, String(value)]),
  )
}
