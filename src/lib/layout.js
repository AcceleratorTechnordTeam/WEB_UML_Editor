// Calcul de la géométrie d'un diagramme de séquence parsé.
import { richText } from './parser.js';

let ctx = null;
function getCtx() {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  return ctx;
}

export function makeMeasure(font) {
  const cache = new Map();
  return (text, { bold = false, italic = false, size = font.size, family = font.family } = {}) => {
    const key = `${bold}|${italic}|${size}|${family}|${text}`;
    if (cache.has(key)) return cache.get(key);
    const c = getCtx();
    c.font = `${italic ? 'italic ' : ''}${bold ? font.boldWeight : 400} ${size}px ${family}`;
    const w = c.measureText(text).width;
    cache.set(key, w);
    return w;
  };
}

/** Mesure un bloc de texte riche : { lines, width, height } */
function block(text, measure, font, opts = {}) {
  const lines = richText(text);
  const size = opts.size ?? font.size;
  let width = 0;
  for (const segs of lines) {
    let w = 0;
    for (const s of segs) w += measure(s.text, { bold: s.bold || opts.bold, italic: s.italic, size, family: opts.family });
    width = Math.max(width, w);
  }
  const lh = Math.round(size * 1.35);
  const empty = lines.length === 1 && lines[0].length === 0;
  return { lines, width, height: empty ? 0 : lines.length * lh, lh, size, bold: !!opts.bold };
}

const M = {
  margin: 24,
  gap: 28,
  boxPad: 14,
  boxGap: 12,
  boxTitle: 26,
  selfW: 34,
  selfH: 16,
  fragPad: 12,
  fragHeader: 22,
  notePad: 8,
};

