/**
 * Poi renderer bridge — maps Poi Redux / window state into SnapshotStore.
 * Loaded only inside Poi (Electron renderer with nodeIntegration).
 *
 * Store paths (verified against Poi app.asar):
 *   info.ships, info.equips, info.deck, info.basic
 *   info.resources  → number[]  (lodash.map(api_material, 'api_value'); [0]=fuel)
 *   info.useitems   → object keyed by item id
 *   info.repair, info.construction, info.quests
 * NOTE: info.material does NOT exist.
 */
/* eslint-disable no-undef */

function pick(obj, key, fallback = null) {
  if (obj == null || typeof obj !== 'object') return fallback
  return key in obj ? obj[key] : fallback
}

function damageFromHp(hp, maxHp) {
  if (!maxHp || maxHp <= 0) return 'unknown'
  const ratio = hp / maxHp
  if (ratio > 0.75) return 'healthy'
  if (ratio > 0.5) return 'shouha'
  if (ratio > 0.25) return 'chuha'
  return 'taiha'
}

function getPoiStore() {
  try {
    if (typeof window !== 'undefined' && typeof window.getStore === 'function') {
      return window.getStore() || {}
    }
  } catch (e) {
    /* store not ready */
  }
  return {}
}

/** Read ships from Poi info.ships (object keyed by instance id). */
function readShips(store) {
  const ships = store?.info?.ships || {}
  const constShips = store?.const?.$ships || {}
  return Object.values(ships).map((s) => {
    const master = constShips[s.api_ship_id] || {}
    const maxHp = s.api_maxhp ?? s.api_max_hp ?? s.api_nowhp ?? 1
    const hp = s.api_nowhp ?? maxHp
    return {
      instance_id: s.api_id,
      master_id: s.api_ship_id,
      master_ref: `ship:${s.api_ship_id}`,
      name: master.api_name || `ship:${s.api_ship_id}`,
      level: s.api_lv ?? 0,
      exp: Array.isArray(s.api_exp) ? s.api_exp[0] : s.api_exp ?? 0,
      hp,
      max_hp: maxHp,
      condition: s.api_cond ?? 49,
      locked: Boolean(s.api_locked),
      damage: damageFromHp(hp, maxHp),
      stype: undefined,
      fleet_id: s.api_fleet != null && s.api_fleet >= 0 ? s.api_fleet + 1 : null,
      dock: false,
      slot_items: (s.api_slot || []).map((id) => (id > 0 ? id : null)),
    }
  })
}

function readEquipment(store) {
  const equips = store?.info?.equips || {}
  const constEquips = store?.const?.$equips || {}
  const equippedOn = new Map()
  const ships = store?.info?.ships || {}
  for (const s of Object.values(ships)) {
    for (const slotId of s.api_slot || []) {
      if (slotId > 0) equippedOn.set(slotId, s.api_id)
    }
  }
  return Object.values(equips).map((e) => {
    const master = constEquips[e.api_slotitem_id] || {}
    return {
      instance_id: e.api_id,
      master_id: e.api_slotitem_id,
      master_ref: `equipment:${e.api_slotitem_id}`,
      name: master.api_name || `equipment:${e.api_slotitem_id}`,
      improvement: e.api_level ?? 0,
      proficiency: e.api_alv ?? 0,
      locked: Boolean(e.api_locked),
      equipped_on: equippedOn.get(e.api_id) ?? null,
      category: undefined,
    }
  })
}

function readFleets(store) {
  const decks = store?.info?.deck || []
  const ships = store?.info?.ships || {}
  const constShips = store?.const?.$ships || {}
  return decks.map((d) => ({
    id: d.api_id,
    name: d.api_name || `Fleet ${d.api_id}`,
    members: (d.api_ship || [])
      .filter((id) => id > 0)
      .map((id) => {
        const s = ships[id]
        if (!s) return { instance_id: id, master_id: 0, name: '?', level: 0, damage: 'unknown' }
        const master = constShips[s.api_ship_id] || {}
        const maxHp = s.api_maxhp ?? s.api_max_hp ?? s.api_nowhp ?? 1
        const hp = s.api_nowhp ?? maxHp
        return {
          instance_id: id,
          master_id: s.api_ship_id,
          name: master.api_name || `ship:${s.api_ship_id}`,
          level: s.api_lv ?? 0,
          damage: damageFromHp(hp, maxHp),
        }
      }),
    expedition_id: d.api_mission && d.api_mission[0] > 0 ? d.api_mission[0] : null,
    mission_complete_at:
      d.api_mission && d.api_mission[2] > 0 ? new Date(d.api_mission[2]).toISOString() : null,
    is_combined: false,
    combined_role: null,
  }))
}

/**
 * Poi: info.resources is number[] from lodash.map(api_material, 'api_value').
 * index 0 = api_id 1 (fuel). Return null when not loaded (do NOT invent zeros).
 */
