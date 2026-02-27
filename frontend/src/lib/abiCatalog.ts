import type { Abi } from 'viem'
export type AbiCatalog = Record<string, Abi>

export type AbiCatalogKey = string

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function guessAbiKey(contractName: string, catalog: AbiCatalog): AbiCatalogKey | undefined {
  const normalizedTarget = normalizeName(contractName)
  const keys = Object.keys(catalog)

  const exactMatch = keys.find((key) => normalizeName(key) === normalizedTarget)
  if (exactMatch) return exactMatch

  return keys.find((key) => {
    const normalizedKey = normalizeName(key)
    return normalizedKey.includes(normalizedTarget) || normalizedTarget.includes(normalizedKey)
  })
}
