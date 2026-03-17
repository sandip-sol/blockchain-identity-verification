const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function drawKeyValueRows(page, rows, { x, startY, width, font, boldFont, rowGap = 18, valueOffset = 130 }) {
  let cursorY = startY;
  rows.forEach(({ label, value }) => {
    page.drawText(label, {
      x,
      y: cursorY,
      size: 10,
      font: boldFont,
      color: rgb(0.32, 0.38, 0.46),
    });

    page.drawText(String(value || '-'), {
      x: x + valueOffset,
      y: cursorY,
      size: 10,
      font,
      color: rgb(0.07, 0.1, 0.16),
      maxWidth: Math.max(120, width - valueOffset),
    });

    cursorY -= rowGap;
  });
}

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

async function addProofPages({
  pdfBytes,
  proofBlock,
  auditTrail,
  qrPngBytes,
}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error('PDF has no pages');

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  const block = {
    x: 38,
    y: 38,
    width: width - 76,
    height: 150,
  };

  lastPage.drawRectangle({
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    color: rgb(0.985, 0.989, 0.996),
    borderColor: rgb(0.79, 0.84, 0.9),
    borderWidth: 1,
  });

  lastPage.drawRectangle({
    x: block.x,
    y: block.y + block.height - 36,
    width: block.width,
    height: 36,
    color: rgb(0.08, 0.16, 0.29),
  });

  lastPage.drawText(proofBlock.label || 'Digitally Signed', {
    x: block.x + 16,
    y: block.y + block.height - 24,
    size: 15,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  lastPage.drawText(proofBlock.verificationStatusText || 'Verifiable on blockchain', {
    x: block.x + 170,
    y: block.y + block.height - 22,
    size: 10,
    font,
    color: rgb(0.82, 0.9, 0.98),
  });

  const proofRows = [
    { label: 'Signer', value: proofBlock.signerDisplayName || proofBlock.signerAddress },
    { label: 'Signed at', value: proofBlock.signedAt },
    { label: 'Document hash', value: proofBlock.documentHash },
    { label: 'Network', value: proofBlock.blockchainNetwork },
    { label: 'Transaction', value: proofBlock.transactionHash || 'Pending blockchain anchor' },
    { label: 'Agreement ID', value: proofBlock.agreementId },
  ];

  drawKeyValueRows(lastPage, proofRows, {
    x: block.x + 16,
    startY: block.y + block.height - 58,
    width: block.width - 170,
    font,
    boldFont,
    rowGap: 17,
    valueOffset: 96,
  });

  if (qrPngBytes) {
    const qrImage = await pdfDoc.embedPng(qrPngBytes);
    lastPage.drawImage(qrImage, {
      x: block.x + block.width - 118,
      y: block.y + 24,
      width: 82,
      height: 82,
    });
  }

  lastPage.drawText('Scan to verify', {
    x: block.x + block.width - 112,
    y: block.y + 10,
    size: 9,
    font: boldFont,
    color: rgb(0.32, 0.38, 0.46),
  });

  const auditPage = pdfDoc.addPage();
  const auditSize = auditPage.getSize();

  auditPage.drawRectangle({
    x: 0,
    y: 0,
    width: auditSize.width,
    height: auditSize.height,
    color: rgb(1, 1, 1),
  });

  auditPage.drawText('Proof of Signature Audit Trail', {
    x: 42,
    y: auditSize.height - 56,
    size: 18,
    font: boldFont,
    color: rgb(0.07, 0.1, 0.16),
  });

  auditPage.drawText('Machine-readable verification details for the completed agreement.', {
    x: 42,
    y: auditSize.height - 76,
    size: 10,
    font,
    color: rgb(0.32, 0.38, 0.46),
  });

  const auditRows = [
    { label: 'Document created', value: auditTrail.documentCreatedAt },
    { label: 'Document sent', value: auditTrail.documentSentAt || 'Not recorded' },
    { label: 'Signer viewed', value: auditTrail.signerViewedAt || 'Not recorded' },
    { label: 'Signer signed', value: auditTrail.signerSignedAt },
    { label: 'Signer wallet', value: auditTrail.signerWalletAddress },
    { label: 'IP address', value: auditTrail.ipAddress || 'Optional / not captured' },
    { label: 'Document hash', value: auditTrail.documentHash },
    { label: 'Transaction hash', value: auditTrail.transactionHash || 'Pending blockchain anchor' },
    { label: 'Chain / network', value: auditTrail.chain },
    { label: 'Agreement ID', value: auditTrail.agreementId },
    { label: 'Final status', value: auditTrail.finalStatus },
  ];

  drawKeyValueRows(auditPage, auditRows, {
    x: 42,
    startY: auditSize.height - 118,
    width: auditSize.width - 84,
    font,
    boldFont,
    rowGap: 24,
    valueOffset: 140,
  });

  auditPage.drawText(
    JSON.stringify(
      {
        agreementId: auditTrail.agreementId,
        documentHash: auditTrail.documentHash,
        transactionHash: auditTrail.transactionHash,
        chain: auditTrail.chain,
        signerWalletAddress: auditTrail.signerWalletAddress,
        signerSignedAt: auditTrail.signerSignedAt,
        finalStatus: auditTrail.finalStatus,
      },
      null,
      2
    ),
    {
      x: 42,
      y: 62,
      size: 9,
      font,
      color: rgb(0.32, 0.38, 0.46),
      lineHeight: 12,
      maxWidth: auditSize.width - 84,
    }
  );

  const finalPdf = await pdfDoc.save();
  return Buffer.from(finalPdf);
}

module.exports = {
  stampSignature,
  addProofPages,
};