export function layout(d, font) {
  const measure = makeMeasure(font);
  const parts = d.participants;
  const idx = new Map(parts.map((p, i) => [p.id, i]));
  const N = parts.length;

  // --- Têtes de participants
  const heads = parts.map((p) => {
    const t = block(p.label, measure, font, { family: font.headFamily });
    let w;
    let h;
    if (p.type === 'actor') {
      w = Math.max(40, t.width + 8);
      h = 46 + t.height + 6;
    } else if (p.type === 'database' || p.type === 'collections' || p.type === 'queue') {
      w = Math.max(60, t.width + 28);
      h = t.height + 30;
    } else if (p.type === 'boundary' || p.type === 'control' || p.type === 'entity') {
      w = Math.max(50, t.width + 8);
      h = 34 + t.height + 6;
    } else {
      w = Math.max(56, t.width + 24);
      h = t.height + 18;
    }
    return { text: t, w, h };
  });
  const headH = Math.max(40, ...heads.map((h) => h.h));

  // --- Positions horizontales initiales
  const cx = new Array(N).fill(0);
  const boxOf = parts.map((p) => p.box);
  for (let i = 0; i < N; i++) {
    if (i === 0) {
      cx[i] = M.margin + (boxOf[i] != null ? M.boxPad : 0) + heads[i].w / 2;
      continue;
    }
    let gap = M.gap;
    if (boxOf[i] !== boxOf[i - 1]) {
      if (boxOf[i - 1] != null) gap += M.boxPad;
      if (boxOf[i] != null) gap += M.boxPad;
      gap += M.boxGap;
    }
    cx[i] = cx[i - 1] + heads[i - 1].w / 2 + gap + heads[i].w / 2;
  }

  // --- Contraintes dues aux libellés
  const constraints = [];
  const msgBlocks = new Map();
  const noteBlocks = new Map();
  let rightOverflow = 0;
  d.events.forEach((ev, k) => {
    if (ev.type === 'msg') {
      const b = block(ev.label, measure, font);
      msgBlocks.set(k, b);
      const a = idx.get(ev.from);
      const z = idx.get(ev.to);
      if (a === z) {
        if (a < N - 1) constraints.push([a, a + 1, b.width + M.selfW + 24]);
        else rightOverflow = Math.max(rightOverflow, b.width + M.selfW + 16);
      } else {
        constraints.push([Math.min(a, z), Math.max(a, z), b.width + 30]);
      }
    } else if (ev.type === 'note') {
      const b = block(ev.text, measure, font, { size: font.size - 1 });
      noteBlocks.set(k, b);
      const w = b.width + M.notePad * 2;
      const t = ev.targets.map((x) => idx.get(x)).filter((x) => x != null);
      if (!t.length) return;
      const a = Math.min(...t);
      const z = Math.max(...t);
      if (ev.pos === 'right') {
        if (z < N - 1) constraints.push([z, z + 1, w + 30]);
        else rightOverflow = Math.max(rightOverflow, w + 16);
      } else if (ev.pos === 'left' && a > 0) {
        constraints.push([a - 1, a, w + 30]);
      } else if (ev.pos === 'over' && a !== z) {
        constraints.push([a, z, w - 20]);
      }
    }
  });
  // Titres de box
  d.boxes.forEach((b) => {
    const members = b.members.map((m) => idx.get(m)).filter((x) => x != null);
    if (members.length < 2) return;
    const tw = measure(b.title, { bold: true, family: font.headFamily });
    const a = Math.min(...members);
    const z = Math.max(...members);
    constraints.push([a, z, tw + 20 - heads[a].w / 2 - heads[z].w / 2]);
  });

  constraints.sort((x, y) => x[1] - x[0] - (y[1] - y[0]));
  for (const [lo, hi, need] of constraints) {
    const deficit = need - (cx[hi] - cx[lo]);
    if (deficit <= 0) continue;
    const span = hi - lo;
    for (let k = lo + 1; k < N; k++) cx[k] += (deficit * Math.min(k - lo, span)) / span;
  }

  // Une box seule avec titre large
  d.boxes.forEach((b) => {
    const members = b.members.map((m) => idx.get(m)).filter((x) => x != null);
    if (members.length !== 1) return;
    const i = members[0];
    const tw = measure(b.title, { bold: true }) + 16;
    const extra = Math.max(0, (tw - heads[i].w - 2 * M.boxPad) / 2);
    if (extra > 0) {
      for (let k = i; k < N; k++) cx[k] += extra;
      for (let k = i + 1; k < N; k++) cx[k] += extra;
    }
  });

  // --- Vertical
  const hasBoxes = d.boxes.length > 0;
  const titleBlock = d.title ? block(d.title, measure, font, { bold: true, size: font.size + 4 }) : null;
  const top = M.margin + (titleBlock ? titleBlock.height + 14 : 0);
  const headTop = top + (hasBoxes ? M.boxTitle : 0);
  const headBottom = headTop + headH;
  let y = headBottom + 18;

  const respBelow = String(d.skin.responsemessagebelowarrow ?? '').toLowerCase() === 'true';
  const align = String(d.skin.sequencemessagealign ?? 'left').toLowerCase();

  const messages = [];
  const notes = [];
  const dividers = [];
  const fragments = [];
  const fragStack = [];
  let seq = 0;
  let group = null;

  /** Positionne un message à partir de la hauteur de sa flèche. */
  const place = (g, ay) => {
    const h = g.block.height;
    g.y = ay;
    if (g.self) {
      g.y2 = ay + M.selfH;
      g.labelY = ay - 6;
      g.bottom = ay + Math.max(M.selfH, h) + 14;
    } else if (g.below) {
      g.labelY = ay + 4;
      g.bottom = ay + 4 + h + 12;
    } else {
      g.labelY = ay - h - 4;
      g.bottom = ay + 14;
    }
  };

  const widen = (b) => {
    for (const f of fragStack) {
      f.xMin = Math.min(f.xMin, b[0]);
      f.xMax = Math.max(f.xMax, b[1]);
    }
  };

  d.events.forEach((ev, k) => {
    if (ev.type === 'msg') {
      const b = msgBlocks.get(k);
      const a = idx.get(ev.from);
      const z = idx.get(ev.to);
      const x1 = cx[a];
      const x2 = cx[z];
      const self = a === z;
      const below = !self && respBelow && ev.dashed;
      let m;
      if (self) {
        m = { self: true, x1, x2, labelX: x1 + M.selfW + 8, above: 6 };
        widen([x1 - 6, x1 + M.selfW + 8 + b.width]);
      } else {
        const lo = Math.min(x1, x2);
        const hi = Math.max(x1, x2);
        let labelX;
        if (align === 'center') labelX = (lo + hi) / 2 - b.width / 2;
        else if (align === 'right') labelX = hi - 10 - b.width;
        else if (align === 'direction') labelX = x1 < x2 ? lo + 10 : hi - 10 - b.width;
        else labelX = lo + 10;
        m = { self: false, x1, x2, labelX, below, above: below ? 4 : b.height + 4 };
        widen([lo, hi]);
      }
      Object.assign(m, { ev, block: b, key: k, line: ev.line });

      // Messages parallèles (&) : même groupe, flèches alignées sur une seule ligne
      if (ev.parallel && group) group.members.push(m);
      else {
        seq += 1;
        group = { rowY: y, members: [m] };
      }
      m.seq = seq;
      messages.push(m);

      const ay = group.rowY + Math.max(...group.members.map((g) => g.above));
      let bottom = 0;
      for (const g of group.members) {
        place(g, ay);
        bottom = Math.max(bottom, g.bottom);
      }
      y = bottom;
      return;
    }
    group = null;
    if (ev.type === 'fragStart') {
      const lbl = block(ev.label ? `[${ev.label}]` : '', measure, font, { bold: true, size: font.size - 1 });
      const tagW = measure(ev.kind, { bold: true, size: font.size - 1 }) + 22;
      const f = {
        id: ev.id,
        kind: ev.kind,
        top: y,
        xMin: Infinity,
        xMax: -Infinity,
        tagW,
        label: lbl,
        sections: [{ top: y, color: ev.color, label: null }],
        depth: fragStack.length,
        seq: seq + 1,
        line: ev.line,
      };
      fragStack.push(f);
      fragments.push(f);
      y += Math.max(M.fragHeader, lbl.height + 6) + 10;
      return;
    }
    if (ev.type === 'fragElse') {
      const f = fragStack[fragStack.length - 1];
      if (!f) return;
      y += 4;
      const lbl = block(ev.label ? `[${ev.label}]` : '', measure, font, { bold: true, size: font.size - 1 });
      f.sections[f.sections.length - 1].bottom = y;
      f.sections.push({ top: y, color: ev.color, label: lbl, line: ev.line });
      y += Math.max(lbl.height, 6) + 10;
      return;
    }
    if (ev.type === 'fragEnd') {
      const f = fragStack.pop();
      if (!f) return;
      y += 4;
      f.bottom = y;
      f.sections[f.sections.length - 1].bottom = y;
      if (!Number.isFinite(f.xMin)) {
        f.xMin = cx[0] - 30;
        f.xMax = cx[0] + 30;
      }
      const pad = M.fragPad;
      f.xMin -= pad;
      f.xMax += pad;
      f.xMax = Math.max(f.xMax, f.xMin + f.tagW + f.label.width + 20);
      widen([f.xMin, f.xMax]);
      y += 12;
      return;
    }
    if (ev.type === 'note') {
      const b = noteBlocks.get(k);
      const t = ev.targets.map((x) => idx.get(x)).filter((x) => x != null);
      if (!t.length) return;
      const w = b.width + M.notePad * 2;
      const h = b.height + M.notePad * 2 - 2;
      let x;
      if (ev.pos === 'left') x = cx[Math.min(...t)] - 12 - w;
      else if (ev.pos === 'right') x = cx[Math.max(...t)] + 12;
      else {
        const a = cx[Math.min(...t)];
        const z = cx[Math.max(...t)];
        const cw = Math.max(w, z - a + 40);
        x = (a + z) / 2 - cw / 2;
        notes.push({ ev, block: b, x, y, w: cw, h, seq, line: ev.line });
        widen([x, x + cw]);
        y += h + 12;
        return;
      }
      notes.push({ ev, block: b, x, y, w, h, seq, line: ev.line });
      widen([x, x + w]);
      y += h + 12;
      return;
    }
    if (ev.type === 'divider') {
      const b = block(ev.text, measure, font, { bold: true });
      dividers.push({ kind: 'divider', block: b, y: y + 6, seq, line: ev.line });
      y += b.height + 24;
      return;
    }
    if (ev.type === 'delay') {
      const b = block(ev.text, measure, font, { size: font.size - 1 });
      dividers.push({ kind: 'delay', block: b, y, h: b.height + 24, seq, line: ev.line });
      y += b.height + 28;
      return;
    }
    if (ev.type === 'space') {
      y += ev.size;
    }
  });

  y += 10;
  const footTop = y;
  const footBottom = footTop + headH;

  // --- Boxes
  const boxes = d.boxes
    .map((b) => {
      const members = b.members.map((m) => idx.get(m)).filter((x) => x != null);
      if (!members.length) return null;
      const a = Math.min(...members);
      const z = Math.max(...members);
      const tw = measure(b.title, { bold: true }) + 16;
      let x1 = cx[a] - heads[a].w / 2 - M.boxPad;
      let x2 = cx[z] + heads[z].w / 2 + M.boxPad;
      if (x2 - x1 < tw) {
        const c = (x1 + x2) / 2;
        x1 = c - tw / 2;
        x2 = c + tw / 2;
      }
      return { ...b, x1, x2, y1: top, y2: footBottom + 8 };
    })
    .filter(Boolean);

  // --- Dimensions globales
  let maxX = N ? cx[N - 1] + heads[N - 1].w / 2 + rightOverflow : M.margin + 200;
  let minX = M.margin;
  for (const f of fragments) {
    maxX = Math.max(maxX, f.xMax);
    minX = Math.min(minX, f.xMin);
  }
  for (const n of notes) {
    maxX = Math.max(maxX, n.x + n.w);
    minX = Math.min(minX, n.x);
  }
  for (const b of boxes) {
    maxX = Math.max(maxX, b.x2);
    minX = Math.min(minX, b.x1);
  }
  if (titleBlock) maxX = Math.max(maxX, M.margin + titleBlock.width);
  const shift = minX < M.margin ? M.margin - minX : 0;
  const width = maxX + shift + M.margin;
  const height = footBottom + (hasBoxes ? 8 : 0) + M.margin;

  return {
    width: Math.max(width, 200),
    height,
    shift,
    font,
    title: titleBlock,
    participants: parts.map((p, i) => ({ ...p, cx: cx[i], ...heads[i] })),
    headTop,
    headH,
    footTop,
    boxes,
    messages,
    notes,
    dividers,
    fragments,
    totalSteps: seq,
    left: minX,
  };
}
