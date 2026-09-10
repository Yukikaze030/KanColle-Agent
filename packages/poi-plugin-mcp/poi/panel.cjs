/**
 * Minimal status panel for Poi (no JSX — React.createElement only).
 */
const React = require('react')

function readToken() {
  try {
    const fs = require('fs')
    const path = require('path')
    const p = path.join(__dirname, 'token.json')
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8')).token || ''
    }
  } catch (e) {
    /* ignore */
  }
  return ''
}

function maskToken(t) {
  if (!t || t.length < 12) return '(not generated)'
  return t.slice(0, 6) + '…' + t.slice(-6)
}

class KanColleMcpPanel extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      online: false,
      port: 39271,
      snapshotVersion: null,
      playerLoggedIn: false,
      shipCount: 0,
      equipCount: 0,
      error: null,
    }
    this.timer = null
  }

  componentDidMount() {
    this.refresh()
    this.timer = setInterval(() => this.refresh(), 3000)
  }

  componentWillUnmount() {
    if (this.timer) clearInterval(this.timer)
  }

  async refresh() {
    const port = this.state.port
    try {
      // Lightweight HTTP GET /health is not implemented; probe MCP with OPTIONS-like POST without auth first
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${readToken()}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'poi-panel', version: '1.0.0' },
          },
        }),
      })
      const online = res.status === 200
      this.setState({ online, error: online ? null : `HTTP ${res.status}` })

      if (!online) return

      // tools/list as a cheap liveness check; then try poi_status via tools/call
      const call = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${readToken()}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'poi_status', arguments: {} },
        }),
      })
      const text = await call.text()
      // SSE or JSON
      let payload = text
      if (text.includes('data: ')) {
        const line = text
          .split('\n')
          .find((l) => l.startsWith('data: '))
        payload = line ? line.slice(6) : text
      }
      try {
        const json = JSON.parse(payload)
        const content = json?.result?.content?.[0]?.text
        if (content) {
          const data = JSON.parse(content)
          const snap = data?.data || data
          this.setState({
            snapshotVersion: snap?.snapshot_version ?? data?.snapshot?.version ?? null,
            playerLoggedIn: Boolean(snap?.player_logged_in ?? data?.data?.player_logged_in),
          })
        }
      } catch (e) {
        /* parse optional */
      }
    } catch (e) {
      this.setState({ online: false, error: String(e && e.message ? e.message : e) })
    }
  }

  render() {
    const { online, port, snapshotVersion, playerLoggedIn, error } = this.state
    const row = (k, v) =>
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(128,128,128,0.2)' } },
        React.createElement('span', { style: { opacity: 0.75 } }, k),
        React.createElement('span', null, v),
      )
    return React.createElement(
      'div',
      { style: { padding: 16, maxWidth: 520 } },
      React.createElement('h3', { style: { marginTop: 0 } }, 'KanColle MCP'),
      React.createElement(
        'p',
        { style: { opacity: 0.8, marginBottom: 12 } },
        '只读玩家 Snapshot，供 KanColle Agent / OpenCode 调用。无自动操作。',
      ),
      row('状态', online ? '在线' : '离线'),
      row('端点', `http://127.0.0.1:${port}/mcp`),
      row('Token', maskToken(readToken())),
      row('玩家登录', playerLoggedIn ? '是' : '否 / 未确认'),
      row('Snapshot 版本', snapshotVersion == null ? '—' : String(snapshotVersion)),
      error ? row('错误', error) : null,
      React.createElement(
        'p',
        { style: { marginTop: 16, opacity: 0.7, fontSize: 12 } },
        '完整 Token：插件目录 poi/token.json；已写入环境变量 KANCOLLE_POI_MCP_TOKEN。',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => this.refresh(),
          style: { marginTop: 8, padding: '6px 12px', cursor: 'pointer' },
        },
        '刷新状态',
      ),
    )
  }
}

module.exports = { KanColleMcpPanel }
