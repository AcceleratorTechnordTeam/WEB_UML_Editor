import { forwardRef, memo } from 'react';
import { color as normColor } from '../lib/parser.js';

const cssColor = (c) => (c && c.startsWith('#') ? c : normColor(c ? `#${c.replace(/^#/, '')}` : c));

/** Sur fond sombre, ravive une couleur pastel (même teinte, plus saturée). */
function vivid(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return `hsl(${Math.round(h * 60 + 360) % 360} 85% 58%)`;
}

function RichText({ block, x, y, fill, anchor = 'start', font, weight, family }) {
  if (!block || !block.height) return null;
  return block.lines.map((segs, i) => (
    <text
      key={i}
      x={x}
      y={y + i * block.lh + block.size}
      fill={fill}
      fontSize={block.size}
      fontFamily={family ?? font.family}
      textAnchor={anchor}
      fontWeight={weight}
      xmlSpace="preserve"
    >
      {segs.map((s, j) => (
        <tspan
          key={j}
          fontWeight={s.bold || block.bold ? font.boldWeight : undefined}
          fontStyle={s.italic ? 'italic' : undefined}
        >
          {s.text}
        </tspan>
      ))}
    </text>
  ));
}

/** Couleurs d'un participant selon le thème. */
function partPaint(p, i, theme, c) {
  const pc = theme.partColors ? theme.partColors[i % theme.partColors.length] : null;
  if (theme.partColorMode === 'stroke' && pc) return { fill: c.partBg, stroke: pc, text: pc };
  if (pc) return { fill: pc, stroke: c.border, text: c.partText ?? c.text };
  return { fill: (theme.useSkin && p.color) || c.partBg, stroke: c.border, text: c.text };
}