function readResources(store) {
  const basic = store?.info?.basic || {}
  const arr = store?.info?.resources

  let values = null
  if (Array.isArray(arr) && arr.length > 0) {
    if (typeof arr[0] === 'number') {
      values = arr
    } else if (arr[0] && typeof arr[0] === 'object') {
      values = []
      for (const m of arr) {
        if (m && m.api_id != null) values[m.api_id - 1] = m.api_value ?? 0
      }
    }
  }

  if (!values || values.length === 0) {
    return null
  }

  const at = (id) => {
    const v = values[id - 1]
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
  }

  // KCSAPI / Poi 0-based indices (verified in Poi resources reducer):
  // [0]fuel [1]ammo [2]steel [3]bauxite
  // [4]高速建造 instant  [5]高速修复 bucket  [6]开发资材  [7]改修资材
  return {
    fuel: at(1),
    ammo: at(2),
    steel: at(3),
    bauxite: at(4),
    instant_construction: at(5),
    bucket: at(6),
    development_material: at(7),
    improvement_material: at(8),
    max_fuel: basic.api_max_material,
    max_ammo: basic.api_max_material,
    max_steel: basic.api_max_material,
    max_bauxite: basic.api_max_material,
    _raw: values.slice(0, 8),
  }
}

function readUseItems(store) {
  const raw = store?.info?.useitems
  if (!raw || typeof raw !== 'object') return null
  const list = Object.values(raw)
    .filter((it) => it && typeof it === 'object')
    .map((it) => ({
      master_id: it.api_id ?? it.api_useitem_id ?? 0,
      name: it.api_name || `item:${it.api_id ?? it.api_useitem_id ?? '?'}`,
      count: typeof it.api_count === 'number' ? it.api_count : 0,
    }))
    .filter((it) => it.master_id)
  return list.length > 0 ? list : null
}

function readProfile(store) {
  const basic = store?.info?.basic || {}
  if (!basic || !Object.keys(basic).length) return null
  return {
    name: basic.api_nickname || basic.api_name || 'Admiral',
    level: basic.api_level ?? 0,
    rank: String(basic.api_rank ?? ''),
    ship_slots: basic.api_max_chara,
    equipment_slots: basic.api_max_slotitem,
  }
}

function readQuests(store) {
  const quests = store?.info?.quests || []
  const list = Array.isArray(quests) ? quests : []
  return list
    .filter((q) => q && q.api_no)
    .map((q) => ({
      game_id: q.api_no,
      name: q.api_title || `quest:${q.api_no}`,
      type: q.api_type != null ? String(q.api_type) : undefined,
      state: q.api_state === 3 ? 'observed_completed' : q.api_state === 2 ? 'active' : 'unknown',
      progress: q.api_progress_flag != null ? q.api_progress_flag / 2 : null,
      source: 'api',
    }))
}

function readInventory(store) {
  const res = readResources(store)
  const useitems = readUseItems(store)
  return {
    materials: res
      ? {
          fuel: res.fuel,
          ammo: res.ammo,
          steel: res.steel,
          bauxite: res.bauxite,
          bucket: res.bucket,
          instant_construction: res.instant_construction,
          development_material: res.development_material,
          improvement_material: res.improvement_material,
        }
      : null,
    materials_coverage: res ? 'complete' : 'not_loaded',
    useitems,
    useitems_coverage: useitems ? 'complete' : 'not_loaded',
  }
}

function readRepairs(store) {
  const docks = store?.info?.repair || []
  return docks.map((d) => ({
    id: d.api_id,
    ship_instance_id: d.api_ship_id > 0 ? d.api_ship_id : null,
    complete_at: d.api_complete_time > 0 ? new Date(d.api_complete_time).toISOString() : null,
    bucket_used: false,
  }))
}

function readConstructions(store) {
  const docks = store?.info?.construction || []
  return docks.map((d) => ({
    id: d.api_id,
    complete_at: d.api_complete_time > 0 ? new Date(d.api_complete_time).toISOString() : null,
    is_open: d.api_state === 1 || d.api_state === 2,
  }))
}

function readSortie(store) {
  const sortie = store?.sortie || {}
  const mapId = pick(sortie, 'mapId') ?? pick(sortie, 'map')
  const area = pick(sortie, 'area')
  const mapNo = pick(sortie, 'map')
  if (area != null && mapNo != null) {
    return { active: true, map_ref: `map:${area}-${mapNo}`, fleet_ids: [], node: null }
  }
  if (mapId != null) {
    return { active: true, map_ref: String(mapId), fleet_ids: [], node: null }
  }
  return { active: false, map_ref: null, fleet_ids: [], node: null }
}

/** Full sync from current Poi store into SnapshotStore. */
function syncFromPoi(snapshotStore, poiState) {
  const store = poiState || getPoiStore()
  const loggedIn = Boolean(
    store?.info?.basic?.api_nickname || store?.info?.basic?.api_level || store?.info?.ships,
  )
  snapshotStore.setOnline(true, loggedIn)
  snapshotStore.setProfile(readProfile(store))
  snapshotStore.setResources(readResources(store))
  snapshotStore.setShips(readShips(store))
  snapshotStore.setEquipment(readEquipment(store))
  snapshotStore.setFleets(readFleets(store))
  snapshotStore.setQuests(readQuests(store))
  snapshotStore.setInventory(readInventory(store))
  snapshotStore.setRepairs(readRepairs(store))
  snapshotStore.setConstructions(readConstructions(store))
  snapshotStore.setSortie(readSortie(store))
}

module.exports = {
  syncFromPoi,
  getPoiStore,
  damageFromHp,
  readShips,
  readEquipment,
  readFleets,
  readResources,
  readUseItems,
  readProfile,
  readQuests,
  readInventory,
  readRepairs,
  readConstructions,
  readSortie,
}
