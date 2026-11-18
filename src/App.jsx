import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Editor from './components/Editor.jsx';
import Diagram from './components/Diagram.jsx';
import { parse } from './lib/parser.js';
import { layout } from './lib/layout.js';
import { THEMES, resolveColors, swatchOf } from './lib/themes.js';
import { EXAMPLES, SNIPPETS } from './examples.js';

function ThemePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = THEMES[value];
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="picker" ref={ref}>
      <button className="btn picker-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Swatch t={cur} />
        <span>{cur.name}</span>
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="picker-pop" role="listbox">
          {Object.entries(THEMES).map(([k, t]) => (
            <button
              key={k}
              role="option"
              aria-selected={k === value}
              className={`theme-card ${k === value ? 'on' : ''}`}
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
            >
              <span className="theme-prev" style={{ background: swatchOf(t)[0] }}>
                <i style={{ background: swatchOf(t)[1] }} />
                <i style={{ background: swatchOf(t)[2] }} />
                <b style={{ borderColor: swatchOf(t)[1] }} />
              </span>
              <span className="theme-name">
                <span className="ico">{t.emoji}</span> {t.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Swatch({ t }) {
  const [a, b, c] = swatchOf(t);
  return (
    <span className="swatch" style={{ background: a }}>
      <i style={{ background: b }} />
      <i style={{ background: c }} />
    </span>
  );
}

const LS = 'seqplay:v1';
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(LS)) || {};
  } catch {
    return {};
  }
};

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Confetti({ burst }) {
  if (!burst) return null;
  const items = Array.from({ length: 28 }, (_, i) => i);
  const emojis = ['🎉', '✨', '🟦', '🟧', '⭐', '🎊'];
  return (
    <div className="confetti" key={burst}>
      {items.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 7) * 0.06}s`,
            '--dx': `${((i * 53) % 120) - 60}px`,
          }}
        >
          {emojis[i % emojis.length]}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const saved = useMemo(load, []);
  const [code, setCode] = useState(saved.code ?? EXAMPLES.badge.code);
  const [themeKey, setThemeKey] = useState((THEMES[saved.theme] ? saved.theme : 'vercel'));
  const [zoom, setZoom] = useState(1);
  const [split, setSplit] = useState(saved.split ?? 38);
  const [playing, setPlaying] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [activeLine, setActiveLine] = useState(null);
  const [hoverLine, setHoverLine] = useState(null);
  const [fontsReady, setFontsReady] = useState(0);
  const [toast, setToast] = useState(null);
  const [burst, setBurst] = useState(0);

  const editorRef = useRef(null);
  const svgRef = useRef(null);
  const canvasRef = useRef(null);

  const deferred = useDeferredValue(code);
  const theme = THEMES[themeKey];

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady((n) => n + 1));
  }, []);

  // Charge les polices du thème avant de mesurer le texte
  useEffect(() => {
    if (!document.fonts?.load) return;
    const fams = [theme.font.family, theme.font.headFamily].filter(Boolean).map((f) => f.split(',')[0].trim());
    Promise.all(
      fams.flatMap((f) => [document.fonts.load(`400 16px "${f}"`), document.fonts.load(`${theme.font.boldWeight} 16px "${f}"`)]),
    )
      .catch(() => {})
      .then(() => setFontsReady((n) => n + 1));
  }, [theme]);

  const chromeStyle = useMemo(() => {
    const ch = theme.chrome;
    if (!ch) return undefined;
    const map = {
      accent: '--accent',
      accentInk: '--accent-ink',
      focus: '--focus',
      grad: '--grad',
      bg: '--bg',
      panel: '--panel',
      line: '--line',
      lineStrong: '--line-strong',
      hover: '--hover',
      codeBg: '--code-bg',
    };
    const st = {};
    for (const [k, v] of Object.entries(ch)) if (map[k]) st[map[k]] = v;
    if (ch.codeBg) st['--code-gutter'] = ch.codeBg;
    return st;
  }, [theme]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LS, JSON.stringify({ code, theme: themeKey, split }));
      } catch {
        /* stockage indisponible */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [code, themeKey, split]);

  const parsed = useMemo(() => parse(deferred), [deferred]);
  const L = useMemo(() => {
    try {
      return { ok: layout(parsed, theme.font) };
    } catch (e) {
      return { err: e };
    }
  }, [parsed, theme, fontsReady]); // eslint-disable-line
  const colors = useMemo(() => resolveColors(theme, parsed.skin), [theme, parsed.skin]);
  const total = L.ok?.totalSteps ?? 0;

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  // --- Lecture animée
  useEffect(() => {
    if (!autoplay) return undefined;
    if (step >= total) {
      setAutoplay(false);
      setBurst((b) => b + 1);
      return undefined;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 1100 / speed);
    return () => clearTimeout(t);
  }, [autoplay, step, total, speed]);

  const play = () => {
    if (autoplay) {
      setAutoplay(false);
      return;
    }
    if (!playing || step >= total) setStep(Math.min(1, total));
    setPlaying(true);
    setAutoplay(true);
  };
  const stop = () => {
    setPlaying(false);
    setAutoplay(false);
    setStep(0);
  };
  const go = (delta) => {
    setPlaying(true);
    setAutoplay(false);
    setStep((s) => Math.min(total, Math.max(0, s + delta)));
  };

  // Ligne courante de la lecture → surlignage dans l'éditeur
  const playLine = useMemo(() => {
    if (!playing || !L.ok) return null;
    return L.ok.messages.find((m) => m.seq === step)?.line ?? null;
  }, [playing, step, L]);

  // --- Clavier
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === ' ') {
        e.preventDefault();
        play();
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') stop();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, z + 0.1));
      else if (e.key === '-') setZoom((z) => Math.max(0.2, z - 0.1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- Zoom molette (Ctrl)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(3, Math.max(0.2, z * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const fit = useCallback(() => {
    if (!L.ok || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    setZoom(Math.min(2, Math.max(0.2, Math.min((r.width - 48) / L.ok.width, (r.height - 48) / L.ok.height))));
  }, [L]);

  // --- Splitter
  const dragSplit = (e) => {
    e.preventDefault();
    const move = (ev) => setSplit(Math.min(70, Math.max(20, (ev.clientX / window.innerWidth) * 100)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging');
    };
    document.body.classList.add('dragging');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // --- Exports
  const svgString = () => {
    const clone = svgRef.current.cloneNode(true);
    clone.querySelectorAll('animateMotion').forEach((n) => n.parentNode.remove());
    clone.querySelectorAll('[style]').forEach((n) => n.style.removeProperty('opacity'));
    return new XMLSerializer().serializeToString(clone);
  };
  const exportSvg = () => {
    download('sequence.svg', new Blob([svgString()], { type: 'image/svg+xml' }));
    flash('SVG téléchargé 🎨');
  };
  const exportPng = () => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString()], { type: 'image/svg+xml' }));
    img.onload = () => {
      const s = 2;
      const c = document.createElement('canvas');
      c.width = L.ok.width * s;
      c.height = L.ok.height * s;
      const g = c.getContext('2d');
      g.scale(s, s);
      g.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => download('sequence.png', b));
      flash('PNG téléchargé 🖼️');
    };
    img.src = url;
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      flash('Code PlantUML copié 📋');
    } catch {
      flash('Copie impossible 😕');
    }
  };

  const pick = useCallback((line) => {
    setActiveLine(line);
    editorRef.current?.goToLine(line);
  }, []);

  const nbMsg = L.ok?.messages.length ?? 0;
  const highlighted = playLine ?? activeLine;

  return (
    <div className="app" data-theme={themeKey} data-ui={theme.ui ?? 'light'} style={chromeStyle}>
      <header>
        <div className="brand">
          <span className="logo">◆</span>
          <span>SeqPlay</span>
          <span className="slash">/</span>
          <small>Diagrammes de séquence</small>
          <span className="badge">PlantUML</span>
        </div>
        <div className="head-tools">
          <select
            className="select"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setCode(EXAMPLES[e.target.value].code);
              stop();
              setActiveLine(null);
              flash(`Exemple chargé : ${EXAMPLES[e.target.value].name}`);
            }}
          >
            <option value="">Exemples…</option>
            {Object.entries(EXAMPLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.name}
              </option>
            ))}
          </select>
          <ThemePicker value={themeKey} onChange={setThemeKey} />
          <button
            className="btn icon dice"
            title="Thème surprise"
            onClick={() => {
              const keys = Object.keys(THEMES).filter((k) => k !== themeKey);
              const k = keys[Math.floor(Math.random() * keys.length)];
              setThemeKey(k);
              flash(`🎲 ${THEMES[k].emoji} ${THEMES[k].name} !`);
            }}
          >
            🎲
          </button>
        </div>
      </header>

      <main style={{ gridTemplateColumns: `${split}% 6px 1fr` }}>
        <section className="left">
          <div className="snippets">
            {SNIPPETS.map((s) => (
              <button key={s.label} onClick={() => editorRef.current?.insert(s.code)} title={s.code}>
                {s.label}
              </button>
            ))}
          </div>
          <Editor
            ref={editorRef}
            value={code}
            onChange={setCode}
            onCursorLine={setActiveLine}
            warnings={parsed.warnings}
            activeLine={highlighted}
          />
          <div className={`status ${parsed.warnings.length ? 'has-warn' : ''}`}>
            {parsed.warnings.length ? (
              <details>
                <summary>
                  ⚠️ {parsed.warnings.length} avertissement{parsed.warnings.length > 1 ? 's' : ''}
                </summary>
                <ul>
                  {parsed.warnings.map((w, i) => (
                    <li key={i} onClick={() => pick(w.line)}>
                      <b>L{w.line}</b> {w.msg}
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <span className="ok">Syntaxe OK</span>
            )}
            <span className="chips">
              <span className="chip">👥 {parsed.participants.length}</span>
              <span className="chip">✉️ {nbMsg}</span>
              <span className="chip">🧱 {L.ok?.fragments.length ?? 0}</span>
            </span>
          </div>
        </section>

        <div className="splitter" onPointerDown={dragSplit} />

        <section className="right">
          <div className="toolbar">
            <div className="group">
              <button className="btn primary" onClick={play} title="Lecture (Espace)">
                {autoplay ? '⏸ Pause' : step >= total && playing ? '🔁 Rejouer' : '▶ Jouer'}
              </button>
              <button className="btn icon" onClick={() => go(-1)} title="Étape précédente (←)">⏮</button>
              <button className="btn icon" onClick={() => go(1)} title="Étape suivante (→)">⏭</button>
              <button className="btn icon" onClick={stop} disabled={!playing} title="Tout afficher (Échap)">⏹</button>
              <input
                type="range"
                min={0}
                max={total}
                value={playing ? step : total}
                onChange={(e) => {
                  setPlaying(true);
                  setAutoplay(false);
                  setStep(Number(e.target.value));
                }}
                title="Timeline"
              />
              <span className="counter">
                {playing ? step : total}/{total}
              </span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="Vitesse">
                <option value={0.5}>🐢 x0.5</option>
                <option value={1}>🚶 x1</option>
                <option value={2}>🏃 x2</option>
                <option value={4}>🚀 x4</option>
              </select>
            </div>
            <div className="group">
              <button className="btn icon" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>−</button>
              <button className="btn zoomval" onClick={() => setZoom(1)} title="Zoom 100%">
                {Math.round(zoom * 100)}%
              </button>
              <button className="btn icon" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>+</button>
              <button className="btn icon" onClick={fit} title="Ajuster à l'écran">⤢</button>
            </div>
            <div className="group">
              <button className="btn" onClick={exportSvg}>⬇ SVG</button>
              <button className="btn" onClick={exportPng}>⬇ PNG</button>
              <button className="btn icon" onClick={copyCode} title="Copier le code">⧉</button>
            </div>
          </div>

          <div className="canvas" ref={canvasRef} style={{ background: colors.bg }}>
            {L.ok ? (
              <div
                className="paper"
                style={{ width: L.ok.width * zoom, height: L.ok.height * zoom }}
              >
                <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
                  <Diagram
                    ref={svgRef}
                    L={L.ok}
                    colors={colors}
                    theme={theme}
                    step={step}
                    playing={playing}
                    activeLine={highlighted}
                    hoverLine={hoverLine}
                    onHover={setHoverLine}
                    onPick={pick}
                  />
                </div>
              </div>
            ) : (
              <div className="oops">
                🙈 Impossible de dessiner ce diagramme
                <pre>{String(L.err?.message ?? L.err)}</pre>
              </div>
            )}
            <Confetti burst={burst} />
          </div>
          <div className="hint">
            💡 Clique sur une flèche pour aller à sa ligne · <kbd>Espace</kbd> lecture · <kbd>←</kbd>
            <kbd>→</kbd> pas à pas · <kbd>Ctrl</kbd>+molette zoom
          </div>
        </section>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
