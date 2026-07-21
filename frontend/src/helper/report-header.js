import React, { Component } from 'react';
import { CardHeader } from '@mui/material';

class ReportHeader extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <CardHeader
        sx={{ p: '10px 16px !important' }}
        title={
          <div style={{ height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ float: 'left', height: 12 }}>
              <img alt='' style={{ height: 12 }} src="/img/logo.png" />
            </span>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <strong> {this.props.headername} </strong>
            </span>
          </div>
        }
      />
    );
  }
}

export default ReportHeader;