function Head({ p, i, y, h, c, font, foot, theme }) {
  const { cx, w, text } = p;
  const paint = partPaint(p, i, theme, c);
  const sw = theme.partStroke ?? (theme.useSkin ? 1.4 : 1);
  const hs = theme.hardShadow;
  const tilt = theme.tilt ? (i % 2 ? 1 : -1) * theme.tilt : 0;
  const headFamily = font.headFamily;
  let body;

  if (p.type === 'actor') {
    const fy = foot ? y + text.height + 6 : y + (h - (46 + text.height + 6));
    const ty = foot ? y : fy + 46;
    const stroke = theme.partColors ? (theme.partStroke === 0 ? paint.fill : paint.stroke) : c.actorBorder || c.border;
    const fill = theme.partColorMode === 'stroke' ? c.partBg : paint.fill;
    body = (
      <g>
        <g stroke={theme.partColorMode === 'stroke' ? paint.stroke : stroke} strokeWidth={Math.max(1.6, sw)} fill={fill} strokeLinecap="round">
          <circle cx={cx} cy={fy + 8} r={7} />
          <line x1={cx} y1={fy + 15} x2={cx} y2={fy + 32} />
          <line x1={cx - 12} y1={fy + 21} x2={cx + 12} y2={fy + 21} />
          <line x1={cx} y1={fy + 32} x2={cx - 10} y2={fy + 44} />
          <line x1={cx} y1={fy + 32} x2={cx + 10} y2={fy + 44} />
        </g>
        <RichText block={text} x={cx} y={ty} fill={theme.partColorMode === 'stroke' ? paint.text : c.text} anchor="middle" font={font} family={headFamily} />
      </g>
    );
  } else if (p.type === 'database' || p.type === 'collections' || p.type === 'queue') {
    const top = y + (foot ? 0 : h - p.h);
    const x = cx - w / 2;
    const r = 7;
    const bh = p.h;
    const d = (ox) =>
      `M${x + ox},${top + r + ox} a${w / 2},${r} 0 0,0 ${w},0 a${w / 2},${r} 0 0,0 ${-w},0 v${bh - 2 * r} a${w / 2},${r} 0 0,0 ${w},0 v${-(bh - 2 * r)}`;
    body = (
      <g>
        {hs && <path d={d(4)} fill={hs} />}
        <path
          d={d(0)}
          fill={paint.fill}
          stroke={theme.partColors ? paint.stroke : c.dbBorder || c.border}
          strokeWidth={sw}
          filter={theme.shadow ? 'url(#softShadow)' : undefined}
        />
        <RichText block={text} x={cx} y={top + 2 * r + (bh - 2 * r - text.height) / 2 - 2} fill={paint.text} anchor="middle" font={font} family={headFamily} />
      </g>
    );
  } else if (p.type === 'boundary' || p.type === 'control' || p.type === 'entity') {
    const top = y + (foot ? text.height + 6 : h - p.h);
    const ty = foot ? y : top + 34;
    body = (
      <g>
        <g stroke={paint.stroke} strokeWidth={Math.max(1.5, sw)} fill={paint.fill}>
          <circle cx={cx} cy={top + 15} r={13} />
          {p.type === 'boundary' && <line x1={cx - 22} y1={top + 2} x2={cx - 22} y2={top + 28} />}
          {p.type === 'boundary' && <line x1={cx - 22} y1={top + 15} x2={cx - 13} y2={top + 15} />}
          {p.type === 'entity' && <line x1={cx - 13} y1={top + 29} x2={cx + 13} y2={top + 29} />}
          {p.type === 'control' && <path d={`M${cx + 2},${top - 2} l-5,4 l5,4`} fill="none" />}
        </g>
        <RichText block={text} x={cx} y={ty} fill={theme.partColorMode === 'stroke' ? paint.text : c.text} anchor="middle" font={font} family={headFamily} />
      </g>
    );
  } else {
    const top = y + (foot ? 0 : h - p.h);
    const x = cx - w / 2;
    const rx = theme.partRadius === 'pill' ? p.h / 2 : theme.partRadius ?? theme.radius ?? 4;
    if (theme.partStyle === 'bracket') {
      body = (
        <g>
          <path
            d={`M${x + 6},${top + 2} h-6 v${p.h - 4} h6 M${x + w - 6},${top + 2} h6 v${p.h - 4} h-6`}
            fill="none"
            stroke={paint.stroke}
            strokeWidth={1.6}
          />
          <RichText block={text} x={cx} y={top + 9} fill={paint.text} anchor="middle" font={font} family={headFamily} />
        </g>
      );
    } else {
      body = (
        <g>
          {hs && <rect x={x + 4} y={top + 4} width={w} height={p.h} rx={rx} fill={hs} />}
          <rect
            x={x}
            y={top}
            width={w}
            height={p.h}
            rx={rx}
            fill={paint.fill}
            stroke={paint.stroke}
            strokeWidth={sw}
            filter={theme.shadow ? 'url(#softShadow)' : undefined}
          />
          {theme.accentTop && <rect x={x + rx} y={top} width={w - 2 * rx} height={2} fill="url(#accentGrad)" />}
          <RichText block={text} x={cx} y={top + 9} fill={paint.text} anchor="middle" font={font} family={headFamily} />
        </g>
      );
    }
  }

  if (!tilt) return body;
  return <g transform={`rotate(${tilt} ${cx} ${y + h / 2})`}>{body}</g>;
}

function ArrowHead({ x, y, dir, open, stroke, style, sw }) {
  if (style === 'dot') return <circle cx={x - dir * 2} cy={y} r={3.8} fill={stroke} />;
  const L = 9 + sw;
  const H = 4.5 + sw / 2;
  const pts = `${x - dir * L},${y - H} ${x},${y} ${x - dir * L},${y + H}`;
  return open || style === 'open' ? (
    <polyline points={pts} fill="none" stroke={stroke} strokeWidth={Math.max(1.4, sw)} strokeLinejoin="round" strokeLinecap="round" />
  ) : (
    <polygon points={pts} fill={stroke} stroke={stroke} strokeWidth={1} strokeLinejoin="round" />
  );
}

