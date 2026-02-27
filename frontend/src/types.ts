export type ProxyType = 'uups' | 'beacon' | 'direct'

export type AbiMode = 'local' | 'paste'

export interface NetworkConfig {
  id: string
  name: string
  rpcUrl: string
  chainId?: number
  blockNumber?: string
}

export interface ContractConfig {
  id: string
  name: string
  address: `0x${string}`
  networkId: string
  proxyType: ProxyType
  abiMode: AbiMode
  abiKey?: string
  pastedAbi?: string
}
