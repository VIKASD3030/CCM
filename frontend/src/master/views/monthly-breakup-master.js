import React, { Component } from 'react';
import moment from 'moment';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { fillSelectList } from '../../helper/common-utility'
import CommonUtilityController from "../../master/controller/common-utility-controller";
import { MONTHS_LIST, MONTHS, YEARS_LIST } from '../../helper/constants';
import LoginState from '../../../src/authentication/loginState'
import { DataCard } from '../../components/ui';

//child data grid constants
const newChildRow = {
    key: 0,
    MonthlyBreakUpMasterDetailsId: 0,
    MonthlyBreakUpMasterId: 0,
    MonthId: '',
    Invoice: '',
    Cost: '',
    RevisedMargin: '',
    Collection: '',
    Deduction: '',
    Remarks: '',
    CreatedBy: LoginState.UserId,
    CreatedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    LockedBy: LoginState.LockedBy,
    LockedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    SecurityId: LoginState.SecurityId
};

//set required child field as per sequence
const requiredChildFields = ["MonthId", "Invoice", "Cost", "RevisedMargin", "Collection", "Deduction"];
//---------------------------------------------------------------

class MonthlyBreakUp extends Component {

    constructor(props) {
        super(props);
        this.state = {
            projectCode: '',
            projectDataSource: [],
            monthlyBreakUp: {
                MonthlyBreakUpMasterId: 0,
                ProjectId: "",
                ContractId: "",
                EntryDate: "",
                RevisionNo: "",
                RevisionDate: "",
                YearId: new Date().getFullYear(),
                Margin: "",
                Remarks: "",
            },
            projectList: [],
            contractList: [],
            loading: false,
            monthlyBreakUpDetails: [],
            childData: [],
            editingKey: '',
            editingRow: null,
            buttonVisible: false,
            deleteDialogOpen: false,
            deleteKey: null,
            cancelDialogOpen: false,
            snackbar: { open: false, severity: 'success', message: '' },
        }
    }

    notify = (severity, message) => {
        this.setState({ snackbar: { open: true, severity, message } });
    };

    closeSnackbar = () => {
        this.setState((s) => ({ snackbar: { ...s.snackbar, open: false } }));
    };

    //load drop-down list
    componentDidMount() {
        this.getProjects();
    }

    //fetch projects
    async getProjects() {
        this.setState({ loading: true, });
        let reqData = {
            UserId: LoginState.UserId
        }
        await new CommonUtilityController().getProjects(reqData)
            .then(data => {
                this.setState({ loading: false, });
                if (data != undefined) {
                    //fill drop down list
                    let projectList = fillSelectList(data, "ProjectCode", 'ProjectMasterId');
                    this.setState({ projectList: projectList, projectDataSource: data });
                    //Edit mode
                    let { monthlyBreakUp } = this.props;
                    if (monthlyBreakUp != undefined) {
                        this.projectChange(monthlyBreakUp.ProjectId);
                        this.contractChange(monthlyBreakUp.ContractId);

                        this.setState({ monthlyBreakUp: monthlyBreakUp, childData: monthlyBreakUp.monthlyBreakUpDetails });
                        this.setState({ buttonVisible: true });
                    }
                }
            })
            .catch(error => {
                this.setState({ loading: false, });
                this.notify('error', error.toString());
            });
    }

    //fetch contracts
    getcontracts = async (data) => {
        this.setState({ loading: true, });
        await new CommonUtilityController().getContracts(data)
            .then(data => {
                this.setState({ loading: false, });
                if (data != undefined) {
                    //fill drop down list
                    let contractList = fillSelectList(data, "ContractName", 'ContractId');
                    this.setState({ contractList: contractList, contractDataSource: data });
                }
            })
            .catch(error => {
                this.setState({ loading: false, });
                this.notify('error', error.toString());
            });
    }

    updateState = (key, value) => {
        const { monthlyBreakUp } = this.state;
        monthlyBreakUp[key] = value;
        this.setState({ monthlyBreakUp: monthlyBreakUp });
    }

    projectChange = async (value) => {
        let projectDetails = this.state.projectDataSource?.filter(p => p.ProjectMasterId == value);
        projectDetails = projectDetails[0];
        this.setState({ projectCode: projectDetails?.ProjectCode, contractList: [] });
        var data = {
            "projectId": value,
            "contractorId": 0
        }
        if (value) {
            this.getcontracts(data);
        }
        this.updateState("ProjectId", value);
        this.updateState("ContractId", '');
    }

    contractChange=async (value)=> {          
          this.updateState("ContractId", value);          
      }

    onChangeUpdateState = (name, type) => (e) => {
        if (type == 'select' || type == 'date' || type == 'number') {
            this.updateState(name, e);
        }
        else {
            this.updateState(name, e.target.value);
        }
    }

