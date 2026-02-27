import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import path from 'node:path'

interface FoundryArtifact {
  abi?: unknown
  metadata?: {
    settings?: {
      compilationTarget?: Record<string, string>
    }
  }
}

async function walkJsonFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'build-info') return []
        return walkJsonFiles(fullPath)
      }
      return fullPath.endsWith('.json') ? [fullPath] : []
    }),
  )

  return files.flat()
}

async function readFoundryAbiCatalog(foundryOutDir: string) {
  const catalog: Record<string, unknown> = {}

  let files: string[] = []
  try {
    files = await walkJsonFiles(foundryOutDir)
  } catch {
    return catalog
  }

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      const artifact = JSON.parse(raw) as FoundryArtifact
      if (!Array.isArray(artifact.abi)) continue

      const compilationTarget = artifact.metadata?.settings?.compilationTarget
      if (!compilationTarget) continue

      const firstTarget = Object.entries(compilationTarget)[0]
      if (!firstTarget) continue

      const [sourcePath, contractName] = firstTarget
      if (!sourcePath.startsWith('src/')) continue

      catalog[contractName] = artifact.abi
    } catch {
      continue
    }
  }

  return catalog
}

function foundryAbiApiPlugin(): Plugin {
  return {
    name: 'foundry-abi-api',
    configureServer(server) {
      server.middlewares.use('/__foundry/abis', async (_req, res) => {
        const foundryOutDir = path.resolve(server.config.root, '../foundry/out')
        const catalog = await readFoundryAbiCatalog(foundryOutDir)

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ catalog }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), foundryAbiApiPlugin()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
