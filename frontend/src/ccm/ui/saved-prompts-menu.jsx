/**
 * "User saved prompts" icon for the AI Drafting option row, beside Tone and Length.
 * Hovering (or clicking / focusing, for touch and keyboard) opens a panel that
 * lists the user's saved prompts. Clicking one adds it to the instructions; the
 * current instructions can be saved as a new prompt; the bin removes one.
 */
import React from 'react';
import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { currentUser } from '../session';
import { listPrompts, removePrompt, savePrompt } from '../saved-prompts';
import { toast } from './kit';

export default function SavedPromptsMenu({ text = '', onInsert, disabled, align = 'left' }) {
  const user = currentUser();
  const [prompts, setPrompts] = React.useState(() => listPrompts(user));
  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false); // opened by click: stays until clicked away
  const root = React.useRef(null);
  const closeTimer = React.useRef(null);

  React.useEffect(() => { setPrompts(listPrompts(user)); }, [user]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) { setOpen(false); setPinned(false); } };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setPinned(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  React.useEffect(() => () => clearTimeout(closeTimer.current), []);

  // A short delay lets the pointer cross the gap between the icon and the panel.
  const show = () => { if (disabled) return; clearTimeout(closeTimer.current); setPrompts(listPrompts(user)); setOpen(true); };
  const hide = () => { if (pinned) return; clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpen(false), 200); };
  const toggle = () => {
    if (open && pinned) { setOpen(false); setPinned(false); return; }
    setPrompts(listPrompts(user));
    setOpen(true);
    setPinned(true);
  };

  const current = text.trim();
  const alreadySaved = !!current && prompts.some((p) => p.text === current);

  const save = () => {
    const list = savePrompt(user, current);
    if (list) { setPrompts(list); toast('Prompt saved', 'success'); } else toast('Couldn’t save the prompt: this browser is blocking storage.', 'error');
  };
  const remove = (id) => setPrompts(removePrompt(user, id));
  const use = (p) => { onInsert(p.text); setOpen(false); setPinned(false); };

  return (
    <div className="cx-ms cx-sp" ref={root} onMouseEnter={show} onMouseLeave={hide}>
      <button type="button" className="cx-ms-trigger cx-sp-trigger" disabled={disabled} onClick={toggle} onFocus={show}
        aria-haspopup="dialog" aria-expanded={open} aria-label="User saved prompts" title="User saved prompts">
        <Bookmark size={15} aria-hidden="true" />
        {prompts.length > 0 && <span className="cx-sp-count">{prompts.length}</span>}
      </button>
      {open && (
        <div className={`cx-ms-menu cx-sp-menu ${align}`} role="dialog" aria-label="User saved prompts">
          <div className="cx-ms-head">User saved prompts</div>
          {prompts.length === 0 ? (
            <div className="cx-ms-empty">No saved prompts yet. Write instructions, then save them here to reuse them.</div>
          ) : (
            <ul className="cx-sp-list">
              {prompts.map((p) => (
                <li key={p.id} className="cx-sp-item">
                  <button type="button" className="cx-sp-use" onClick={() => use(p)} title="Add to the instructions">{p.text}</button>
                  <button type="button" className="cx-sp-del" onClick={() => remove(p.id)} aria-label="Delete this saved prompt" title="Delete">
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="cx-sp-save" onClick={save} disabled={!current || alreadySaved}
            title={!current ? 'Type some instructions first' : alreadySaved ? 'These instructions are already saved' : undefined}>
            <BookmarkPlus size={14} aria-hidden="true" />
            {alreadySaved ? 'Current instructions saved' : 'Save current instructions'}
          </button>
          <span className="cx-sp-note">Saved in this browser only.</span>
        </div>
      )}
    </div>
  );
}
