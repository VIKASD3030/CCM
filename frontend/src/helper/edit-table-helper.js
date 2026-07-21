import React, { useState } from 'react';
import moment from 'moment';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import LoginState from '../authentication/loginState';
import { Pagination, Scroll } from '../helper/table-helper';
var parentData = [];

const EditableCell = ({
  editing,
  dataIndex,
  dataSource,
  title,
  inputType,
  record,
  index,
  children,
  ...restProps
}) => {
  let inputNode = <TextField size="small" fullWidth />;

  if (inputType === 'select' && dataIndex === 'ActivityId') {
    inputNode = (
      <TextField select size="small" fullWidth defaultValue="">
        <MenuItem value="">Select activity</MenuItem>
        <MenuItem value="1">Activity 1</MenuItem>
        <MenuItem value="2">Activity 2</MenuItem>
        <MenuItem value="3">Activity 3</MenuItem>
      </TextField>
    );
  }

  if (inputType === 'select' && dataIndex === 'ActionId') {
    inputNode = (
      <TextField select size="small" fullWidth defaultValue="">
        <MenuItem value="">Select action</MenuItem>
        <MenuItem value="Immediate Action">Immediate Action</MenuItem>
        <MenuItem value="Root Cause Analysis">Root Cause Analysis</MenuItem>
        <MenuItem value="Corrective Action">Corrective Action</MenuItem>
        <MenuItem value="Preventive Action">Preventive Action</MenuItem>
      </TextField>
    );
  }

  if (inputType === 'select' && dataIndex === 'AuditeeId') {
    inputNode = (
      <TextField select size="small" fullWidth defaultValue="">
        <MenuItem value="">Select auditee</MenuItem>
        <MenuItem value="Auditee 1">Auditee 1</MenuItem>
        <MenuItem value="Auditee 2">Auditee 2</MenuItem>
        <MenuItem value="Auditee 3">Auditee 3</MenuItem>
      </TextField>
    );
  }

  if (inputType === 'select' && dataIndex === 'ActionBy') {
    inputNode = (
      <TextField select size="small" fullWidth defaultValue="">
        <MenuItem value="">Select employee</MenuItem>
        <MenuItem value="Employee 1">Employee 1</MenuItem>
        <MenuItem value="Employee 2">Employee 2</MenuItem>
        <MenuItem value="Employee 3">Employee 3</MenuItem>
      </TextField>
    );
  }

  if (inputType === 'select' && dataIndex === 'ApproverId') {
    inputNode = (
      <TextField select size="small" fullWidth defaultValue="">
        <MenuItem value="">Select Approver</MenuItem>
        {(Array.isArray(dataSource) ? dataSource : []).map((item, i) => (
          <MenuItem key={i} value={item.value || item}>{item.label || item}</MenuItem>
        ))}
      </TextField>
    );
  }

  if (inputType === 'date') {
    inputNode = <TextField size="small" type="date" sx={{ minWidth: 130 }} InputLabelProps={{ shrink: true }} />;
  }

  if (inputType === 'switch') {
    inputNode = <Switch size="small" />;
    return (
      <TableCell {...restProps}>
        {editing ? <div style={{ margin: 0 }}>{inputNode}</div> : children}
      </TableCell>
    );
  } else {
    return (
      <TableCell {...restProps}>
        {editing ? <div style={{ margin: 0 }}>{inputNode}</div> : children}
      </TableCell>
    );
  }
};

