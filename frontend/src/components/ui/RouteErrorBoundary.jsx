// Route-level error boundary: if a page throws during render, keep the app
// shell alive and show a recoverable fallback instead of a blank screen.
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface the real error to the console for debugging.
    console.error('Route render error:', error, info);
  }

  componentDidUpdate(prevProps) {
    // Reset the boundary when the route (resetKey) changes so navigating away recovers.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>
          <Alert
            severity="error"
            icon={<ReportProblemRoundedIcon />}
            sx={{ borderRadius: 2 }}
            action={
              <Button color="inherit" size="small" onClick={this.handleReload}>
                Retry
              </Button>
            }
          >
            <AlertTitle>Something went wrong on this page</AlertTitle>
            <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
              {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            </Typography>
          </Alert>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
