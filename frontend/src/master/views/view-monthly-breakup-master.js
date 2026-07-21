import React, { Component } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { MONTHS } from '../../helper/constants';
import { AppDataGrid } from '../../components/ui';

class ViewMonthlyBreakUp extends Component {
  constructor(props) {
    super(props);
  }

  setMonth = (monthId) => {
    const monthDetails = MONTHS?.filter((r) => r.MonthId === monthId);
    return monthDetails[0]?.MonthName || monthId;
  };

  marginWithPercentage(value) {
    return value + '%';
  }

  render() {
    const { monthlyBreakUp, monthlyBreakUpDetails } = this.props;

    const gridColumns = [
      {
        field: 'MonthId', headerName: 'Month', width: 120,
        renderCell: (params) => <span>{this.setMonth(params.row.MonthId)}</span>,
      },
      { field: 'Invoice', headerName: 'Invoice', type: 'number', align: 'right', headerAlign: 'right', width: 130 },
      { field: 'Cost', headerName: 'Cost', type: 'number', align: 'right', headerAlign: 'right', width: 120 },
      {
        field: 'RevisedMargin', headerName: 'Revised Margin', type: 'number', align: 'right', headerAlign: 'right', width: 140,
        renderCell: (params) => <span>{this.marginWithPercentage(params.row.RevisedMargin)}</span>,
      },
      { field: 'Collection', headerName: 'Collection', type: 'number', align: 'right', headerAlign: 'right', width: 130 },
      { field: 'Deduction', headerName: 'Deduction', type: 'number', align: 'right', headerAlign: 'right', width: 130 },
      { field: 'Remarks', headerName: 'Remarks', flex: 1, minWidth: 150 },
    ];

    const labelStyle = { fontWeight: 600, color: 'text.secondary', fontSize: 13 };
    const valueStyle = { color: 'text.primary', fontSize: 13 };

    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography sx={labelStyle}>Project Code</Typography>
            <Typography sx={valueStyle}>{monthlyBreakUp?.ProjectCode}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography sx={labelStyle}>Contract Name</Typography>
            <Tooltip title={monthlyBreakUp?.ContractName || ''}>
              <Typography sx={{ ...valueStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {monthlyBreakUp?.ContractName}
              </Typography>
            </Tooltip>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography sx={labelStyle}>Revision No.</Typography>
            <Typography sx={valueStyle}>{monthlyBreakUp?.RevisionNo}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography sx={labelStyle}>Year</Typography>
            <Typography sx={valueStyle}>{monthlyBreakUp?.YearId}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography sx={labelStyle}>Margin</Typography>
            <Typography sx={valueStyle}>{this.marginWithPercentage(monthlyBreakUp?.Margin)}</Typography>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography sx={labelStyle}>Remarks</Typography>
            <Typography sx={{ ...valueStyle, textAlign: 'justify' }}>{monthlyBreakUp?.Remarks}</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }}>
          <Typography variant="body2" color="success.main" fontWeight={600}>
            Monthly BreakUp Details
          </Typography>
        </Divider>

        <AppDataGrid
          rows={monthlyBreakUpDetails || []}
          columns={gridColumns}
          getRowId={(row) => row.MonthlyBreakUpDetailId || row.MonthId}
          showToolbar={false}
          height={350}
          emptyTitle="No monthly breakup details"
          emptyDescription="No data available."
        />
      </Box>
    );
  }
}

export default ViewMonthlyBreakUp;
