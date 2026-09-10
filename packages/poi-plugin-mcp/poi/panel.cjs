/**
 * Minimal status panel for Poi (no JSX — React.createElement only).
 */
const React = require('react')
const path = require('path')
const fs = require('fs')

function readToken() {
  try {
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
      shipCount: null,
      equipCount: null,
      resources: null,
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
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        method: 'GET',
      })
      if (res.status !== 200) {
        this.setState({ online: false, error: `HTTP ${res.status}` })
        return
      }
      const data = await res.json()
      this.setState({
        online: Boolean(data.ok),
        error: null,
        snapshotVersion: data.snapshot_version ?? null,
        playerLoggedIn: Boolean(data.player_logged_in),
        shipCount: data.ships ?? null,
        equipCount: data.equipment ?? null,
        resources: data.resources ?? null,
      })
    } catch (e) {
      this.setState({
        online: false,
        error: String(e && e.message ? e.message : e),
      })
    }
  }

  render() {
    const { online, port, snapshotVersion, playerLoggedIn, shipCount, equipCount, resources, error } =
      this.state
    const row = (k, v) =>
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0',
            borderBottom: '1px solid rgba(128,128,128,0.2)',
          },
        },
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
      row('服务状态', online ? '在线' : '离线'),
      row('端点', `http://127.0.0.1:${port}/mcp`),
      row('健康检查', `http://127.0.0.1:${port}/health`),
      row('Token', maskToken(readToken())),
      row('玩家登录', playerLoggedIn ? '是' : '否 / 未进母港'),
      row('舰娘数', shipCount == null ? '—' : String(shipCount)),
      row('装备数', equipCount == null ? '—' : String(equipCount)),
      row(
        '四资 油/弹/钢/铝',
        resources
          ? `${resources.fuel}/${resources.ammo}/${resources.steel}/${resources.bauxite}`
          : '未加载',
      ),
      row(
        '桶/开发/改修',
        resources
          ? `${resources.bucket}/${resources.development_material}/${resources.improvement_material}`
          : '未加载',
      ),
      row('Snapshot 版本', snapshotVersion == null ? '—' : String(snapshotVersion)),
      error ? row('错误', error) : null,
      React.createElement(
        'p',
        { style: { marginTop: 16, opacity: 0.7, fontSize: 12 } },
        '服务在线但玩家未登录时，舰娘/装备可能为 0——这不等于 MCP 故障。登录母港后自动同步。',
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
