# Upgradeable Contracts Micro-Frontend

React + Vite + Tailwind app to interact with contracts deployed from the Foundry project.

## Features

- Add and persist RPC networks.
- Check node health (`chainId` + latest block).
- Add contracts by address and map to ABI source.
- Resolve ABI from Foundry-built artifacts (`../foundry/out`) or pasted JSON.
- Auto-render contract methods from ABI.
- Run read calls via public RPC.
- Run write calls via injected wallet (MetaMask/Rabby).
- Import Foundry `run-latest.json` broadcast files to prefill addresses.
- Import logic prefers proxy/beacon contracts for immediate interaction.

## Run

```bash
cd frontend
npm install
npm run dev
```

## How to use in this repository

1. Start your local chain/Besu.
2. Deploy contracts with Foundry scripts.
  - Run `forge build` at least once so `foundry/out` artifacts are up to date.
3. In the frontend:
   - configure your RPC URL,
   - import broadcast JSONs from `foundry/broadcast/.../run-latest.json`,
   - select a contract,
  - execute read/write methods.

## Deployment logic used by this project

- UUPS deploy (`script/uups/Counter.s.sol`) already handles implementation + proxy creation in one script.
- For interaction, use the deployed proxy address with `Counter` ABI (and after upgrade, `CounterV2` ABI for new methods).
- Beacon deploy flow is separate and can deploy implementation and proxies in distinct steps.

## Notes

- RPC nodes do not generally expose ABI metadata; ABI must come from artifacts, pasted JSON, or explorer APIs.
- In Local ABI mode, the dropdown uses only contracts discovered from Foundry `out` artifacts.
- For write methods, your wallet must be connected to the same chain as the configured RPC.