const EditableTable = (props) => {
  const [data, setData] = useState(props.originData || []);
  const [editingKey, setEditingKey] = useState('');
  const [loading, setloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const isEditing = record => record.key === editingKey;

  const addRow = async () => {
    let count = data.length;
    const filterData = data.filter(d => d.key == count);
    const fildata = filterData[0];

    var validateRow = true;
    let r = 0;
    for (var key in fildata) {
      if (props.requiredField[r]) {
        if (fildata[key] == null || fildata[key] == '' || fildata[key] == undefined) {
          validateRow = false;
          break;
        }
      }
      r++;
    }
    if (validateRow) {
      const newData = [...data];
      props.newRow.key = count + 1;
      props.newRow.ApprovalLevel = count + 1;
      newData.push(props.newRow);
      setData(newData);
      setEditingKey(props.newRow.key);
    }
  };

  const deleteRow = key => {
    const dataSource = [...data];
    const leftData = dataSource.filter(item => item.key !== key);
    setData(leftData);
  };

  const editRow = record => {
    setEditingKey(record.key);
  };

  const cancel = () => {
    setEditingKey('');
  };

  const save = async key => {
    setEditingKey('');
  };

  const saveData = async (status) => {
    // Save logic handled by parent
  };

  const checkEmptyRow = () => {
    let childData = [...data];
    let validateRow = true;
    if (childData.length == 0) {
      return false;
    }
    var obj;
    for (var i = 0; i < childData.length; i++) {
      obj = childData[i];
      let r = 0;
      for (var key in obj) {
        if (props.requiredField[r]) {
          if (obj[key] == null || obj[key] == '' || obj[key] == undefined) {
            validateRow = false;
            break;
          }
        }
        r++;
      }
    }
    return validateRow;
  };

  const checkParentFields = (pdata, reqFields) => {
    let r = 0;
    let validateParent = true;
    for (let key in pdata) {
      if (reqFields[r]) {
        if (key != 'ApplicablePercentage') {
          if (key != 'Remarks') {
            if (pdata[key] == null || pdata[key] == '' || pdata[key] == undefined) {
              validateParent = false;
              break;
            }
          } else {
            if (pdata[key] == null || pdata[key] == '' || pdata[key] == undefined) {
              validateParent = false;
              break;
            }
          }
        }
      }
      r++;
    }
    return validateParent;
  };

  const resetData = () => {
    let cleardata = [];
    setData(cleardata);
  };

  const columns = [];

  let actionButtons = {
    title: 'Action',
    dataIndex: 'Action',
    width: 80,
    render: (_, record) => {
      const editable = isEditing(record);
      return editable ? (
        <span>
          <Tooltip title="Save record">
            <IconButton size="small" color="primary" onClick={() => save(record.key)}>
              <SaveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Cancel">
            <IconButton size="small" color="error" onClick={cancel}>
              <CancelIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </span>
      ) : (
        <span>
          <Tooltip title="Edit record">
            <span>
              <IconButton size="small" color="primary" disabled={editingKey !== ''} onClick={() => editRow(record)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete record">
            <span>
              <IconButton size="small" color="error" disabled={editingKey !== ''} onClick={() => deleteRow(record.key)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </span>
      );
    },
  };
  columns.push(actionButtons);

  for (let i = 0; i < props.columns.length; i++) {
    columns.push(props.columns[i]);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{props.title}</Typography>

        <Button variant="contained" startIcon={<AddIcon />} onClick={() => addRow()} sx={{ mb: 2 }}>
          Add Details
        </Button>

        <TableContainer sx={{ maxHeight: Scroll.y }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map((col, i) => (
                  <TableCell key={i} sx={{ fontWeight: 600, bgcolor: '#F3F5FA' }}>
                    {col.title}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((record, rowIndex) => (
                <TableRow key={record.key || rowIndex}>
                  {columns.map((col, colIndex) => {
                    if (col.render) {
                      return (
                        <TableCell key={colIndex}>
                          {col.render(null, record)}
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={colIndex}>
                        {editingKey === record.key ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={record[col.dataIndex] || ''}
                            onChange={(e) => {
                              const newData = [...data];
                              const idx = newData.findIndex(item => item.key === record.key);
                              if (idx > -1) {
                                newData[idx] = { ...newData[idx], [col.dataIndex]: e.target.value };
                                setData(newData);
                              }
                            }}
                          />
                        ) : (
                          record[col.dataIndex]
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No data yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => saveData(0)}>Save as draft</Button>
          <Button variant="contained" onClick={() => saveData(1)}>Save</Button>
          <Button variant="outlined" onClick={() => resetData()}>Reset</Button>
        </div>
      </Paper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <Typography>Are you sure?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { setConfirmOpen(false); if (pendingAction) pendingAction(); }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export { EditableTable };
