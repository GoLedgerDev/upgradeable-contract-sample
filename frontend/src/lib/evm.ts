import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  hexToBigInt,
  hexToString,
  http,
  isAddress,
  pad,
  type Abi,
  type AbiParameter,
  type Address,
  type Hex,
} from 'viem'

const IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const
const BEACON_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' as const

const beaconIntrospectionAbi = [
  {
    type: 'function',
    name: 'implementation',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const satisfies Abi

declare global {
  interface Window {
    ethereum?: unknown
  }
}

export function makePublicClient(rpcUrl: string) {
  return createPublicClient({
    transport: http(rpcUrl),
  })
}

export async function checkRpcHealth(rpcUrl: string) {
  const client = makePublicClient(rpcUrl)
  const [chainId, blockNumber] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
  ])

  return {
    chainId,
    blockNumber: blockNumber.toString(),
  }
}

export async function ensureWalletAccount() {
  if (!window.ethereum) {
    throw new Error('No injected wallet found. Install MetaMask or Rabby.')
  }

  const walletClient = createWalletClient({
    transport: custom(window.ethereum as any),
  })

  const [account] = await walletClient.requestAddresses()
  if (!account) {
    throw new Error('No wallet account available.')
  }

  return { walletClient, account }
}

export function parseArg(param: AbiParameter, rawValue: string): unknown {
  if (param.type.endsWith('[]')) {
    const baseType = param.type.slice(0, -2)
    return rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => parseSingle(baseType, item))
  }

  return parseSingle(param.type, rawValue)
}

function parseSingle(type: string, value: string): unknown {
  const trimmed = value.trim()
  if (type.startsWith('uint') || type.startsWith('int')) {
    return BigInt(trimmed)
  }
  if (type === 'bool') {
    if (trimmed !== 'true' && trimmed !== 'false') {
      throw new Error('Boolean params must be true or false.')
    }
    return trimmed === 'true'
  }
  if (type === 'address') {
    if (!isAddress(trimmed)) {
      throw new Error(`Invalid address: ${trimmed}`)
    }
    return trimmed as Address
  }
  if (type.startsWith('bytes')) {
    if (!trimmed.startsWith('0x')) {
      throw new Error(`Bytes params must start with 0x: ${trimmed}`)
    }
    return trimmed as Hex
  }

  return trimmed
}

export function prettyValue(value: unknown): string {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.map((item) => prettyValue(item)).join(', ')}]`
  if (value && typeof value === 'object') return JSON.stringify(value)
  return 'null'
}

function slotValueToAddress(slot: Hex | null | undefined): Address | undefined {
  if (!slot) return undefined
  const normalized = slot.toLowerCase()
  if (normalized === '0x' || /^0x0+$/.test(normalized)) return undefined
  return (`0x${normalized.slice(-40)}` as Address)
}

export interface UpgradeInfo {
  implementation?: Address
  beacon?: Address
  beaconImplementation?: Address
}

export async function getUpgradeInfo(rpcUrl: string, proxyAddress: Address): Promise<UpgradeInfo> {
  const client = makePublicClient(rpcUrl)
  const [implementationSlot, beaconSlot] = await Promise.all([
    client.getStorageAt({ address: proxyAddress, slot: IMPLEMENTATION_SLOT }),
    client.getStorageAt({ address: proxyAddress, slot: BEACON_SLOT }),
  ])

  const implementation = slotValueToAddress(implementationSlot)
  const beacon = slotValueToAddress(beaconSlot)

  let beaconImplementation: Address | undefined
  if (beacon) {
    try {
      beaconImplementation = await client.readContract({
        address: beacon,
        abi: beaconIntrospectionAbi,
        functionName: 'implementation',
      })
    } catch {
      beaconImplementation = undefined
    }
  }

  return {
    implementation,
    beacon,
    beaconImplementation,
  }
}

export function summarizeNativeValue(hexWei: Hex) {
  try {
    const wei = hexToBigInt(hexWei)
    return `${wei.toString()} wei (${formatEther(wei)} ETH)`
  } catch {
    return hexWei
  }
}

export function to32ByteHexAddress(address: Address): Hex {
  return pad(address, { size: 32 })
}

export function hexToUtf8IfPossible(value: Hex) {
  try {
    return hexToString(value)
  } catch {
    return value
  }
}
