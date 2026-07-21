import React, { Component } from 'react';
import moment from 'moment';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CardActions from '@mui/material/CardActions';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

class ReportPdfFooter extends Component {
  exportToExcel = async () => {
    const {
      tableData = [],
      columnHeader = [],
      excludedColumns = [],
      fileName = 'report.xlsx',
      statusColumn,
      statusData = []
    } = this.props;

    const exportData = JSON.parse(JSON.stringify(tableData));

    if (statusColumn) {
      exportData.forEach(item => {
        const match = statusData.find(s => s.Status === item[statusColumn]);
        if (match) item[statusColumn] = match.Description;
      });
    }

    const includedColumns = columnHeader.filter(col => !excludedColumns.includes(col.key));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    worksheet.addRow(includedColumns.map(col => col.title));

    exportData.forEach(row => {
      const rowData = includedColumns.map(col => row[col.key]);
      worksheet.addRow(rowData);
    });

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
    });

    includedColumns.forEach((col, index) => {
      const maxLength = Math.max(
        col.title.length,
        ...exportData.map(r => (r[col.key] ? r[col.key].toString().length : 0))
      );
      worksheet.getColumn(index + 1).width = maxLength + 5;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/octet-stream' }),
      fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
    );
  };

  addPdfFooters = (doc) => {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setTextColor("black");
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      doc.text(moment().format('YYYY-MM-DD HH:mm:ss'), doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10, { align: 'right' });
    }
  };

  exportToPdf = () => {
    const {
      tableHeader,
      columnHeader = [],
      excludedColumns = [],
      fileName = 'report.pdf',
      orientation = 'landscape',
      statusColumn,
      statusData = [],
      tableData = []
    } = this.props;

    const unit = 'pt';
    const size = 'A4';
    const marginLeft = 40;
    const doc = new jsPDF(orientation, unit, size);
    doc.setFontSize(10);

    doc.text(tableHeader || 'Report', marginLeft, 40);
    doc.setTextColor("red");
    doc.text("SYSTRA", doc.internal.pageSize.width - 40, 40, { align: 'right' });

    const columns = columnHeader
      .filter(col => !excludedColumns.includes(col.key))
      .map(col => ({ header: col.title, dataKey: col.key }));

    const tempTableData = JSON.parse(JSON.stringify(tableData));
    if (statusColumn) {
      tempTableData.forEach(obj => {
        obj[statusColumn] = statusData.find(s => s.Status === obj[statusColumn])?.Description || obj[statusColumn];
      });
    }

    const fontSize = orientation === 'landscape' ? 6 : 7;

    autoTable(doc, {
      startY: 50,
      showHead: 'everyPage',
      showFoot: 'everyPage',
      headStyles: {
        fontSize,
        halign: 'center',
        valign: 'middle',
        fillColor: [200, 200, 200],
        fontStyle: 'bold'
      },
      styles: {
        fontSize,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'middle'
      },
      body: tempTableData,
      columns,
      theme: 'grid'
    });

    this.addPdfFooters(doc);
    doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  };

  render() {
    return (
      <CardActions sx={{ display: 'flex', justifyContent: 'flex-end', p: '12px 20px !important' }}>
        <div className="export-buttons">
          <Tooltip title="Download PDF">
            <IconButton className="export-btn pdf" onClick={this.exportToPdf}>
              <PictureAsPdfIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download Excel">
            <IconButton className="export-btn excel" onClick={this.exportToExcel}>
              <TableChartIcon />
            </IconButton>
          </Tooltip>
        </div>
      </CardActions>
    );
  }
}

export default ReportPdfFooter;
