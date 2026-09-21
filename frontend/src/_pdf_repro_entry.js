import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
window.__pdfTest = { jsPDF, html2canvas };
window.dispatchEvent(new Event('pdftest-ready'));
