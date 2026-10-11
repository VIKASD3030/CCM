/**
 * Knowledge Base — every indexed document across projects, plus a search that
 * shows exactly what the drafting retrieval would find in a project folder.
 */
import React from 'react';
import CCM from '../ccm-api';
import {
  PageTop, Btn, Card, Chip, Kpi, Empty, Skeleton, DocStatus, go, ROUTES, FOLDERS, folderOf, timeAgo,
} from '../ui/kit';
import { UploadDocumentsModal } from '../ui/modals';

export default function KnowledgeBase() {
  const [docs, setDocs] = React.useState(null);
  const [stats, setStats] = React.useState(null);
  const [projects, setProjects] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [filterProject, setFilterProject] = React.useState('');
  const [filterFolder, setFilterFolder] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState(null);
  const [searching, setSearching] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [d, s, p] = await Promise.all([
        CCM.knowledge.list({ limit: 200, project_id: filterProject, document_type: filterFolder }),
        CCM.knowledge.stats(),
        CCM.projects.list(),
      ]);
      setDocs(d.documents || []);
      setStats(s);
      setProjects(p.projects || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [filterProject, filterFolder]);
  React.useEffect(() => { load(); }, [load]);

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await CCM.knowledge.search(query.trim(), 8, null, filterProject || null, filterFolder || null);
      setResults(res.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const projectName = (id) => projects.find((p) => p.id === id)?.name;
  const ccmProjects = projects.filter((p) => p.source === 'ccm');
  const types = stats?.document_types || {};

  return (
    <>
      <PageTop crumbs={[{ label: 'Home', to: ROUTES.dashboard }]} title="Knowledge Base"
        onSearch={(q) => { setQuery(q); }} searchPlaceholder="Search inside documents"
        actions={<Btn variant="primary" onClick={() => setUploading(true)}>Upload documents</Btn>} />
      <div className="cx-content">
        {error && <div className="cx-banner bad"><b>Something went wrong.</b><span className="cx-s12">{error}</span></div>}
        <div className="cx-kpis">
          {!stats ? [0, 1, 2, 3].map((i) => <div className="cx-kpi" key={i}><Skeleton h={50} /></div>) : (
            <>
              <Kpi label="Documents" value={stats.total_documents} note={`${stats.indexed_documents} indexed`} tone="ok" />
              {FOLDERS.map((f) => <Kpi key={f.key} label={f.label} value={types[f.key] || 0} note={f.hint} />)}
            </>
          )}
        </div>

        <Card title="Search the records drafts are built from">
          <form className="cx-toolbar" onSubmit={search}>
            <input className="cx-input cx-grow" style={{ minWidth: 220 }} value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. notice period for extension of time claims" aria-label="Search query" />
            <select className="cx-select inline" value={filterProject} onChange={(e) => setFilterProject(e.target.value)} aria-label="Project">
              <option value="">All my documents</option>
              {ccmProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="cx-select inline" value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} aria-label="Folder">
              <option value="">All folders</option>
              {FOLDERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <Btn variant="primary" type="submit" disabled={!query.trim() || searching}>{searching ? 'Searching…' : 'Search'}</Btn>
          </form>
          {results && (results.length === 0 ? <span className="cx-s12 cx-muted">No matching passages.</span> : results.map((r) => {
            const f = folderOf(r.document_type);
            return (
              <div className="cx-src" key={r.chunk_id}>
                <Chip tone={f?.tone || 'gray'}>{f?.tag || '–'}</Chip>
                <div className="cx-src-body">
                  <div className="cx-src-title">{r.filename}{r.clause_no ? ` · Clause ${r.clause_no}` : ''}</div>
                  <div className="cx-s12 cx-muted" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.chunk_text}</div>
                </div>
                <Chip tone="gray">{Math.round((r.similarity || 0) * 100)}%</Chip>
              </div>
            );
          }))}
        </Card>

        {!docs ? <Skeleton h={240} /> : docs.length === 0 ? (
          <div className="cx-table-wrap"><Empty title="No documents yet" action={<Btn variant="primary" onClick={() => setUploading(true)}>Upload documents</Btn>}>
            Upload contract volumes and letters into a project folder.
          </Empty></div>
        ) : (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Document</th><th>Project</th><th>Folder</th><th>Clauses</th><th>Chunks</th><th>Uploaded</th><th>Status</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className={d.project_id ? 'clickable' : ''}
                    onClick={() => d.project_id && go(ROUTES.project(d.project_id, d.document_type || 'overview'))}>
                    <td><div className="cx-ellipsis">{d.filename}</div></td>
                    <td>{projectName(d.project_id) || <span className="cx-muted">—</span>}</td>
                    <td>{folderOf(d.document_type) ? <Chip tone={folderOf(d.document_type).tone}>{folderOf(d.document_type).label}</Chip> : <Chip tone="gray">Unfiled</Chip>}</td>
                    <td className="num">{d.document_type === 'contract_volume' ? d.clause_count : '–'}</td>
                    <td className="num">{d.chunk_count}</td>
                    <td>{timeAgo(d.uploaded_at)}</td>
                    <td><DocStatus doc={d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {uploading && (
        <UploadDocumentsModal projects={projects} initialProjectId={filterProject} initialFolder={filterFolder || 'contract_volume'}
          onClose={() => { setUploading(false); load(); }} onUploaded={() => load()} />
      )}
    </>
  );
}
