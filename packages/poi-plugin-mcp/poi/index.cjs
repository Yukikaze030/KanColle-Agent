/**
 * Poi plugin entry (CommonJS). Bundled core lives in dist/poi-bundle.cjs.
 */
const path = require('path')
const fs = require('fs')
const { syncFromPoi } = require('./store-bridge.cjs')

const PLUGIN_NAME = 'poi-plugin-kancolle-mcp'
const DEFAULT_PORT = 39271

let bundle = null
let runtime = null
let started = false
let onGameResponse = null
let syncTimer = null

function tokenPath() {
  return path.join(__dirname, 'token.json')
}

function loadBundle() {
  if (bundle) return bundle
  const abs = path.join(__dirname, '..', 'dist', 'poi-bundle.cjs')
  if (!fs.existsSync(abs)) {
    throw new Error(
      `${PLUGIN_NAME}: missing ${abs}. Build with: npm run build -w poi-plugin-kancolle-mcp`,
    )
  }
  // clear cache so reload works
  delete require.cache[require.resolve(abs)]
  bundle = require(abs)
  return bundle
}

async function startServer() {
  if (started) return runtime
  const mod = loadBundle()
  const createPoiRuntime = mod.createPoiRuntime || mod.default?.createPoiRuntime
  if (typeof createPoiRuntime !== 'function') {
    throw new Error(`${PLUGIN_NAME}: createPoiRuntime not exported from bundle`)
  }
  let port = DEFAULT_PORT
  try {
    if (typeof window !== 'undefined' && window.config?.get) {
      port = Number(window.config.get('plugin.KanColleMcp.port')) || DEFAULT_PORT
    }
  } catch (e) {
    /* ignore */
  }
  if (process.env.POI_MCP_PORT) port = Number(process.env.POI_MCP_PORT) || DEFAULT_PORT

  runtime = createPoiRuntime(tokenPath())
  await runtime.start({ port, useMock: false })
  started = true
  const listenPort = runtime.http?.port ?? port
  console.log(`${PLUGIN_NAME}: MCP listening http://127.0.0.1:${listenPort}/mcp`)
  try {
    const tok = fs.existsSync(tokenPath())
      ? JSON.parse(fs.readFileSync(tokenPath(), 'utf8')).token
      : runtime.token
    if (tok) {
      fs.writeFileSync(
        path.join(__dirname, 'README-TOKEN.txt'),
        `Set KANCOLLE_POI_MCP_TOKEN=${tok}\n`,
        'utf8',
      )
    }
  } catch (e) {
    /* ignore */
  }
  return runtime
}

function stopServer() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
  if (onGameResponse && typeof window !== 'undefined') {
    window.removeEventListener('game.response', onGameResponse)
    onGameResponse = null
  }
  if (runtime && typeof runtime.stop === 'function') {
    try {
      runtime.stop()
    } catch (e) {
      console.error(`${PLUGIN_NAME}: stop error`, e)
    }
  }
  runtime = null
  started = false
  bundle = null
}

function handleGameResponse(e) {
  if (!runtime) return
  const detail = (e && e.detail) || e || {}
  const p = detail.path || ''
  try {
    syncFromPoi(runtime.store)
    if (typeof runtime.handleApiEvent === 'function') {
      runtime.handleApiEvent(p, detail.body)
    }
  } catch (err) {
    console.error(`${PLUGIN_NAME}: game.response handler error`, err)
  }
}

async function pluginDidLoad() {
  try {
    await startServer()
  } catch (e) {
    console.error(`${PLUGIN_NAME}: failed to start MCP`, e)
    return
  }
  onGameResponse = handleGameResponse
  if (typeof window !== 'undefined') {
    window.addEventListener('game.response', onGameResponse)
  }
  syncTimer = setInterval(() => {
    if (!runtime) return
    try {
      syncFromPoi(runtime.store)
    } catch (e) {
      /* ignore */
    }
  }, 15000)
  try {
    syncFromPoi(runtime.store)
  } catch (e) {
    /* empty until login */
  }
}

function pluginWillUnload() {
  stopServer()
}

const { KanColleMcpPanel } = require('./panel.cjs')

module.exports = {
  pluginDidLoad,
  pluginWillUnload,
  name: PLUGIN_NAME,
  reactClass: KanColleMcpPanel,
}
