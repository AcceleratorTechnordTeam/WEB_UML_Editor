// Parser pour un sous-ensemble de la syntaxe PlantUML (diagrammes de séquence).

const PARTICIPANT_TYPES = [
  'actor', 'participant', 'database', 'entity', 'boundary', 'control', 'collections', 'queue',
];
const FRAGMENT_KINDS = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group'];

const ID = String.raw`(?:[\w.]+|"[^"]+")`;
const ARROW = String.raw`(<{1,2}-{1,2}|-{1,2}>{1,2}x?|-{1,2}x|-{1,2}\\{1,2}|-{1,2}\/{1,2})`;
const MSG_RE = new RegExp(String.raw`^(&\s*)?(${ID})\s*${ARROW}\s*(${ID})\s*(?::\s*(.*))?$`);
const PART_RE = new RegExp(
  String.raw`^(${PARTICIPANT_TYPES.join('|')})\s+(?:"([^"]+)"\s+as\s+([\w.]+)|([\w.]+)\s+as\s+"([^"]+)"|"([^"]+)"|([\w.]+))\s*(#[\w]+)?\s*(?:order\s+\d+)?\s*$`,
  'i',
);

const unquote = (s) => (s && s.startsWith('"') ? s.slice(1, -1) : s);

/** Normalise une couleur PlantUML (#ABC, #AABBCC, #Gold) en couleur CSS. */
export function color(c) {
  if (!c) return null;
  const v = c.replace(/^#/, '');
  return /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v) ? `#${v}` : v.toLowerCase();
}

