/**
 * "Draft a new letter" screen. Static for now: how a new (non-reply) letter is
 * drafted hasn't been decided, and the CCM public API only drafts replies. The
 * user can set the project, letter type, tone and length, but nothing is sent.
 */
import React from 'react';
import { rememberProject, useProjects } from '../session';
import { DEFAULT_OPTIONS, LENGTHS, LETTER_TYPES, TONES } from '../draft-options';
import MenuSelect from '../ui/menu-select';
import { PageTop, ROUTES } from '../ui/kit';
import sendIcon from '../ui/icons/send-arrow.svg';

export default function NewLetter() {
  const { projects, error: projectsError } = useProjects();
  const [project, setProject] = React.useState('');
  const [options, setOptions] = React.useState(DEFAULT_OPTIONS);
  const [text, setText] = React.useState('');
  const set = (key) => (id) => setOptions((o) => ({ ...o, [key]: id }));

  const projectOptions = (projects || []).map((p) => ({ id: p.project_id, label: p.name || p.project_id, hint: p.project_id }));

  return (
    <>
      <PageTop crumbs={[{ label: 'AI Drafting', to: ROUTES.draftingHome }, { label: 'New letter' }]} title="Draft a new letter" search={false}
        actions={(
          <MenuSelect variant="project" label="Project" heading="Project" value={project}
            onChange={(id) => { setProject(id); rememberProject(id); }}
            options={projectOptions} align="right" menuWidth={280} disabled={!projects} />
        )} />
      <div className="cx-start centered">
        {projectsError && <div className="cx-banner bad"><b>Couldn&apos;t load projects.</b><span className="cx-s12">{projectsError}</span></div>}
        <h2>What letter would you like to write?</h2>
        <p className="cx-start-sub">Choose the project, letter type, tone and length, then describe the letter.</p>

        <div className="cx-composer">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Describe the letter you need: who it is to, what it is about and what it should ask for…"
            aria-label="Describe the letter you need" />
          <div className="cx-composer-bar">
            <MenuSelect label="Letter type" heading="Letter category" value={options.type} onChange={set('type')} menuWidth={300}
              options={LETTER_TYPES.map((t) => ({ id: t.id, label: t.label }))} />
            <MenuSelect label="Tone" heading="Tone of letter" value={options.tone} onChange={set('tone')} options={TONES} />
            <MenuSelect label="Length" heading="Response length" value={options.length} onChange={set('length')} options={LENGTHS} />
            <span className="cx-spacer" />
            <button type="button" className="cx-send" disabled title="Drafting a new letter is coming soon" aria-label="Draft the letter (coming soon)">
              <img src={sendIcon} alt="" />
            </button>
          </div>
        </div>
        <div className="cx-banner info" style={{ width: 820, maxWidth: '100%' }}>
          <span className="cx-s12"><b>Coming soon.</b> Drafting a new letter isn&apos;t available yet. To answer a letter, use Draft a reply.</span>
        </div>
      </div>
    </>
  );
}