    //--------child data grid---------------------------------------------
    setMonth = (monthId) => {
        let monthDetails = MONTHS?.filter(r => r.MonthId == monthId);
        return monthDetails[0]?.MonthName;
    }

    isEditing = (record) => record.key === this.state?.editingKey;

    handleSubmit = async (data) => {
        //alert(JSON.stringify(data)) 
        this.setState({ monthlyBreakUp: data });
        this.addRow();
    }

    addRow = () => {
        //verify if existing row is not empty
        if (this.checkEmptyRow()) {
            return false;
        }
        //add new row
        let { childData } = this.state;
        let data = [...childData];
        let count = data.length;
        let newRow = {
            key: parseInt(count) + 1,
            MonthlyBreakUpMasterDetailsId: 0,
            MonthlyBreakUpMasterId: 0,
            MonthId: '',
            Invoice: '',
            Cost: '',
            RevisedMargin: '',
            Collection: '',
            Deduction: '',
            Remarks: '',
            CreatedBy: LoginState.UserId,
            CreatedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
            LockedBy: LoginState.LockedBy,
            LockedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
            SecurityId: LoginState.SecurityId
        };
        data.push(newRow);
        this.setState({ childData: data, editingKey: parseInt(count) + 1, editingRow: { ...newRow }, buttonVisible: false });
    }

    cancel = () => {
        let { childData, editingKey } = this.state;
        // If the row has no MonthId yet (was just added), remove it
        const idx = childData.findIndex(item => item.key === editingKey);
        if (idx > -1 && !childData[idx].MonthlyBreakUpMasterDetailsId && !childData[idx].MonthId) {
            childData.splice(idx, 1);
        }
        this.setState({ buttonVisible: true, editingKey: '', editingRow: null, childData: [...childData] });
    };

    editRow = record => {
        this.setState({ editingKey: record.key, editingRow: { ...record }, buttonVisible: false });
    };

    save = async key => {
        try {
            let { childData, editingRow } = this.state;
            if (!editingRow) return;
            // Validate required fields
            for (const field of requiredChildFields) {
                if (editingRow[field] == null || editingRow[field] === '' || editingRow[field] === undefined) {
                    this.notify('error', `${field} is required`);
                    return;
                }
            }
            const newData = [...childData];
            const index = newData.findIndex(item => key === item.key);

            if (index > -1) {
                const item = newData[index];
                newData.splice(index, 1, { ...item, ...editingRow });
                this.setState({ childData: newData, editingKey: '', editingRow: null, buttonVisible: true });
            } else {
                newData.push(editingRow);
                this.setState({ childData: newData, editingKey: '', editingRow: null, buttonVisible: true });
            }
        } catch (errInfo) {
        }
    };

    deleteRow = key => {
        let { childData } = this.state;
        const dataSource = [...childData];
        const leftData = dataSource.filter(item => item.key !== key);
        this.setState({ childData: leftData });
        if (childData.length == 0)
            this.setState({ buttonVisible: false });
    };

    handleChildFieldChange = (field, value) => {
        this.setState((prev) => ({
            editingRow: { ...prev.editingRow, [field]: value }
        }));
    }

    checkEmptyRow = () => {
        let { childData } = this.state;
        childData = [...childData];
        let validateRow = false;
        var obj;
        for (var i = 0; i < childData.length; i++) {
            obj = childData[i];
            for (var key in obj) {
                if (requiredChildFields.includes(key)) {
                    if (obj[key] == null || obj[key] == '' || obj[key] == undefined) {
                        validateRow = true;
                        break;
                    }
                }
            }
        }

        return validateRow;
    }
    //-----------------------End of Child Data----------------------------------------------

    resetData = () => {
        this.setState({ childData: [], projectCode: '' });
        let monthlyBreakUp = {
            MonthlyBreakUpMasterId: 0,
            ProjectId: "",
            ContractId: "",
            EntryDate: "",
            RevisionNo: "",
            RevisionDate: "",
            YearId: "",
            Margin: "",
            Remarks: "",
            Status: 0
        }
        this.setState({ monthlyBreakUp, buttonVisible: false });
    }

