const fs = require('node:fs/promises');
const path = require('node:path');
const API = 'https://anticheat.imjules.be/api';
const DISCORD = 'https://discord.com/api/v10';
const stateFile = path.join(process.cwd(), '.github', 'monitor-state.json');
const token = process.env.DISCORD_BOT_TOKEN;
const userId = process.env.DISCORD_USER_ID;

if (!token || !/^\d{15,22}$/.test(userId || '')) {
  throw new Error('Set valid DISCORD_BOT_TOKEN and DISCORD_USER_ID repository secrets.');
}

async function getJson(url, label) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(label + ' returned HTTP ' + res.status);
  return res.json();
}

async function discord(endpoint, body) {
  const res = await fetch(DISCORD + endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Discord API HTTP ' + res.status + ': ' + (data.message || 'request failed'));
  return data;
}

async function readState() {
  try {
    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('invalid state format');
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function main() {
  const results = await Promise.all([
    getJson(API + '/alerts', 'Alerts API'),
    getJson(API + '/outages', 'Outages API'),
  ]);
  const alerts = results[0].alerts;
  const outages = results[1].active;
  if (!Array.isArray(alerts) || !Array.isArray(outages)) throw new Error('Unexpected monitor API response; state not changed.');

  const active = {};
  for (const item of alerts) {
    const id = item.goliath == null ? item.name : item.goliath;
    if (id == null) continue;
    active['alert:' + id] = 'Anti-cheat confirmed down: ' + (item.name || 'Goliath ' + id) + ' (' + (item.region || 'unknown region') + ').';
  }
  for (const item of outages) {
    const id = item.shard == null ? (item.region || 'unknown') + ':' + (item.coords || '') : item.shard;
    active['outage:' + id] = 'Region outage active: Shard ' + (item.shard == null ? 'unknown' : item.shard) + ' (' + (item.region || 'unknown region') + ').';
  }

  const previous = await readState();
  const started = Object.entries(active).filter(([key]) => typeof previous[key] !== 'string');
  const recovered = Object.entries(previous).filter(([key, text]) => typeof text === 'string' && !active[key]);
  if (started.length || recovered.length) {
    const dm = await discord('/users/@me/channels', { recipient_id: userId });
    for (const [, text] of started) await discord('/channels/' + dm.id + '/messages', { content: '🚨 DonutSMP monitor\n' + text, allowed_mentions: { parse: [] } });
    for (const [, text] of recovered) await discord('/channels/' + dm.id + '/messages', { content: '✅ DonutSMP incident recovered\n' + text, allowed_mentions: { parse: [] } });
    console.log('Sent ' + started.length + ' alert(s), ' + recovered.length + ' recovery notice(s).');
  } else {
    console.log('No new or resolved incidents.');
  }

  const sort = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  if (JSON.stringify(sort(active)) !== JSON.stringify(sort(previous))) {
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, JSON.stringify(sort(active), null, 2) + '\n', 'utf8');
    console.log('Incident state updated.');
  }
}

main().catch((error) => { console.error('Monitor run failed: ' + error.message); process.exitCode = 1; });
