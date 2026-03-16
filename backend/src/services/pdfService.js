const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Minimal PDF stamping for MVP.
 * We only support placing a PNG signature image on a given page + coordinates.
 */
async function stampSignature({
  pdfBytes,
  signaturePngBytes,
  pageIndex = 0,
  x = 50,
  y = 50,
  width = 160,
  height = 60,
  labelText = null,
}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error('PDF has no pages');
  const page = pages[Math.max(0, Math.min(pageIndex, pages.length - 1))];

  const pngImage = await pdfDoc.embedPng(signaturePngBytes);
  page.drawImage(pngImage, { x, y, width, height });

  // Optional label (e.g., DID + timestamp). Kept simple and readable.
  if (labelText) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 9;
    const labelX = x;
    const labelY = Math.max(0, y - 12);
    page.drawText(String(labelText), {
      x: labelX,
      y: labelY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(200, width * 2),
    });
  }

  const stamped = await pdfDoc.save();
  return Buffer.from(stamped);
}

module.exports = {
  stampSignature,
};
