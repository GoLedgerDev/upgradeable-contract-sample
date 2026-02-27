import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ArrowRightLeft, Cable, FlaskConical, Upload } from 'lucide-react'
import {
  encodeFunctionData,
  isAddress,
  parseEther,
  parseEventLogs,
  type Abi,
  type AbiFunction,
  type Address,
} from 'viem'
import { guessAbiKey, type AbiCatalog, type AbiCatalogKey } from './lib/abiCatalog'
import { checkRpcHealth, ensureWalletAccount, makePublicClient, parseArg, prettyValue } from './lib/evm'
import type { ContractConfig, NetworkConfig, ProxyType } from './types'

const NETWORK_STORAGE_KEY = 'upgrade-ui.networks.v1'
const CONTRACT_STORAGE_KEY = 'upgrade-ui.contracts.v1'

const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    id: crypto.randomUUID(),
    name: 'Local Besu/Anvil',
    rpcUrl: 'http://127.0.0.1:8545',
  },
]

function getSaved<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key)
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function signatureOf(fn: AbiFunction): string {
  return `${fn.name}(${fn.inputs.map((input) => input.type).join(',')})`
}

function isAbiFunction(item: Abi[number]): item is AbiFunction {
  return item.type === 'function'
}

function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address
}

function readWriteGroups(abi: Abi) {
  const functions = abi.filter(isAbiFunction)
  return {
    read: functions.filter(
      (fn) => fn.stateMutability === 'view' || fn.stateMutability === 'pure',
    ),
    write: functions.filter(
      (fn) => fn.stateMutability === 'nonpayable' || fn.stateMutability === 'payable',
    ),
  }
}

function collectAddresses(value: unknown, found: Set<Address>) {
  if (typeof value === 'string') {
    if (isAddress(value)) {
      found.add(value.toLowerCase() as Address)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectAddresses(item, found))
    return
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectAddresses(item, found))
  }
}

function extractAddressesFromReceipt(receipt: Awaited<ReturnType<ReturnType<typeof makePublicClient>['waitForTransactionReceipt']>>, abi: Abi): Address[] {
  const found = new Set<Address>()

  if (receipt.contractAddress) {
    found.add(receipt.contractAddress.toLowerCase() as Address)
  }

  const parsedLogs = parseEventLogs({
    abi,
    logs: receipt.logs,
    strict: false,
  })

  parsedLogs.forEach((logItem) => {
    collectAddresses(logItem.args, found)
  })

  return [...found]
}

