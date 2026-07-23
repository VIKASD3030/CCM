/**
 * Dashboard — Enterprise redesign using MUI + our design system tokens.
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  Card, CardContent, Box, Stack, Typography, Select, MenuItem, Button, Chip, Skeleton,
} from '@mui/material';
import {
  Inbox as InboxIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  MenuBook as MenuBookIcon,
  MailOutlined as MailIcon,
  CheckCircle as CheckIcon,
  Send as SendIcon,
  FolderOpen as FolderIcon,
  ArrowForward as ArrowIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import CCM from '../ccm-api';
import PageContainer from '../../components/ui/PageContainer';
import PageHeader from '../../components/ui/PageHeader';
import AppBreadcrumbs from '../../components/ui/Breadcrumbs';

const metricIcons = {
  total: InboxIcon,
  drafts: EditIcon,
  pending: ScheduleIcon,
  kb: MenuBookIcon,
};

const metricColors = {
  total: { color: '#1E3A8A', bg: '#EFF6FF' },
  drafts: { color: '#7C3AED', bg: '#F5F3FF' },
  pending: { color: '#D97706', bg: '#FFFBEB' },
  kb: { color: '#059669', bg: '#ECFDF5' },
};

const metricLabels = {
  total: 'Total Letters',
  drafts: 'Drafts Generated',
  pending: 'Pending Review',
  kb: 'KB Documents',
};

const pipelineColors = ['#1E3A8A', '#2563EB', '#7C3AED', '#059669', '#0EA5E9'];

const statusColors = {
  received: '#3B82F6',
  classified: '#8B5CF6',
  drafted: '#7C3AED',
  approved: '#22C55E',
  sent: '#0EA5E9',
  rejected: '#EF4444',
  pending: '#F59E0B',
};

class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: false,
      projects: [],
      currentProjectId: '',
      metrics: { total: 0, drafts: 0, pending: 0, kb: 0 },
      pipeline: [],
      letters: [],
      sync: [],
      activity: [],
    };
  }

  componentDidMount() {
    this.loadAll();
  }

  async loadProjects() {
    try {
      const data = await CCM.projects.list();
      const projects = data.projects || [];
      this.setState({ projects });
      return projects;
    } catch {
      this.setState({ projects: [] });
      return [];
    }
  }

  loadAll = async () => {
    this.setState({ loading: true, error: false });
    const projects = await this.loadProjects();
    const { currentProjectId } = this.state;
    const isMasterProject = currentProjectId && String(currentProjectId).startsWith('master-');

    try {
      const statsPromise = isMasterProject
        ? Promise.resolve({ total_letters: 0, total_drafts: 0, pending_review: 0, letters_by_status: {}, drafts_by_status: {}, recent_activity: [] })
        : CCM.review.dashboardStats();
      const kbStatsPromise = isMasterProject
        ? Promise.resolve({ total_documents: 0 })
        : CCM.knowledge.stats();

      const [stats, kbStats] = await Promise.all([statsPromise, kbStatsPromise]);

      const metrics = {
        total: stats.total_letters || 0,
        drafts: stats.total_drafts || 0,
        pending: stats.pending_review || 0,
        kb: kbStats.total_documents || 0,
      };

      const pipeline = [
        { label: 'Received', count: stats.total_letters || 0 },
        { label: 'Classified', count: (stats.letters_by_status && stats.letters_by_status.classified) || 0 },
        { label: 'Drafted', count: stats.total_drafts || 0 },
        { label: 'Approved', count: (stats.drafts_by_status && stats.drafts_by_status.approved) || 0 },
        { label: 'Sent', count: (stats.letters_by_status && stats.letters_by_status.sent) || 0 },
      ];

      const lettersRes = isMasterProject
        ? { letters: [] }
        : await CCM.letters.list();
      const letters = (lettersRes.letters || []).slice(0, 5);

      let sync = [];
      if (projects.length) {
        const syncData = await Promise.all(projects.map(p => {
          if (String(p.id).startsWith('master-')) return Promise.resolve(null);
          return CCM.projects.stats(p.id).catch(() => null);
        }));
        sync = projects.map((p, i) => ({ project: p, stats: syncData[i] }));
      }

      const activity = (stats.recent_activity || []).slice(0, 5);

      this.setState({ loading: false, metrics, pipeline, letters, sync, activity });
    } catch (e) {
      console.error('Dashboard error:', e);
      this.setState({ loading: false, error: true });
    }
  };

  setProject = (e) => {
    const projectId = e.target.value;
    this.setState({ currentProjectId: projectId }, () => this.loadAll());
  };

  fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  }

  render() {
    const { loading, error, projects, currentProjectId, metrics, pipeline, letters, sync, activity } = this.state;

    if (error) {
      return (
        <PageContainer>
          <Card sx={{ textAlign: 'center', py: 8 }}>
            <CardContent>
              <Typography variant="h5" sx={{ color: '#111827', fontWeight: 700, mb: 1 }}>Failed to load dashboard</Typography>
              <Button variant="contained" sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }} onClick={this.loadAll}>Retry</Button>
            </CardContent>
          </Card>
        </PageContainer>
      );
    }

    const maxPipeline = Math.max(...pipeline.map(s => s.count), 1);

    return (
      <PageContainer>
        <AppBreadcrumbs />
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your CCM system activity"
          actions={
            <Select
              size="small"
              value={currentProjectId}
              onChange={this.setProject}
              sx={{ minWidth: 200, borderRadius: 2, fontSize: 14, bgcolor: '#fff' }}
            >
              <MenuItem value="">All Projects</MenuItem>
              {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          }
        />

        {/* Metric cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
          {['total', 'drafts', 'pending', 'kb'].map((key) => {
            const Icon = metricIcons[key];
            const { color, bg } = metricColors[key];
            return (
              <motion.div key={key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card sx={{ position: 'relative', overflow: 'hidden', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: '16px 16px 0 0' } }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box>
                        <Typography variant="overline" sx={{ color: '#9CA3AF', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em' }}>{metricLabels[key]}</Typography>
                        <Typography variant="h2" sx={{ mt: 0.5, fontSize: 32, fontWeight: 700, color: '#111827' }}>
                          {loading ? <Skeleton width={60} /> : metrics[key]}
                        </Typography>
                      </Box>
                      <Box sx={{ width: 48, height: 48, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: bg, color, flexShrink: 0 }}>
                        <Icon sx={{ fontSize: 24 }} />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </Box>

        {/* Pipeline */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ color: '#111827', fontWeight: 700, fontSize: 16, mb: 2 }}>Pipeline</Typography>
            {loading ? (
              <Skeleton variant="rounded" height={56} />
            ) : (
              <Box sx={{ display: 'flex', gap: 0 }}>
                {pipeline.map((s, i) => (
                  <Box key={s.label} sx={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                    <Box sx={{ height: Math.max((s.count / maxPipeline) * 52, 4), bgcolor: pipelineColors[i], borderRadius: 1, mx: 0.5, transition: 'height 0.3s ease' }} />
                    <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#111827', mt: 1 }}>{s.count}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>{s.label}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Grid: Letters / Sync / Activity */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' }, gap: 2.5 }}>
          {/* Recent Letters */}
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2, borderBottom: '1px solid #F3F4F6' }}>
                <Typography variant="h6" sx={{ color: '#111827', fontWeight: 700, fontSize: 16 }}>Recent Letters</Typography>
                <Button size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />} onClick={() => { window.location.hash = '/master/ai-drafting'; }} sx={{ textTransform: 'none', fontSize: 12, color: '#2563EB', fontWeight: 600 }}>
                  Draft
                </Button>
              </Box>
              <Box sx={{ p: 0 }}>
                {loading ? (
                  <Stack spacing={0} p={2.5}>
                    {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={52} />)}
                  </Stack>
                ) : !letters.length ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <MailIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
                    <Typography sx={{ fontSize: 14, color: '#9CA3AF' }}>No letters yet</Typography>
                  </Box>
                ) : letters.map(l => (
                  <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.5, borderBottom: '1px solid #F3F4F6', '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: '#F8FAFC' } }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{l.sender || 'Unknown'}</Typography>
                      <Typography sx={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.filename || '—'}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#9CA3AF', mt: 0.25 }}>{this.fmtDate(l.received_at)}</Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={(l.status || '').replace('_', ' ')}
                      sx={{ height: 26, fontSize: 12, fontWeight: 600, borderRadius: '999px', bgcolor: `${statusColors[l.status] || '#3B82F6'}14`, color: statusColors[l.status] || '#3B82F6', border: `1px solid ${statusColors[l.status] || '#3B82F6'}30` }}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Sync Status */}
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 2, borderBottom: '1px solid #F3F4F6' }}>
                <SyncIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                <Typography variant="h6" sx={{ color: '#111827', fontWeight: 700, fontSize: 16 }}>Sync Status</Typography>
              </Box>
              <Box sx={{ p: 0 }}>
                {loading ? (
                  <Stack spacing={0} p={2.5}>
                    {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={52} />)}
                  </Stack>
                ) : !sync.length ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <FolderIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
                    <Typography sx={{ fontSize: 14, color: '#9CA3AF' }}>No projects configured</Typography>
                  </Box>
                ) : sync.map(({ project, stats }) => {
                  const lastSync = stats?.last_sync;
                  const ok = lastSync?.status === 'success';
                  const fail = lastSync?.status === 'failed';
                  return (
                    <Box key={project.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, borderBottom: '1px solid #F3F4F6', '&:last-child': { borderBottom: 'none' } }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ok ? '#22C55E' : fail ? '#EF4444' : '#9CA3AF', flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{project.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>
                          {lastSync?.last_synced_at ? new Date(lastSync.last_synced_at).toLocaleDateString() : 'Never synced'}
                          {lastSync?.files_synced !== undefined ? ` · ${lastSync.files_synced} files` : ''}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #F3F4F6' }}>
                <Typography variant="h6" sx={{ color: '#111827', fontWeight: 700, fontSize: 16 }}>Recent Activity</Typography>
              </Box>
              <Box sx={{ p: 0 }}>
                {loading ? (
                  <Stack spacing={0} p={2.5}>
                    {[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={48} />)}
                  </Stack>
                ) : !activity.length ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <ScheduleIcon sx={{ fontSize: 36, color: '#D1D5DB', mb: 1 }} />
                    <Typography sx={{ fontSize: 14, color: '#9CA3AF' }}>No activity yet</Typography>
                  </Box>
                ) : activity.map((a, i) => {
                  const time = a.timestamp ? new Date(a.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                  let dotColor = '#3B82F6';
                  if (a.action.includes('draft')) dotColor = '#7C3AED';
                  if (a.action.includes('approved')) dotColor = '#22C55E';
                  if (a.action.includes('received')) dotColor = '#F59E0B';
                  return (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2.5, py: 1.5, borderBottom: '1px solid #F3F4F6', '&:last-child': { borderBottom: 'none' } }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, mt: 0.75, flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#111827', textTransform: 'capitalize' }}>
                          {a.action.replace(/_/g, ' ')}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>
                          {a.entity_type || ''} · {time}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </PageContainer>
    );
  }
}

export default Dashboard;
