import React, { Component } from 'react';
import moment from 'moment';
import { Button, Tooltip } from '@mui/material';
import { PictureAsPdf } from '@mui/icons-material';
import html2canvas from 'html2canvas';
import jsPDF from "jspdf";

class ReportFooter extends Component {
  constructor(props) {
    super(props);
  }

  addFooters = doc => {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setTextColor("black");
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    for (var i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text('Page ' + String(i) + ' of ' + String(pageCount), doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, {
        align: 'center'
      });
      doc.text(moment().format('YYYY-MM-DD HH:mm:ss'), doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 10, { align: 'right' });
    }
  }

  jsToPdfOnePage = () => {
    var el = document.querySelector("#jspdf");
    el.style.border = "1px solid #c8ced3";

    html2canvas(el, { scale: "10" }).then(canvas => {
      const imgData = canvas.toDataURL('image/jpeg');
      const unit = "pt";
      const size = "A4";
      const orientation = this.props?.orientation ? this.props?.orientation : "portrait";

      const pdf = new jsPDF(orientation, unit, size);

      if (this.props?.reportHeader != 'NA') {
        pdf.setFontSize(10);
        pdf.text(this.props?.reportHeader ? this.props?.reportHeader : 'Report Details', 10, 10);
        pdf.setTextColor("red");
        pdf.text("SYSTRA", pdf.internal.pageSize.width - 10, 10, { align: 'right' });
      }

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'jpeg', 10, 15, pdfWidth - 20, pdfHeight - 30);
      this.addFooters(pdf);
      pdf.save(this.props?.fileName ? this.props?.fileName : 'Report');
    });
  }

  jsToPdf = () => {
    var el = document.querySelector("#jspdf");
    if (this.props?.border != "none")
      el.style.border = "1px solid #c8ced3";

    html2canvas(el, { scale: "5" }).then(canvas => {
      const unit = "pt";
      const size = "A4";
      const orientation = this.props?.orientation ? this.props?.orientation : "portrait";
      const pdf = new jsPDF(orientation, unit, size);

      if (this.props?.reportHeader != 'NA') {
        pdf.setFontSize(10);
        pdf.text(this.props?.reportHeader ? this.props?.reportHeader : 'Report Details', 10, 10);
        pdf.setTextColor("red");
        pdf.text("SYSTRA", pdf.internal.pageSize.width - 10, 10, { align: 'right' });
      }

      var contentWidth = canvas.width;
      var contentHeight = canvas.height;
      var pageHeight = contentWidth / 592.28 * 841.89;
      var leftHeight = contentHeight;
      var position = 15;
      var imgWidth = 595.28;
      var imgHeight = 592.28 / contentWidth * contentHeight;
      var pageData = canvas.toDataURL('image/jpeg');

      if (leftHeight < pageHeight) {
        pdf.addImage(pageData, 'JPEG', 10, 15, imgWidth - 20, imgHeight - 30);
        this.addFooters(pdf);
      } else {
        while (leftHeight > 0) {
          pdf.addImage(pageData, 'JPEG', 10, position, imgWidth - 20, imgHeight - 60);
          this.addFooters(pdf);
          leftHeight -= pageHeight;
          position -= 826.89;
          if (leftHeight > 0) {
            pdf.addPage();
          }
        }
      }

      pdf.save(this.props?.fileName ? this.props?.fileName : 'Report');
    });
  }

  jsToPdfNew = () => {
    var el = document.querySelector("#jspdf");
    el.style.border = "1px solid #c8ced3";
    var fileName = this.props?.fileName ? this.props?.fileName : 'Report';

    html2canvas(el, {
      logging: false,
      background: '#fff',
      allowTaint: true,
      taintTest: false,
      async: false
    }).then(function (canvas) {
      var contentWidth = canvas.width;
      var contentHeight = canvas.height;
      var pageHeight = contentWidth / 592.28 * 841.89;
      var leftHeight = contentHeight;
      var position = 0;
      var imgWidth = 595.28;
      var imgHeight = 592.28 / contentWidth * contentHeight;
      var pageData = canvas.toDataURL('image/jpeg', 1.0);
      var pdf = new jsPDF('', 'pt', 'a4');

      if (leftHeight < pageHeight) {
        // single page
      } else {
        while (leftHeight > 0) {
          pdf.addImage(pageData, 'JPEG', 0, position, imgWidth, imgHeight);
          leftHeight -= pageHeight;
          position -= 841.89;
          if (leftHeight > 0) {
            pdf.addPage();
          }
        }
      }
      pdf.save(fileName);
    });
  }

  render() {
    return (
      <span style={{ display: 'flex', flexDirection: 'row-reverse', height: 12 }}>
        <Tooltip title="Download PDF">
          <Button
            style={{ marginTop: -6, alignItems: 'center', justifyContent: 'center' }}
            size="small"
            onClick={this.jsToPdf}
          >
            <PictureAsPdf sx={{ fontSize: '20px', color: 'red' }} />
          </Button>
        </Tooltip>
      </span>
    );
  }
}

export default ReportFooter;