function Arrow({ m, stroke, theme }) {
  const { ev } = m;
  const sw = theme.arrowStroke ?? 1.4;
  const dash = ev.dashed ? theme.dash ?? '6 4' : undefined;
  const cap = theme.arrowHead === 'dot' ? 'round' : undefined;
  if (m.self) {
    const x = m.x1;
    const r = 30;
    const d = `M${x},${m.y} H${x + r} V${m.y2} H${x + 4}`;
    return (
      <g>
        <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinecap={cap} strokeLinejoin="round" />
        <ArrowHead x={x + 2} y={m.y2} dir={-1} open={ev.open} stroke={stroke} style={theme.arrowHead} sw={sw - 1.4} />
      </g>
    );
  }
  const dir = m.x2 > m.x1 ? 1 : -1;
  const end = m.x2 - dir * 1.5;
  return (
    <g>
      <line x1={m.x1} y1={m.y} x2={end - dir * (sw - 1)} y2={m.y} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinecap={cap} />
      {ev.lost ? (
        <path d={`M${end - 5},${m.y - 5} l10,10 M${end + 5},${m.y - 5} l-10,10`} stroke={stroke} strokeWidth={sw + 0.2} />
      ) : (
        <ArrowHead x={end} y={m.y} dir={dir} open={ev.open} stroke={stroke} style={theme.arrowHead} sw={sw - 1.4} />
      )}
    </g>
  );
}

function Background({ L, c, theme }) {
  const bg = theme.bgGradient ? 'url(#bgGrad)' : c.bg;
  return (
    <>
      <rect width={L.width} height={L.height} fill={bg} />
      {theme.bgPattern && <rect width={L.width} height={L.height} fill="url(#bgPattern)" />}
      {theme.sun && (
        <g opacity={0.5}>
          <circle cx={L.width / 2} cy={L.height + 40} r={Math.min(260, L.width / 4)} fill="url(#sunGrad)" />
        </g>
      )}
    </>
  );
}

function Pattern({ theme, c }) {
  const col = c.pattern ?? 'rgba(0,0,0,.08)';
  switch (theme.bgPattern) {
    case 'grid':
      return (
        <pattern id="bgPattern" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20,0 V20 H0" fill="none" stroke={col} strokeWidth="0.6" />
          <path d="M10,0 V20 M0,10 H20" fill="none" stroke={col} strokeWidth="0.25" />
        </pattern>
      );
    case 'halftone':
      return (
        <pattern id="bgPattern" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.4" fill={col} />
        </pattern>
      );
    case 'scanlines':
      return (
        <pattern id="bgPattern" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.2" fill={col} />
        </pattern>
      );
    case 'dots':
      return (
        <pattern id="bgPattern" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="11" r="1.6" fill={col} />
        </pattern>
      );
    case 'synthgrid':
      return (
        <pattern id="bgPattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40,0 V40 H0" fill="none" stroke={col} strokeWidth="0.8" />
        </pattern>
      );
    default:
      return null;
  }
}