    // save all data(Parent+Child)
    saveData = async (status) => {
        //verify if existing row is not empty
        if (this.checkEmptyRow()) {
            this.notify('error', 'Monthly BreakUp details is required !!');
            return false;
        }
        let { childData, monthlyBreakUp } = this.state;
        monthlyBreakUp.Status = status;
        monthlyBreakUp.CreatedBy = LoginState.UserId;
        monthlyBreakUp.CreatedDate = moment().format('YYYY-MM-DD HH:mm:ss');
        monthlyBreakUp.LockedBy = LoginState.LockedBy;
        monthlyBreakUp.LockedDate = moment().format('YYYY-MM-DD HH:mm:ss');
        monthlyBreakUp.SecurityId = LoginState.SecurityId;
        let finalData = {
            MonthlyBreakUp: monthlyBreakUp,
            MonthlyBreakUpDetails: [...childData]
        };

        //alert(JSON.stringify(finalData)); return;
        this.setState({ loading: true });
        await new CommonUtilityController().saveMonthlyBreakUpDetailsData(finalData)
            .then(() => {
                this.setState({ loading: false });
                this.notify('success', 'Data submit successfully.');
                let { closemonthlyBreakUpModal } = this.props;
                if (typeof closemonthlyBreakUpModal !== "undefined") {
                    closemonthlyBreakUpModal();
                }
                this.resetData();
            })
            .catch(error => {
                this.setState({ loading: false });
                this.notify('error', error.toString());
            });

    }

    calculateRevisedMargin = (value) => {
        value.RevisedMargin = value.Invoice > 0 ? (value.Invoice - value.Cost) / value.Invoice * 100 : ''
        return value.RevisedMargin + "%"
    }

    calculateCost = (value) => {
        const { monthlyBreakUp } = this.state;
        value.Cost = value.Invoice * (1 - (monthlyBreakUp.Margin / 100));
        return value.Cost
    }

    //-----------------------End of Parent + Child Data----------------------------------------------

