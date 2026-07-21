import React, { Component } from 'react';
import moment from 'moment';
import {
  Box, Button, TextField, Grid, Card, CardContent, CardActions, Dialog, DialogContent,
  Typography, CircularProgress, Backdrop, Snackbar, Alert, IconButton
} from '@mui/material';
import { UploadFile, Close } from '@mui/icons-material';
import FileHelper from '../../helper/file-helper';
import { OBJECT, STRING } from '../../helper/common-utility';
import CommonUtilityController from '../controller/common-utility-controller';
import LoginState from '../../authentication/loginState';

class FileUpload extends Component {
  constructor(props) {
    super(props);
    this.fileInputRef = React.createRef();
    this.state = {
      loading: false,
      file: null,
      fileName: '',
      filePreview: '',
      remarks: '',
      snackbarOpen: false,
      snackbarMsg: '',
      snackbarSeverity: 'info',
      previewOpen: false,
    };
  }

  showSnackbar = (msg, severity = 'info') => {
    this.setState({ snackbarOpen: true, snackbarMsg: msg, snackbarSeverity: severity });
  };

  handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    this.setState({ file, fileName: file.name });
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => this.setState({ filePreview: ev.target.result });
      reader.readAsDataURL(file);
    } else {
      this.setState({ filePreview: '' });
    }
  };

  handleRemoveFile = () => {
    this.setState({ file: null, fileName: '', filePreview: '' });
    if (this.fileInputRef.current) this.fileInputRef.current.value = '';
  };

  handleUploadSubmit = async () => {
    let { dataKey, keyVal, api, fileProp, fileUploadSubmit } = this.props;
    let { file, remarks } = this.state;

    if (STRING.isNUllorEmpty(dataKey)) {
      this.showSnackbar('File Data is not available !!', 'warning');
      return;
    }
    if (STRING.isNUllorEmpty(keyVal)) {
      this.showSnackbar('File Data is not available !!', 'warning');
      return;
    }
    if (STRING.isNUllorEmpty(api)) {
      this.showSnackbar('API is not available !!', 'warning');
      return;
    }

    if (!file) {
      this.showSnackbar('Please select a file to upload', 'warning');
      return;
    }

    if (file.size > fileProp.size) {
      this.showSnackbar(`File Size should be less than ${fileProp.description}`, 'warning');
      this.handleRemoveFile();
      return;
    }

    let data = {};
    data[dataKey] = keyVal;
    data.Status = 1;
    data.CreatedBy = LoginState.UserId;
    data.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
    data.Remarks = remarks;
    data.file = file;

    let formData = new FormData();
    for (let key in data) {
      if (key === 'file') {
        formData.append('file', data[key]);
      } else {
        formData.append(key, data[key]);
      }
    }

    this.setState({ loading: true });
    await new CommonUtilityController()
      .saveUploadFile(api, formData)
      .then((result) => {
        this.setState({ loading: false });
        this.showSnackbar('File Uploaded successfully.', 'success');
        fileUploadSubmit();
      })
      .catch((error) => {
        this.setState({ loading: false });
        this.showSnackbar(error.toString(), 'error');
      });
  };

  render() {
    let { file, fileName, filePreview, remarks, loading, snackbarOpen, snackbarMsg, snackbarSeverity } = this.state;
    let { toggleUploadModal, fileProp } = this.props;

    return (
      <Box sx={{ mt: 5 }}>
        <Backdrop open={loading} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadFile />}
                  onClick={() => this.fileInputRef.current?.click()}
                >
                  Select File
                </Button>
                <input
                  ref={this.fileInputRef}
                  type="file"
                  hidden
                  accept={fileProp?.fileType}
                  onChange={this.handleFileSelect}
                />
                {fileName && (
                  <>
                    <Typography variant="body2" sx={{ flex: 1 }}>{fileName}</Typography>
                    <IconButton size="small" onClick={this.handleRemoveFile}>
                      <Close fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Upload Document *
              </Typography>
            </Grid>

            {filePreview && (
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Preview</Typography>
                <Box
                  sx={{ cursor: 'zoom-in' }}
                  onClick={() => this.setState({ previewOpen: true })}
                >
                  <img src={filePreview} alt="Preview" style={{ maxHeight: 200 }} />
                </Box>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Remarks"
                multiline
                rows={3}
                inputProps={{ maxLength: 4000 }}
                placeholder="Please enter remarks"
                value={remarks}
                onChange={(e) => this.setState({ remarks: e.target.value })}
              />
            </Grid>
          </Grid>

          <CardActions sx={{ mt: 2, gap: 1 }}>
            <Button size="small" variant="contained" onClick={this.handleUploadSubmit}>
              Submit
            </Button>
            <Button size="small" variant="outlined" onClick={toggleUploadModal}>
              Close
            </Button>
          </CardActions>
        </Card>

        <Dialog
          open={this.state.previewOpen}
          onClose={() => this.setState({ previewOpen: false })}
          maxWidth="sm"
          fullWidth
        >
          <DialogContent>
            <img src={filePreview} alt="Preview" style={{ width: '100%' }} />
          </DialogContent>
        </Dialog>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => this.setState({ snackbarOpen: false })}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={() => this.setState({ snackbarOpen: false })}
            severity={snackbarSeverity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {snackbarMsg}
          </Alert>
        </Snackbar>
      </Box>
    );
  }
}

export default FileUpload;