export function parse(src) {
  const lines = src.split(/\r?\n/);
  const d = {
    participants: [],
    boxes: [],
    events: [],
    skin: {},
    title: null,
    warnings: [],
  };
  const pmap = new Map();
  let box = null;
  const frags = [];
  let fragId = 0;
  let note = null;
  let skinBlock = false;
  let started = false;
  const history = []; // messages "aller" pour return

  const ensure = (id, type = 'participant', label = null, col = null) => {
    if (pmap.has(id)) {
      const p = pmap.get(id);
      if (label != null) p.label = label;
      if (type) p.type = type;
      if (col) p.color = col;
      return p;
    }
    const p = { id, type, label: label ?? id, color: col, box: box ? box.index : null };
    pmap.set(id, p);
    d.participants.push(p);
    if (box) box.members.push(id);
    return p;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    const line = raw.trim();

    // Bloc de note multi-ligne
    if (note) {
      if (/^end\s*note$/i.test(line)) {
        note.text = note.buf.join('\\n');
        delete note.buf;
        d.events.push(note);
        note = null;
      } else {
        note.buf.push(raw.trim());
      }
      continue;
    }
    if (skinBlock) {
      if (line === '}') skinBlock = false;
      continue;
    }

    if (!line || line.startsWith("'")) continue;
    if (/^@startuml/i.test(line)) { started = true; continue; }
    if (/^@enduml/i.test(line)) break;
    if (/^(hide|show|autonumber|autoactivate|activate|deactivate|destroy|create|newpage|header|footer|left to right)\b/i.test(line)) continue;

    let m;

    if ((m = line.match(/^skinparam\s+([\w.]+)\s*\{$/i))) { skinBlock = true; continue; }
    if ((m = line.match(/^skinparam\s+([\w.]+)\s+(.+)$/i))) {
      d.skin[m[1].toLowerCase()] = m[2].trim();
      continue;
    }
    if ((m = line.match(/^title\s+(.+)$/i))) { d.title = m[1]; continue; }

    if ((m = line.match(/^box(?:\s+"([^"]*)")?\s*(#[\w]+)?\s*(?:"([^"]*)")?\s*$/i))) {
      box = { index: d.boxes.length, title: m[1] ?? m[3] ?? '', color: color(m[2]), members: [], line: lineNo };
      d.boxes.push(box);
      continue;
    }
    if (/^end\s*box$/i.test(line)) { box = null; continue; }

    if ((m = line.match(PART_RE))) {
      const type = m[1].toLowerCase();
      const id = m[3] ?? m[4] ?? m[6] ?? m[7];
      const label = m[2] ?? m[5] ?? m[6] ?? m[7];
      ensure(id, type, label, color(m[8]));
      continue;
    }

    // Notes
    if ((m = line.match(/^(?:(h|r)note|note)\s+(left|right|over)(?:\s+of)?\s*([\w.",\s]*?)\s*(#[\w]+)?\s*(?::\s*(.*))?$/i))) {
      const pos = m[2].toLowerCase();
      const targets = m[3] ? m[3].split(',').map((s) => unquote(s.trim())).filter(Boolean) : [];
      targets.forEach((t) => ensure(t, null));
      const ev = { type: 'note', pos, targets, color: color(m[4]), line: lineNo, shape: m[1] ? m[1].toLowerCase() : null };
      if (m[5] !== undefined) {
        ev.text = m[5];
        d.events.push(ev);
      } else {
        ev.buf = [];
        note = ev;
      }
      continue;
    }

    if ((m = line.match(/^==+\s*(.*?)\s*==+$/))) { d.events.push({ type: 'divider', text: m[1], line: lineNo }); continue; }
    if ((m = line.match(/^\.\.\.\s*(.*?)\s*(?:\.\.\.)?$/))) { d.events.push({ type: 'delay', text: m[1], line: lineNo }); continue; }
    if ((m = line.match(/^\|\|(\d*)\|\|$/))) { d.events.push({ type: 'space', size: Number(m[1]) || 16, line: lineNo }); continue; }

    // Fragments
    if ((m = line.match(new RegExp(String.raw`^(${FRAGMENT_KINDS.join('|')})(?:#[\w]+)?\b\s*(#[\w]+)?\s*(.*)$`, 'i')))) {
      const f = { id: fragId++, kind: m[1].toLowerCase(), line: lineNo };
      frags.push(f);
      d.events.push({ type: 'fragStart', id: f.id, kind: f.kind, color: color(m[2]), label: m[3] || '', line: lineNo });
      continue;
    }
    if ((m = line.match(/^else\b\s*(#[\w]+)?\s*(.*)$/i))) {
      const f = frags[frags.length - 1];
      if (!f) { d.warnings.push({ line: lineNo, msg: '"else" sans "alt" ouvert' }); continue; }
      d.events.push({ type: 'fragElse', id: f.id, color: color(m[1]), label: m[2] || '', line: lineNo });
      continue;
    }
    if (/^end$/i.test(line)) {
      const f = frags.pop();
      if (!f) { d.warnings.push({ line: lineNo, msg: '"end" sans bloc ouvert' }); continue; }
      d.events.push({ type: 'fragEnd', id: f.id, line: lineNo });
      continue;
    }

    if ((m = line.match(/^return\b\s*(.*)$/i))) {
      const call = history.pop();
      if (!call) { d.warnings.push({ line: lineNo, msg: '"return" sans message à qui répondre' }); continue; }
      d.events.push({ type: 'msg', from: call.to, to: call.from, label: m[1] || '', dashed: true, open: false, line: lineNo, isReturn: true });
      continue;
    }

    if ((m = line.match(MSG_RE))) {
      let from = unquote(m[2]);
      let to = unquote(m[4]);
      let arrow = m[3];
      const reversed = arrow.startsWith('<');
      if (reversed) [from, to] = [to, from];
      ensure(from, null);
      ensure(to, null);
      const dashed = arrow.includes('--');
      const ev = {
        type: 'msg',
        from,
        to,
        label: m[5] ?? '',
        dashed,
        open: />>|<</.test(arrow) || /[\\/]/.test(arrow),
        lost: arrow.endsWith('x'),
        parallel: !!m[1],
        line: lineNo,
      };
      d.events.push(ev);
      history.push(ev);
      continue;
    }

    d.warnings.push({ line: lineNo, msg: `Ligne non comprise : ${line.slice(0, 60)}` });
  }

  if (note) d.warnings.push({ line: note.line, msg: 'Note non fermée ("end note" manquant)' });
  for (const f of frags) {
    d.warnings.push({ line: f.line, msg: `Bloc "${f.kind}" non fermé ("end" manquant)` });
    d.events.push({ type: 'fragEnd', id: f.id, line: f.line });
  }
  if (!started && src.trim()) d.warnings.push({ line: 1, msg: '@startuml manquant (toléré)' });
  for (const p of d.participants) if (!p.type) p.type = 'participant';

  return d;
}

/** Découpe un texte PlantUML en lignes de segments {text,bold,italic,code}. */
export function richText(text) {
  const out = [];
  for (const rawLine of String(text ?? '').split(/\\n|\n/)) {
    const segs = [];
    let bold = false;
    let italic = false;
    const parts = rawLine.split(/(\*\*|\/\/)/);
    for (const part of parts) {
      if (part === '**') { bold = !bold; continue; }
      if (part === '//') { italic = !italic; continue; }
      if (part) segs.push({ text: part, bold, italic });
    }
    out.push(segs);
  }
  return out;
}