function App() {
  const [abiCatalog, setAbiCatalog] = useState<AbiCatalog>({})
  const [loadingAbiCatalog, setLoadingAbiCatalog] = useState(false)
  const abiKeys = useMemo(() => Object.keys(abiCatalog), [abiCatalog])

  const [networks, setNetworks] = useState<NetworkConfig[]>(() =>
    getSaved(NETWORK_STORAGE_KEY, DEFAULT_NETWORKS),
  )
  const [contracts, setContracts] = useState<ContractConfig[]>(() =>
    getSaved(CONTRACT_STORAGE_KEY, [] as ContractConfig[]),
  )
  const [activeNetworkId, setActiveNetworkId] = useState<string>(() =>
    getSaved(NETWORK_STORAGE_KEY, DEFAULT_NETWORKS)[0]?.id ?? '',
  )
  const [activeContractId, setActiveContractId] = useState<string>('')
  const [logLines, setLogLines] = useState<string[]>([])
  const [callInputs, setCallInputs] = useState<Record<string, string[]>>({})
  const [runningCall, setRunningCall] = useState<string | null>(null)

  const [newNetworkName, setNewNetworkName] = useState('')
  const [newNetworkRpc, setNewNetworkRpc] = useState('')
  const [newContractName, setNewContractName] = useState('')
  const [newContractAddress, setNewContractAddress] = useState('')
  const [newContractProxyType, setNewContractProxyType] = useState<ProxyType>('uups')
  const [newContractAbiMode, setNewContractAbiMode] = useState<'local' | 'paste'>('local')
  const [newContractAbiKey, setNewContractAbiKey] = useState<AbiCatalogKey>(() => abiKeys[0] ?? '')
  const [newContractPastedAbi, setNewContractPastedAbi] = useState('')

  const loadAbiCatalog = useCallback(async () => {
    setLoadingAbiCatalog(true)

    try {
      const response = await fetch(`/__foundry/abis?at=${Date.now()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`ABI endpoint failed with status ${response.status}`)
      }

      const payload = (await response.json()) as { catalog?: AbiCatalog }
      setAbiCatalog(payload.catalog ?? {})
    } catch (error) {
      setAbiCatalog({})
      log(`Failed to load Foundry ABIs: ${(error as Error).message}`)
    } finally {
      setLoadingAbiCatalog(false)
    }
  }, [])

  useEffect(() => {
    void loadAbiCatalog()
  }, [loadAbiCatalog])

  useEffect(() => {
    if (newContractAbiMode !== 'local') return
    if (abiKeys.length === 0) {
      if (newContractAbiKey !== '') setNewContractAbiKey('')
      return
    }

    if (!abiKeys.includes(newContractAbiKey)) {
      setNewContractAbiKey(abiKeys[0])
    }
  }, [abiKeys, newContractAbiKey, newContractAbiMode])

  const activeNetwork = useMemo(
    () => networks.find((network) => network.id === activeNetworkId),
    [networks, activeNetworkId],
  )

  const filteredContracts = useMemo(
    () => contracts.filter((contract) => contract.networkId === activeNetworkId),
    [contracts, activeNetworkId],
  )

  const activeContract = useMemo(
    () => contracts.find((contract) => contract.id === activeContractId),
    [contracts, activeContractId],
  )

  const activeAbi = useMemo(() => {
    if (!activeContract) return undefined

    if (activeContract.abiMode === 'local' && activeContract.abiKey) {
      return abiCatalog[activeContract.abiKey as AbiCatalogKey]
    }

    if (activeContract.abiMode === 'paste' && activeContract.pastedAbi) {
      try {
        const parsed = JSON.parse(activeContract.pastedAbi)
        return parsed as Abi
      } catch {
        return undefined
      }
    }

    return undefined
  }, [activeContract, abiCatalog])

  const groupedMethods = useMemo(() => {
    if (!activeAbi) return { read: [], write: [] }
    return readWriteGroups(activeAbi)
  }, [activeAbi])

  function persistNetworks(next: NetworkConfig[]) {
    setNetworks(next)
    localStorage.setItem(NETWORK_STORAGE_KEY, JSON.stringify(next))
  }

  function persistContracts(next: ContractConfig[]) {
    setContracts(next)
    localStorage.setItem(CONTRACT_STORAGE_KEY, JSON.stringify(next))
  }

  function log(line: string) {
    const stamp = new Date().toLocaleTimeString()
    setLogLines((prev) => [`[${stamp}] ${line}`, ...prev].slice(0, 80))
  }

  async function handleRpcCheck(networkId: string) {
    const network = networks.find((item) => item.id === networkId)
    if (!network) return

    try {
      const health = await checkRpcHealth(network.rpcUrl)
      const updated = networks.map((item) =>
        item.id === networkId
          ? {
              ...item,
              chainId: health.chainId,
              blockNumber: health.blockNumber,
            }
          : item,
      )
      persistNetworks(updated)
      log(`RPC ${network.name} ok | chainId=${health.chainId} block=${health.blockNumber}`)
    } catch (error) {
      log(`RPC check failed for ${network.name}: ${(error as Error).message}`)
    }
  }

  function addNetwork() {
    if (!newNetworkName.trim() || !newNetworkRpc.trim()) return

    const network: NetworkConfig = {
      id: crypto.randomUUID(),
      name: newNetworkName.trim(),
      rpcUrl: newNetworkRpc.trim(),
    }

    const next = [...networks, network]
    persistNetworks(next)
    setActiveNetworkId(network.id)
    setNewNetworkName('')
    setNewNetworkRpc('')
  }

  function removeActiveNetwork() {
    if (!activeNetworkId) return

    const targetNetwork = networks.find((network) => network.id === activeNetworkId)
    const nextNetworks = networks.filter((network) => network.id !== activeNetworkId)
    persistNetworks(nextNetworks)

    const nextContracts = contracts.filter((contract) => contract.networkId !== activeNetworkId)
    const removedContractsCount = contracts.length - nextContracts.length
    persistContracts(nextContracts)

    const nextNetworkId = nextNetworks[0]?.id ?? ''
    setActiveNetworkId(nextNetworkId)

    const nextActiveContract = nextContracts.find((contract) => contract.networkId === nextNetworkId)
    setActiveContractId(nextActiveContract?.id ?? '')

    if (targetNetwork) {
      log(`Removed network ${targetNetwork.name} and ${removedContractsCount} linked contract(s).`)
    }
  }

  function addContract() {
    if (!activeNetworkId) return
    if (!newContractName.trim() || !isAddress(newContractAddress.trim())) return
    if (newContractAbiMode === 'local' && !newContractAbiKey) {
      log('No Foundry ABI available. Run forge build and click Refresh ABI list, or use Paste ABI JSON.')
      return
    }

    const contract: ContractConfig = {
      id: crypto.randomUUID(),
      name: newContractName.trim(),
      address: normalizeAddress(newContractAddress.trim()),
      networkId: activeNetworkId,
      proxyType: newContractProxyType,
      abiMode: newContractAbiMode,
      abiKey: newContractAbiMode === 'local' ? newContractAbiKey : undefined,
      pastedAbi: newContractAbiMode === 'paste' ? newContractPastedAbi : undefined,
    }

    const next = [...contracts, contract]
    persistContracts(next)
    setActiveContractId(contract.id)
    setNewContractName('')
    setNewContractAddress('')
    setNewContractPastedAbi('')
  }

  function clearLogs() {
    setLogLines([])
  }

  function removeActiveContract() {
    if (!activeContractId) return

    const next = contracts.filter((contract) => contract.id !== activeContractId)
    persistContracts(next)

    const fallback = next.find((contract) => contract.networkId === activeNetworkId)
    setActiveContractId(fallback?.id ?? '')
  }

  function refreshAbiListing() {
    void loadAbiCatalog()
  }

  async function runMethod(fn: AbiFunction) {
    if (!activeContract || !activeAbi || !activeNetwork) return
    const signature = signatureOf(fn)

    setRunningCall(signature)
    try {
      const values = callInputs[signature] ?? []
      const args = fn.inputs.map((input, index) => parseArg(input, values[index] ?? ''))
      const publicClient = makePublicClient(activeNetwork.rpcUrl)

      if (fn.stateMutability === 'view' || fn.stateMutability === 'pure') {
        const result = await (publicClient as any).readContract({
          address: activeContract.address,
          abi: activeAbi as Abi,
          functionName: fn.name,
          args,
        })
        log(`${signature} => ${prettyValue(result)}`)
        return
      }

      const { walletClient, account } = await ensureWalletAccount()
      const txValueRaw = values[fn.inputs.length] ?? '0'
      const txValue = fn.stateMutability === 'payable' ? parseEther(txValueRaw || '0') : undefined

      const data = encodeFunctionData({
        abi: activeAbi as Abi,
        functionName: fn.name as never,
        args: args as never,
      })

      const txHash = await walletClient.sendTransaction({
        account,
        chain: null,
        to: activeContract.address,
        data,
        value: txValue,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      log(`${signature} tx=${txHash} status=${receipt.status}`)

      const addresses = extractAddressesFromReceipt(receipt, activeAbi as Abi)
      if (addresses.length > 0) {
        log(`${signature} addresses: ${addresses.join(', ')}`)
      }
    } catch (error) {
      log(`${signature} failed: ${(error as Error).message}`)
    } finally {
      setRunningCall(null)
    }
  }

  async function importBroadcast(files: FileList | null) {
    if (!files || !activeNetworkId) return

    const imported: ContractConfig[] = []

    for (const file of Array.from(files)) {
      try {
        const raw = await file.text()
        const parsed = JSON.parse(raw) as {
          chain?: number
          transactions?: Array<{
            contractName?: string
            contractAddress?: string
            transactionType?: string
          }>
        }

        let lastImplementationContractName: string | undefined

        for (const tx of parsed.transactions ?? []) {
          if (tx.transactionType !== 'CREATE' || !tx.contractAddress || !isAddress(tx.contractAddress)) {
            continue
          }

          const rawName = tx.contractName?.trim() || 'ImportedContract'
          const normalized = normalizeAddress(tx.contractAddress)
          const exists = contracts.some((item) => item.address === normalized)
          if (exists) continue

          const isErc1967Proxy = rawName === 'ERC1967Proxy'
          const inferredBaseName = lastImplementationContractName ?? 'Proxy'

          const name = isErc1967Proxy ? `${inferredBaseName}Proxy` : rawName
          const abiKey = isErc1967Proxy
            ? (guessAbiKey(inferredBaseName, abiCatalog) as AbiCatalogKey | undefined)
            : guessAbiKey(rawName, abiCatalog)
          const proxyType: ProxyType = isErc1967Proxy
            ? 'uups'
            : rawName.toLowerCase().includes('proxy')
              ? 'uups'
              : rawName.toLowerCase().includes('beacon')
                ? 'beacon'
                : 'direct'

          imported.push({
            id: crypto.randomUUID(),
            name,
            address: normalized,
            networkId: activeNetworkId,
            proxyType,
            abiMode: abiKey ? 'local' : 'paste',
            abiKey,
            pastedAbi: abiKey ? undefined : '[]',
          })

          if (!isErc1967Proxy && rawName !== 'ERC1967Proxy') {
            lastImplementationContractName = rawName
          }
        }
      } catch {
        log(`Skipped invalid broadcast file: ${file.name}`)
      }
    }

    if (imported.length > 0) {
      const next = [...contracts, ...imported]
      persistContracts(next)

      const preferred =
        imported.find((item) => item.proxyType === 'uups' || item.proxyType === 'beacon') ?? imported[0]
      setActiveContractId(preferred.id)

      const proxyCount = imported.filter(
        (item) => item.proxyType === 'uups' || item.proxyType === 'beacon',
      ).length
      log(`Imported ${imported.length} contracts from broadcast JSON.`)
      if (proxyCount > 0) {
        log(
          `Selected proxy/beacon by default. For UUPS, interact with proxy address (not implementation).`,
        )
      }
    } else {
      log('No new contracts imported from selected files.')
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 text-slate-900 md:px-8">
      <header className="mb-8 rounded-2xl border border-white/60 bg-white/75 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Upgradeable Contracts Demo</p>
            <h1 className="text-3xl font-bold">Micro-Frontend RPC Contract Console</h1>
            <p className="mt-1 text-sm text-slate-600">
              Connect an RPC, pick a deployed contract address, resolve ABI, and interact with UUPS/Beacon flows.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            Import Foundry Broadcast
            <input
              type="file"
              accept="application/json"
              multiple
              className="hidden"
              onChange={(event) => importBroadcast(event.target.files)}
            />
          </label>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Cable className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold">Networks</h2>
          </div>

          <div className="space-y-2">
            {networks.map((network) => (
              <button
                key={network.id}
                onClick={() => setActiveNetworkId(network.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  network.id === activeNetworkId
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <p className="font-medium">{network.name}</p>
                <p className="truncate text-xs text-slate-500">{network.rpcUrl}</p>
                <p className="text-xs text-slate-500">
                  chainId: {network.chainId ?? '-'} | block: {network.blockNumber ?? '-'}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            <input
              value={newNetworkName}
              onChange={(event) => setNewNetworkName(event.target.value)}
              placeholder="Network name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newNetworkRpc}
              onChange={(event) => setNewNetworkRpc(event.target.value)}
              placeholder="https://rpc-url"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={addNetwork}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Add network
              </button>
              <button
                onClick={() => activeNetwork && handleRpcCheck(activeNetwork.id)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Check RPC
              </button>
            </div>
            <button
              onClick={removeActiveNetwork}
              disabled={!activeNetwork}
              className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove selected network
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-fuchsia-600" />
            <h2 className="font-semibold">Contracts</h2>
          </div>

          <select
            value={activeContractId}
            onChange={(event) => setActiveContractId(event.target.value)}
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select contract</option>
            {filteredContracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.name} ({contract.address.slice(0, 8)}...)
              </option>
            ))}
          </select>

          <button
            onClick={removeActiveContract}
            disabled={!activeContract}
            className="mb-4 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove selected contract
          </button>

          {activeContract && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                <span className="font-medium text-slate-800">Address:</span> {activeContract.address}
              </p>
              <p>
                <span className="font-medium text-slate-800">Proxy type:</span> {activeContract.proxyType}
              </p>
              <p>
                <span className="font-medium text-slate-800">ABI source:</span>{' '}
                {activeContract.abiMode === 'local'
                  ? `local:${activeContract.abiKey ?? 'unknown'}`
                  : 'pasted JSON'}
              </p>
              {activeContract.proxyType === 'uups' && (
                <p className="mt-1 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700">
                  UUPS note: interact with proxy address; implementation is internal/delegated.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <input
              value={newContractName}
              onChange={(event) => setNewContractName(event.target.value)}
              placeholder="Contract name"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={newContractAddress}
              onChange={(event) => setNewContractAddress(event.target.value)}
              placeholder="0x..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newContractProxyType}
                onChange={(event) => setNewContractProxyType(event.target.value as ProxyType)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="uups">UUPS</option>
                <option value="beacon">Beacon</option>
                <option value="direct">Direct</option>
              </select>
              <select
                value={newContractAbiMode}
                onChange={(event) => setNewContractAbiMode(event.target.value as 'local' | 'paste')}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="local">Local ABI</option>
                <option value="paste">Paste ABI JSON</option>
              </select>
            </div>

            <button
              onClick={refreshAbiListing}
              disabled={loadingAbiCatalog}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAbiCatalog ? 'Refreshing ABI list...' : 'Refresh ABI list'}
            </button>

            {newContractAbiMode === 'local' ? (
              <select
                value={newContractAbiKey}
                onChange={(event) => setNewContractAbiKey(event.target.value as AbiCatalogKey)}
                disabled={abiKeys.length === 0}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {abiKeys.length === 0 ? (
                  <option value="">No Foundry ABIs found (run forge build)</option>
                ) : (
                  abiKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <textarea
                value={newContractPastedAbi}
                onChange={(event) => setNewContractPastedAbi(event.target.value)}
                placeholder={'[ { "type": "function", ... } ]'}
                rows={4}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            )}

            <button
              onClick={addContract}
              className="rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white hover:bg-fuchsia-700"
            >
              Add contract
            </button>
          </div>
        </article>

      </section>

      {/* <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        <h2 className="mb-2 font-semibold">Deployment flow reference</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            UUPS in this repo: run <span className="font-mono">script/uups/Counter.s.sol</span>. It already deploys
            implementation + ERC1967Proxy in one flow; in the UI, use the proxy address.
          </li>
          <li>
            UUPS upgrade: run <span className="font-mono">script/uups/CounterV2.s.sol</span> with
            <span className="font-mono"> PROXY_ADDRESS</span> set.
          </li>
          <li>
            Beacon flow is different: implementation and proxies are separate scripts.
          </li>
        </ul>
      </section> */}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold">Contract Methods</h2>
          </div>

          {!activeContract || !activeAbi ? (
            <p className="text-sm text-slate-500">
              Select a contract with a valid ABI to render available methods.
            </p>
          ) : (
            <div className="space-y-4">
              <MethodSection
                title="Read (view/pure)"
                methods={groupedMethods.read}
                callInputs={callInputs}
                setCallInputs={setCallInputs}
                onRun={runMethod}
                runningCall={runningCall}
              />
              <MethodSection
                title="Write (nonpayable/payable)"
                methods={groupedMethods.write}
                callInputs={callInputs}
                setCallInputs={setCallInputs}
                onRun={runMethod}
                runningCall={runningCall}
              />
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Execution Log</h2>
            <button
              onClick={clearLogs}
              disabled={logLines.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear logs
            </button>
          </div>
          <div className="h-128 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-emerald-300">
            {logLines.length === 0 ? (
              <p className="text-slate-400">No activity yet.</p>
            ) : (
              logLines.map((line) => <p key={line}>{line}</p>)
            )}
          </div>
        </article>
      </section>
    </div>
  )
}

interface MethodSectionProps {
  title: string
  methods: AbiFunction[]
  callInputs: Record<string, string[]>
  setCallInputs: Dispatch<SetStateAction<Record<string, string[]>>>
  runningCall: string | null
  onRun: (method: AbiFunction) => Promise<void>
}

function MethodSection({ title, methods, callInputs, setCallInputs, runningCall, onRun }: MethodSectionProps) {
  if (methods.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-xs text-slate-500">No methods in this group.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {methods.map((fn) => {
        const key = signatureOf(fn)
        const values = callInputs[key] ?? []

        return (
          <div key={key} className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-800">{key}</p>
            <div className="mt-2 grid gap-2">
              {fn.inputs.map((input, index) => (
                <input
                  key={`${key}-${input.name}-${index}`}
                  value={values[index] ?? ''}
                  onChange={(event) =>
                    setCallInputs((prev) => {
                      const copy = [...(prev[key] ?? [])]
                      copy[index] = event.target.value
                      return { ...prev, [key]: copy }
                    })
                  }
                  placeholder={`${input.name || `arg${index}`} (${input.type})`}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ))}

              {fn.stateMutability === 'payable' && (
                <input
                  value={values[fn.inputs.length] ?? '0'}
                  onChange={(event) =>
                    setCallInputs((prev) => {
                      const copy = [...(prev[key] ?? [])]
                      copy[fn.inputs.length] = event.target.value
                      return { ...prev, [key]: copy }
                    })
                  }
                  placeholder="value in ETH"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}

              <button
                onClick={() => onRun(fn)}
                disabled={runningCall === key}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningCall === key ? 'Running...' : 'Execute'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default App