const Diagram = forwardRef(function Diagram(
  { L, colors: c, theme, step, playing, activeLine, onPick, hoverLine, onHover },
  ref,
) {
  const font = L.font;
  const vis = (seq) => !playing || seq <= step;
  const fade = (seq) => ({ opacity: vis(seq) ? 1 : 0.07, transition: 'opacity .35s ease' });
  const tint = theme.tintOpacity;
  const lifeTop = L.headTop + L.headH;
  const dark = theme.ui === 'dark';
  const sectionFill = (col) => (dark ? vivid(cssColor(col)) : cssColor(col));
  const radius = theme.radius ?? 4;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={L.width}
      height={L.height}
      viewBox={`0 0 ${L.width} ${L.height}`}
      style={{ background: c.bg, display: 'block' }}
      fontFamily={font.family}
    >
      <defs>
        <filter id="sketchy" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" />
        </filter>
        <linearGradient id="accentGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={L.width} y2="0">
          <stop offset="0" stopColor={theme.gradient?.[0] ?? c.arrow} />
          <stop offset="1" stopColor={theme.gradient?.[1] ?? c.arrow} />
        </linearGradient>
        {theme.bgGradient && (
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            {theme.bgGradient.map((col, i) => (
              <stop key={i} offset={i / (theme.bgGradient.length - 1)} stopColor={col} />
            ))}
          </linearGradient>
        )}
        {theme.sun && (
          <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFE66D" />
            <stop offset="0.6" stopColor="#FF2E88" />
          </linearGradient>
        )}
        <Pattern theme={theme} c={c} />
        <filter id="softShadow" x="-20%" y="-30%" width="140%" height="170%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.06" />
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000" floodOpacity="0.06" />
        </filter>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={theme.glowSize ?? 2.2} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Background L={L} c={c} theme={theme} />
      <g
        transform={`translate(${L.shift},0)`}
        filter={theme.sketchy ? 'url(#sketchy)' : theme.glow ? 'url(#glow)' : undefined}
      >
        {L.title && (
          <RichText block={L.title} x={(L.width - 2 * L.shift) / 2} y={20} fill={c.text} anchor="middle" font={font} family={font.headFamily} />
        )}

        {/* Boxes */}
        {L.boxes.map((b, i) => (
          <g key={`b${i}`}>
            {theme.hardShadow && (
              <rect x={b.x1 + 5} y={b.y1 + 5} width={b.x2 - b.x1} height={b.y2 - b.y1} rx={radius} fill={theme.hardShadow} />
            )}
            {theme.hardShadow && (
              <rect x={b.x1} y={b.y1} width={b.x2 - b.x1} height={b.y2 - b.y1} rx={radius} fill={c.bg} />
            )}
            <rect
              x={b.x1}
              y={b.y1}
              width={b.x2 - b.x1}
              height={b.y2 - b.y1}
              fill={dark && b.color ? vivid(cssColor(b.color)) : cssColor(b.color) || '#ECEFF1'}
              fillOpacity={tint}
              stroke={theme.useSkin ? 'none' : c.boxBorder ?? c.groupBorder}
              strokeWidth={theme.boxStroke ?? 1}
              strokeOpacity={c.boxBorder ? 1 : 0.5}
              strokeDasharray={theme.useSkin || c.boxBorder ? undefined : '3 3'}
              rx={theme.useSkin ? 0 : radius}
            />
            <text
              x={(b.x1 + b.x2) / 2}
              y={b.y1 + font.size + 5}
              textAnchor="middle"
              fontWeight={font.boldWeight}
              fontSize={font.size}
              fontFamily={font.headFamily ?? font.family}
              fill={c.boxTitle ?? c.text}
            >
              {theme.upperTitles ? b.title.toUpperCase() : b.title}
            </text>
          </g>
        ))}

        {/* Lignes de vie */}
        {L.participants.map((p, i) => {
          const paint = partPaint(p, i, theme, c);
          return (
            <line
              key={`l${p.id}`}
              x1={p.cx}
              y1={lifeTop}
              x2={p.cx}
              y2={L.footTop}
              stroke={theme.partColorMode === 'stroke' ? paint.stroke : c.lifeline}
              strokeOpacity={theme.partColorMode === 'stroke' ? 0.55 : 1}
              strokeWidth={theme.lifeStroke ?? 1}
              strokeDasharray={theme.lifeDash ?? '5 4'}
              strokeLinecap={theme.lifeDash?.startsWith('0') || theme.lifeDash?.startsWith('1 ') ? 'round' : undefined}
            />
          );
        })}

        {/* Fragments (alt / else / loop...) */}
        {L.fragments.map((f) => (
          <g key={`f${f.id}`} style={fade(f.seq)} className="clickable" onClick={() => onPick?.(f.line)}>
            {theme.hardShadow && (
              <rect x={f.xMin + 4} y={f.top + 4} width={f.xMax - f.xMin} height={f.bottom - f.top} rx={radius} fill={theme.hardShadow} />
            )}
            {theme.hardShadow && (
              <rect x={f.xMin} y={f.top} width={f.xMax - f.xMin} height={f.bottom - f.top} rx={radius} fill={c.bg} />
            )}
            {f.sections.map((s, i) =>
              s.color ? (
                <rect
                  key={i}
                  x={f.xMin}
                  y={s.top}
                  width={f.xMax - f.xMin}
                  height={s.bottom - s.top}
                  fill={sectionFill(s.color)}
                  fillOpacity={theme.useSkin ? 1 : theme.sectionOpacity ?? (dark ? 0.13 : tint * 1.6)}
                />
              ) : null,
            )}
            <rect
              x={f.xMin}
              y={f.top}
              width={f.xMax - f.xMin}
              height={f.bottom - f.top}
              fill="none"
              stroke={activeLine === f.line ? c.highlight : c.groupBorder}
              strokeWidth={activeLine === f.line ? 2 : theme.fragStroke ?? 1.3}
              rx={theme.useSkin ? 0 : Math.min(radius, 8)}
            />
            {theme.tagStyle === 'pill' ? (
              <>
                <rect x={f.xMin + 6} y={f.top + 5} width={f.tagW - 6} height={font.size + 5} rx={(font.size + 5) / 2} fill={c.groupBg} />
                <text
                  x={f.xMin + 6 + (f.tagW - 6) / 2}
                  y={f.top + 5 + font.size - 1}
                  textAnchor="middle"
                  fontSize={font.size - 2}
                  fontWeight={font.boldWeight}
                  fontFamily={font.headFamily ?? font.family}
                  fill={c.groupTagText}
                  letterSpacing="0.04em"
                >
                  {f.kind.toUpperCase()}
                </text>
              </>
            ) : (
              <>
                <path
                  d={`M${f.xMin},${f.top} h${f.tagW} v${14} l-8,8 h${-(f.tagW - 8)} z`}
                  fill={c.groupBg}
                  stroke={c.groupBorder}
                  strokeWidth={theme.fragStroke ?? 1.2}
                />
                <text
                  x={f.xMin + 7}
                  y={f.top + font.size + 2}
                  fontSize={font.size - 1}
                  fontWeight={font.boldWeight}
                  fontFamily={font.headFamily ?? font.family}
                  fill={c.groupTagText ?? c.groupHeader}
                >
                  {f.kind}
                </text>
              </>
            )}
            <RichText block={f.label} x={f.xMin + f.tagW + 8} y={f.top + 4} fill={c.groupHeader} font={font} />
            {f.sections.slice(1).map((s, i) => (
              <g key={`e${i}`}>
                <line
                  x1={f.xMin}
                  x2={f.xMax}
                  y1={s.top}
                  y2={s.top}
                  stroke={activeLine === s.line ? c.highlight : c.groupBorder}
                  strokeDasharray="6 4"
                  strokeWidth={theme.fragStroke ?? 1.2}
                />
                <RichText block={s.label} x={f.xMin + 10} y={s.top + 3} fill={c.groupHeader} font={font} />
              </g>
            ))}
          </g>
        ))}

        {/* Séparateurs */}
        {L.dividers.map((dv, i) => {
          const x1 = L.left;
          const x2 = L.width - 2 * L.shift - 24;
          const mid = (x1 + x2) / 2;
          const pill = theme.tagStyle === 'pill';
          if (dv.kind === 'divider') {
            const w = dv.block.width + 20;
            const ly = dv.y + dv.block.height / 2;
            return (
              <g key={`d${i}`} style={fade(dv.seq)}>
                <line x1={x1} x2={x2} y1={ly + 2} y2={ly + 2} stroke={c.groupBorder} strokeWidth={1} />
                <line x1={x1} x2={x2} y1={ly + 5} y2={ly + 5} stroke={c.groupBorder} strokeWidth={1} />
                <rect
                  x={mid - w / 2}
                  y={dv.y - 4}
                  width={w}
                  height={dv.block.height + 12}
                  rx={pill ? (dv.block.height + 12) / 2 : Math.min(radius, 6)}
                  fill={pill ? c.bg : c.groupBg}
                  stroke={c.groupBorder}
                  strokeWidth={theme.fragStroke ?? 1}
                />
                <RichText block={dv.block} x={mid} y={dv.y} fill={pill ? c.text : c.groupTagText ?? c.groupHeader} anchor="middle" font={font} />
              </g>
            );
          }
          return (
            <g key={`d${i}`} style={fade(dv.seq)}>
              <rect x={x1} y={dv.y} width={x2 - x1} height={dv.h} fill={c.bg} fillOpacity={0.85} />
              <RichText block={dv.block} x={mid} y={dv.y + 10} fill={c.text} anchor="middle" font={font} />
            </g>
          );
        })}

        {/* Têtes et pieds */}
        {L.participants.map((p, i) => (
          <g key={`h${p.id}`}>
            <Head p={p} i={i} y={L.headTop} h={L.headH} c={c} font={font} theme={theme} />
            <Head p={p} i={i} y={L.footTop} h={L.headH} c={c} font={font} theme={theme} foot />
          </g>
        ))}

        {/* Notes */}
        {L.notes.map((n, i) => {
          const hl = activeLine === n.line;
          return (
            <g key={`n${i}`} style={fade(n.seq)} className="clickable" onClick={() => onPick?.(n.line)}>
              {theme.hardShadow && (
                <path d={`M${n.x + 4},${n.y + 4} h${n.w - 8} l8,8 v${n.h - 8} h${-n.w} z`} fill={theme.hardShadow} />
              )}
              <path
                d={`M${n.x},${n.y} h${n.w - 8} l8,8 v${n.h - 8} h${-n.w} z M${n.x + n.w - 8},${n.y} v8 h8`}
                fill={(theme.useSkin && cssColor(n.ev.color)) || c.noteBg}
                stroke={hl ? c.highlight : c.noteBorder}
                strokeWidth={hl ? 2 : theme.partStroke ?? 1.2}
              />
              <RichText block={n.block} x={n.x + 8} y={n.y + 6} fill={c.noteText ?? (theme.glow ? c.text : '#3E2723')} font={font} />
            </g>
          );
        })}

        {/* Messages */}
        {L.messages.map((m) => {
          const hl = activeLine === m.line || hoverLine === m.line;
          const base = m.ev.dashed && c.returnArrow ? c.returnArrow : theme.gradient ? 'url(#accentGrad)' : c.arrow;
          const stroke = hl ? c.highlight : base;
          const current = playing && m.seq === step;
          const hitY1 = Math.min(m.labelY, m.y) - 3;
          const hitY2 = Math.max(m.labelY + m.block.height, m.self ? m.y2 : m.y) + 4;
          const hitX1 = m.self ? m.x1 : Math.min(m.x1, m.x2);
          const hitX2 = m.self ? m.labelX + m.block.width : Math.max(m.x1, m.x2);
          const lb = theme.labelBg;
          const labelFill = hl ? c.highlight : m.ev.dashed && c.returnText ? c.returnText : c.text;
          const path = m.self ? `M${m.x1},${m.y} H${m.x1 + 30} V${m.y2} H${m.x1 + 4}` : `M${m.x1},${m.y} H${m.x2}`;
          return (
            <g
              key={`m${m.key}`}
              style={fade(m.seq)}
              className="clickable"
              onClick={() => onPick?.(m.line)}
              onMouseEnter={() => onHover?.(m.line)}
              onMouseLeave={() => onHover?.(null)}
            >
              <rect x={hitX1} y={hitY1} width={hitX2 - hitX1} height={hitY2 - hitY1} fill="transparent" />
              {hl && (
                <rect
                  x={hitX1 - 2}
                  y={hitY1}
                  width={hitX2 - hitX1 + 4}
                  height={hitY2 - hitY1}
                  rx={4}
                  fill={c.highlight}
                  fillOpacity={0.1}
                />
              )}
              <Arrow m={m} stroke={stroke} theme={theme} />
              {lb && m.block.height > 0 && (
                <rect
                  x={m.labelX - 5}
                  y={m.labelY - 1}
                  width={m.block.width + 10}
                  height={m.block.height + 3}
                  rx={lb.rx ?? 3}
                  fill={lb.fill}
                  stroke={lb.stroke ?? 'none'}
                  strokeWidth={lb.strokeWidth ?? 1.2}
                />
              )}
              <RichText block={m.block} x={m.labelX} y={m.labelY} fill={labelFill} font={font} />
              {current &&
                (theme.dotGlyph ? (
                  <text
                    key={`dot${step}`}
                    fontSize={theme.dotSize ?? 16}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={c.dot}
                    fontWeight="700"
                    fontFamily={font.headFamily ?? font.family}
                  >
                    {theme.dotGlyph}
                    <animateMotion dur="0.7s" fill="freeze" path={path} />
                  </text>
                ) : (
                  <circle key={`dot${step}`} r={5} fill={c.dot} stroke="#fff" strokeWidth={1.5}>
                    <animateMotion dur="0.7s" fill="freeze" path={path} />
                  </circle>
                ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
});

export default memo(Diagram);
