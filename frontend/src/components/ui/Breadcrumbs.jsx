// Reusable breadcrumb navigation — enterprise style.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

const routeLabels = {
  '/master': 'Masters',
  '/master/dashboard': 'Dashboard',
  '/master/project-master': 'Projects',
  '/master/department-master': 'Departments',
  '/master/designation-master': 'Designations',
  '/master/role-master': 'Roles',
  '/master/user-master': 'Users',
  '/master/user-role-master': 'User Roles',
  '/master/role-right-master': 'Role Rights',
  '/master/module-group-master': 'Module Groups',
  '/master/module-master': 'Modules',
  '/master/view-user-logs': 'User Logs',
  '/master/view-user-errors': 'User Errors',
  '/master/ai-drafting': 'AI Drafting',
};

export default function AppBreadcrumbs({ items }) {
  const location = useLocation();

  const crumbs = items || (() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((part, i) => {
      const path = '/' + parts.slice(0, i + 1).join('/');
      const label = routeLabels[path] || part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const isLast = i === parts.length - 1;
      return { label, path: isLast ? null : path };
    });
  })();

  if (!crumbs || crumbs.length === 0) return null;

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />}
      sx={{ mb: 2 }}
    >
      <Typography
        component={Link}
        to="/master/dashboard"
        sx={{
          fontSize: 14,
          color: '#6B7280',
          textDecoration: 'none',
          fontWeight: 500,
          transition: 'color 0.15s',
          '&:hover': { color: '#1E3A8A' },
        }}
      >
        Dashboard
      </Typography>
      {crumbs.map((crumb, i) => {
        const isLast = !crumb.path;
        return isLast ? (
          <Typography key={i} sx={{ fontSize: 14, color: '#111827', fontWeight: 700 }}>
            {crumb.label}
          </Typography>
        ) : (
          <Typography
            key={i}
            component={Link}
            to={crumb.path}
            sx={{
              fontSize: 14,
              color: '#6B7280',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'color 0.15s',
              '&:hover': { color: '#1E3A8A' },
            }}
          >
            {crumb.label}
          </Typography>
        );
      })}
    </Breadcrumbs>
  );
}
