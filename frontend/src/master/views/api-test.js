import React, { Component } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SendRoundedIcon from '@mui/icons-material/SendRounded';

import CommonUtilityController from '../controller/common-utility-controller';
import { PageContainer, PageHeader, DataCard } from '../../components/ui';

class APItest extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      loading: false,
      visible: false,
      text: '',
      formErrors: {},
      snackbar: { open: false, severity: 'success', message: '' },
    };
  }

  notify = (severity, message) => {
    this.setState({ snackbar: { open: true, severity, message } });
  };

  closeSnackbar = () => {
    this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
  };

  handleField = (event) => {
    const value = event && event.target ? event.target.value : event;
    this.setState({ text: value, formErrors: {} });
  };

  validateForm = () => {
    const errors = {};
    if (!String(this.state.text || '').trim()) errors.Text = 'Text is required';
    this.setState({ formErrors: errors });
    return Object.keys(errors).length === 0;
  };

  onFormSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!this.validateForm()) return;
    this.handleSubmit({ Text: this.state.text });
  };

  handleSubmit = async (value) => {
    const text = JSON.stringify(value.Text);
    /*
    if (text.toLowerCase().indexOf('delete') >= 0) {
        Modal.error({
            content: 'invalid',
        });
        return false;
    }
    if (text.toLowerCase().indexOf('insert') >= 0) {
        Modal.error({
            content: 'invalid',
        });
        return false;
    }*/
    this.setState({ loading: true });
    await new CommonUtilityController()
      .getTestApi(value)
      .then((data) => {
        this.setState({ loading: false });
        if (data != undefined) {
          alert(JSON.stringify(data));
          this.setState({ data: data, visible: false });
        }
        this.notify('success', 'Data successfully sent.');
      })
      .catch(() => {
        this.setState({ loading: false });
        this.notify('error', 'Data Fetching issue!');
      });
  };

  render() {
    const { loading, text, formErrors, snackbar } = this.state;

    return (
      <PageContainer>
        <PageHeader title="API Test" subtitle="Send a request payload and inspect the response" />

        <DataCard title="Request">
          <Box component="form" onSubmit={this.onFormSubmit} noValidate sx={{ p: 1 }}>
            <TextField
              label="Text"
              required
              multiline
              minRows={4}
              value={text || ''}
              onChange={this.handleField}
              error={!!formErrors.Text}
              helperText={formErrors.Text}
              placeholder="Enter API"
            />
            <Box sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" color="primary" startIcon={<SendRoundedIcon />}>
                Submit
              </Button>
            </Box>
          </Box>
        </DataCard>

        <Backdrop open={loading} sx={{ position: 'absolute', zIndex: (t) => t.zIndex.modal + 1 }}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={this.closeSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={this.closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </PageContainer>
    );
  }
}

export default APItest;
