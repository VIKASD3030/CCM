/**
 * Pill-shaped dropdown from the AI Drafting prototype: "Label  Value ▾" opens a
 * small menu with a heading and options (optional right-aligned hint).
 *
 *   <MenuSelect label="Tone" heading="Tone of letter" value={tone} onChange={setTone}
 *     options={[{ id: 'formal', label: 'Formal', hint: 'Default' }, …]} />
 *
 * variant="project": the header's project picker, red and dashed until a value is chosen.
 * allLabel: adds an "All" option with value '' (used by filters).
 */
import React from 'react';

export default function MenuSelect({
  label, heading, value, options, onChange, placeholder = 'Select', allLabel, variant, disabled, menuWidth = 260, align = 'left',
}) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef(null);
  const items = allLabel ? [{ id: '', label: allLabel }, ...options] : options;
  const current = items.find((o) => o.id === value);
  const empty = !current || (current.id === '' && !allLabel);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const pick = (id) => { setOpen(false); if (id !== value) onChange(id); };

  return (
    <div className="cx-ms" ref={root}>
      <button type="button" className={`cx-ms-trigger ${variant || ''} ${empty ? 'empty' : ''}`} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="cx-ms-label">{label}</span>
        <span className="cx-ms-value">{current && !empty ? current.label : placeholder} ▾</span>
      </button>
      {open && (
        <div className={`cx-ms-menu ${align}`} role="listbox" aria-label={heading || label} style={{ width: menuWidth }}>
          {heading && <div className="cx-ms-head">{heading}</div>}
          {items.length === 0 && <div className="cx-ms-empty">Nothing to choose yet</div>}
          {items.map((o) => (
            <button key={o.id || '_all'} type="button" role="option" aria-selected={o.id === value}
              className={`cx-ms-opt ${o.id === value ? 'on' : ''}`} onClick={() => pick(o.id)}>
              <span className="cx-ms-opt-label">{o.label}</span>
              {o.hint && <span className="cx-ms-opt-hint">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
