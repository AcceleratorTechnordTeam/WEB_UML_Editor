import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

const KW = /^(\s*)(@startuml|@enduml|skinparam|box|end box|end note|end|alt|else|opt|loop|par|break|critical|group|return|title|note|hnote|rnote|activate|deactivate|autonumber)\b/i;
const PART = /^(\s*)(actor|participant|database|entity|boundary|control|collections|queue)\b/i;

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightLine(line) {
  if (/^\s*'/.test(line)) return `<span class="tk-comment">${escape(line)}</span>`;
  let html = escape(line);
  html = html
    .replace(/(&quot;|")([^"]*)(")/g, '<span class="tk-str">"$2"</span>')
    .replace(/(#[0-9A-Fa-f]{6}\b|#[A-Za-z]+\b)/g, (m) => {
      const c = m.slice(1);
      const css = /^[0-9a-f]{6}$/i.test(c) ? `#${c}` : c;
      return `<span class="tk-color">${m}<i style="background:${css}"></i></span>`;
    })
    .replace(/(\*\*[^*]+\*\*)/g, '<span class="tk-bold">$1</span>')
    .replace(/(-{1,2}&gt;{1,2}|&lt;{1,2}-{1,2})/g, '<span class="tk-arrow">$1</span>')
    .replace(/^(\s*&amp;)/, '<span class="tk-arrow">$1</span>');
  html = html.replace(/(:)(\s)/, '<span class="tk-punct">$1</span>$2');
  html = html.replace(KW, '$1<span class="tk-kw">$2</span>').replace(PART, '$1<span class="tk-part">$2</span>');
  return html;
}

const Editor = forwardRef(function Editor({ value, onChange, onCursorLine, warnings, activeLine }, ref) {
  const ta = useRef(null);
  const pre = useRef(null);
  const gutter = useRef(null);

  useImperativeHandle(ref, () => ({
    goToLine(n) {
      const el = ta.current;
      if (!el) return;
      const lines = el.value.split('\n');
      let pos = 0;
      for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      el.focus();
      el.setSelectionRange(pos, pos + (lines[n - 1]?.length ?? 0));
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
      el.scrollTop = Math.max(0, (n - 1) * lh - el.clientHeight / 3);
      sync();
    },
    insert(snippet) {
      const el = ta.current;
      const start = el.selectionStart;
      const v = el.value;
      // insère avant @enduml si le curseur est tout au début
      let at = v.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = v.indexOf('\n', start);
      at = lineEnd === -1 ? v.length : lineEnd + 1;
      if (/@enduml/i.test(v.slice(v.lastIndexOf('\n', start - 1) + 1, lineEnd === -1 ? undefined : lineEnd))) {
        at = v.lastIndexOf('\n', start - 1) + 1;
      }
      const text = snippet.endsWith('\n') ? snippet : `${snippet}\n`;
      const next = v.slice(0, at) + text + v.slice(at);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(at, at + text.length - 1);
      });
    },
  }));

  const lines = value.split('\n');
  const warnByLine = useMemo(() => {
    const m = new Map();
    for (const w of warnings) m.set(w.line, w.msg);
    return m;
  }, [warnings]);

  const html = useMemo(() => lines.map(highlightLine).join('\n') + '\n', [value]); // eslint-disable-line

  const sync = () => {
    if (!ta.current) return;
    pre.current.scrollTop = ta.current.scrollTop;
    pre.current.scrollLeft = ta.current.scrollLeft;
    gutter.current.scrollTop = ta.current.scrollTop;
  };

  const reportCursor = () => {
    const el = ta.current;
    const line = el.value.slice(0, el.selectionStart).split('\n').length;
    onCursorLine?.(line);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const s = el.selectionStart;
      const next = `${el.value.slice(0, s)}    ${el.value.slice(el.selectionEnd)}`;
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
    }
  };

  return (
    <div className="editor">
      <div className="gutter" ref={gutter}>
        {lines.map((_, i) => (
          <div
            key={i}
            className={`ln ${warnByLine.has(i + 1) ? 'warn' : ''} ${activeLine === i + 1 ? 'active' : ''}`}
            title={warnByLine.get(i + 1)}
          >
            {warnByLine.has(i + 1) ? '⚠' : i + 1}
          </div>
        ))}
        <div className="ln">&nbsp;</div>
      </div>
      <div className="code">
        <pre ref={pre} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          ref={ta}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onScroll={sync}
          onKeyDown={onKeyDown}
          onKeyUp={reportCursor}
          onClick={reportCursor}
          wrap="off"
        />
      </div>
    </div>
  );
});

export default Editor;