    render() {

        const { monthlyBreakUp, projectList, contractList, loading, childData, editingKey, editingRow, deleteDialogOpen, deleteKey, cancelDialogOpen, snackbar } = this.state;

        const isEditing = (record) => record.key === editingKey;

        const childColumns = [
            { label: 'Month', field: 'MonthId', type: 'select', dataSource: MONTHS_LIST, required: true },
            { label: 'Invoice', field: 'Invoice', type: 'number', required: true, align: 'right' },
            { label: 'Cost', field: 'Cost', computed: true, align: 'right' },
            { label: 'Revised Margin', field: 'RevisedMargin', computed: true, align: 'right' },
            { label: 'Collection', field: 'Collection', type: 'number', required: true, align: 'right' },
            { label: 'Deduction', field: 'Deduction', type: 'number', required: true, align: 'right' },
            { label: 'Remarks', field: 'Remarks', type: 'text' },
        ];

        return (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <DataCard title="Monthly BreakUp">
                    <Box sx={{ p: 1 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Project Name" required select
                                    value={monthlyBreakUp.ProjectId || ''}
                                    onChange={(e) => { this.projectChange(e.target.value); }}
                                >
                                    <MenuItem value="">Select....</MenuItem>
                                    {projectList.map((opt) => (
                                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Contract Name" required select
                                    value={monthlyBreakUp.ContractId || ''}
                                    onChange={(e) => this.contractChange(e.target.value)}
                                >
                                    <MenuItem value="">Select....</MenuItem>
                                    {contractList.map((opt) => (
                                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                        </Grid>

                        <Grid container spacing={2} sx={{ mt: 0 }}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Entry Date" required type="date"
                                    value={monthlyBreakUp.EntryDate || ''}
                                    onChange={(e) => this.updateState('EntryDate', e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Revision No." required
                                    value={monthlyBreakUp.RevisionNo || ''}
                                    onChange={(e) => this.updateState('RevisionNo', e.target.value)}
                                />
                            </Grid>
                        </Grid>

                        <Grid container spacing={2} sx={{ mt: 0 }}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Revision Date" required type="date"
                                    value={monthlyBreakUp.RevisionDate || ''}
                                    onChange={(e) => this.updateState('RevisionDate', e.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Year" required select
                                    value={monthlyBreakUp.YearId || ''}
                                    onChange={(e) => this.updateState('YearId', e.target.value)}
                                >
                                    <MenuItem value="">Select....</MenuItem>
                                    {YEARS_LIST.map((item) => (
                                        <MenuItem key={item.value || item} value={item.value || item}>{item.label || item}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                        </Grid>

                        <Grid container spacing={2} sx={{ mt: 0 }}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Margin" required type="number"
                                    value={monthlyBreakUp.Margin || ''}
                                    onChange={(e) => this.updateState('Margin', e.target.value)}
                                    inputProps={{ min: 0, max: 100 }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth size="small" label="Remarks" multiline rows={2}
                                    value={monthlyBreakUp.Remarks || ''}
                                    onChange={(e) => this.updateState('Remarks', e.target.value)}
                                    inputProps={{ maxLength: 4000 }}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 1 }}>
                            <MuiButton variant="contained" size="small" onClick={this.addRow}>Add Details</MuiButton>
                        </Box>
                    </Box>

                    <Paper variant="outlined" sx={{ mt: 3, p: 1.5 }}>
                        <TableContainer>
                            <Table size="small" bordered>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, width: 80 }}>Action</TableCell>
                                        {childColumns.map((col) => (
                                            <TableCell key={col.field} sx={{ fontWeight: 600 }} align={col.align || 'left'}>{col.label}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {childData.map((row) => {
                                        const editing = isEditing(row);
                                        const rowValues = editing && editingRow ? editingRow : row;
                                        return (
                                            <TableRow key={row.key}>
                                                <TableCell>
                                                    <Stack direction="row" spacing={0.5}>
                                                        {editing ? (
                                                            <>
                                                                <Tooltip title="Save">
                                                                    <span>
                                                                        <IconButton size="small" color="primary" onClick={() => this.save(row.key)}>
                                                                            <SaveIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                                <Tooltip title="Cancel">
                                                                    <span>
                                                                        <IconButton size="small" color="warning" onClick={() => this.cancel()}>
                                                                            <CloseIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Tooltip title="Edit">
                                                                    <span>
                                                                        <IconButton size="small" color="primary" disabled={editingKey !== ''} onClick={() => this.editRow(row)}>
                                                                            <EditIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                                <Tooltip title="Delete">
                                                                    <span>
                                                                        <IconButton size="small" color="error" disabled={editingKey !== ''} onClick={() => this.setState({ deleteDialogOpen: true, deleteKey: row.key })}>
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            </>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                                {childColumns.map((col) => {
                                                    if (col.computed) {
                                                        let displayValue = '';
                                                        if (col.field === 'Cost') {
                                                            displayValue = this.calculateCost(row);
                                                        } else if (col.field === 'RevisedMargin') {
                                                            displayValue = this.calculateRevisedMargin(row);
                                                        }
                                                        return <TableCell key={col.field} align={col.align || 'left'}>{displayValue}</TableCell>;
                                                    }
                                                    if (editing) {
                                                        if (col.type === 'select') {
                                                            return (
                                                                <TableCell key={col.field}>
                                                                    <TextField select size="small" fullWidth value={rowValues[col.field] || ''}
                                                                        onChange={(e) => this.handleChildFieldChange(col.field, e.target.value)}>
                                                                        <MenuItem value="">Select....</MenuItem>
                                                                        {(col.dataSource || []).map((item, i) => (
                                                                            <MenuItem key={i} value={item.value || item}>{item.label || item}</MenuItem>
                                                                        ))}
                                                                    </TextField>
                                                                </TableCell>
                                                            );
                                                        }
                                                        return (
                                                            <TableCell key={col.field}>
                                                                <TextField size="small" fullWidth type={col.type === 'number' ? 'number' : 'text'}
                                                                    value={rowValues[col.field] || ''}
                                                                    onChange={(e) => this.handleChildFieldChange(col.field, e.target.value)}
                                                                />
                                                            </TableCell>
                                                        );
                                                    }
                                                    return <TableCell key={col.field} align={col.align || 'left'}>{row[col.field]}</TableCell>;
                                                })}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                            <MuiButton variant="outlined" color="primary" size="small" title="save record for edit in future" disabled={!this.state?.buttonVisible} onClick={() => this.saveData(0)}>Save as draft</MuiButton>
                            <MuiButton variant="contained" color="primary" size="small" title="save record (not editable)" disabled={!this.state?.buttonVisible} onClick={() => this.saveData(1)}>Save</MuiButton>
                        </Stack>
                    </Paper>
                </DataCard>

                <Dialog open={deleteDialogOpen} onClose={() => this.setState({ deleteDialogOpen: false, deleteKey: null })}>
                    <DialogTitle>Sure to delete?</DialogTitle>
                    <DialogActions>
                        <MuiButton onClick={() => this.setState({ deleteDialogOpen: false, deleteKey: null })}>Cancel</MuiButton>
                        <MuiButton color="error" onClick={() => { this.deleteRow(deleteKey); this.setState({ deleteDialogOpen: false, deleteKey: null }); }}>Delete</MuiButton>
                    </DialogActions>
                </Dialog>

                <Dialog open={cancelDialogOpen} onClose={() => this.setState({ cancelDialogOpen: false })}>
                    <DialogTitle>Sure to cancel?</DialogTitle>
                    <DialogActions>
                        <MuiButton onClick={() => this.setState({ cancelDialogOpen: false })}>No</MuiButton>
                        <MuiButton color="warning" onClick={() => { this.cancel(); this.setState({ cancelDialogOpen: false }); }}>Yes</MuiButton>
                    </DialogActions>
                </Dialog>

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
            </Box>
        )
    }
}
export default MonthlyBreakUp;