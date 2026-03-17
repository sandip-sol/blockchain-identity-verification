const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PROOF_BLOCK_MARGIN = 38;
const PROOF_BLOCK_HEIGHT = 198;
const PROOF_BLOCK_MIN_CONTENT_TOP = 240;

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

function drawDivider(page, { x, y, width }) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1,
    color: rgb(0.87, 0.9, 0.95),
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
  signaturePngBytes,
}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error('PDF has no pages');

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const originalLastPage = pages[pages.length - 1];
  const { width, height } = originalLastPage.getSize();

  let proofPage = originalLastPage;
  const proofBlockTop = PROOF_BLOCK_MARGIN + PROOF_BLOCK_HEIGHT;
  if (height - proofBlockTop < PROOF_BLOCK_MIN_CONTENT_TOP) {
    proofPage = pdfDoc.addPage([width, height]);
    proofPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });
  }

  const block = {
    x: PROOF_BLOCK_MARGIN,
    y: PROOF_BLOCK_MARGIN,
    width: width - (PROOF_BLOCK_MARGIN * 2),
    height: 220,
  };

  proofPage.drawRectangle({
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    color: rgb(0.985, 0.989, 0.996),
    borderColor: rgb(0.84, 0.88, 0.93),
    borderWidth: 1,
  });

  proofPage.drawRectangle({
    x: block.x,
    y: block.y + block.height - 44,
    width: block.width,
    height: 44,
    color: rgb(0.06, 0.11, 0.2),
  });

  proofPage.drawText(proofBlock.label || 'Digitally Signed', {
    x: block.x + 18,
    y: block.y + block.height - 28,
    size: 16,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  proofPage.drawText(proofBlock.verificationStatusText || 'Verifiable on blockchain', {
    x: block.x + 18,
    y: block.y + block.height - 40,
    size: 8.5,
    font,
    color: rgb(0.8, 0.88, 0.96),
  });

  const statusBadge = {
    width: 116,
    height: 24,
    x: block.x + block.width - 132,
    y: block.y + block.height - 34,
  };

  proofPage.drawRectangle({
    x: statusBadge.x,
    y: statusBadge.y,
    width: statusBadge.width,
    height: statusBadge.height,
    color: proofBlock.transactionHash ? rgb(0.13, 0.38, 0.28) : rgb(0.44, 0.32, 0.08),
    borderColor: proofBlock.transactionHash ? rgb(0.27, 0.72, 0.48) : rgb(0.86, 0.67, 0.2),
    borderWidth: 0.8,
    borderRadius: 10,
  });

  proofPage.drawText(proofBlock.transactionHash ? 'ANCHOR VERIFIED' : 'ANCHOR PENDING', {
    x: statusBadge.x + 11,
    y: statusBadge.y + 8,
    size: 8,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  const signaturePanel = {
    x: block.x + 18,
    y: block.y + 26,
    width: 176,
    height: 118,
  };

  proofPage.drawRectangle({
    x: signaturePanel.x,
    y: signaturePanel.y,
    width: signaturePanel.width,
    height: signaturePanel.height,
    color: rgb(0.972, 0.978, 0.988),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  proofPage.drawText('Signer Signature', {
    x: signaturePanel.x + 12,
    y: signaturePanel.y + signaturePanel.height - 18,
    size: 8.5,
    font: boldFont,
    color: rgb(0.32, 0.38, 0.46),
  });

  if (signaturePngBytes) {
    const signatureImage = await pdfDoc.embedPng(signaturePngBytes);
    proofPage.drawImage(signatureImage, {
      x: signaturePanel.x + 12,
      y: signaturePanel.y + 34,
      width: signaturePanel.width - 24,
      height: 44,
    });
  } else {
    proofPage.drawText('Wallet-signed with no uploaded image', {
      x: signaturePanel.x + 12,
      y: signaturePanel.y + 54,
      size: 9,
      font,
      color: rgb(0.44, 0.48, 0.56),
    });
  }

  proofPage.drawText('Protected by account-level signature storage', {
    x: signaturePanel.x + 12,
    y: signaturePanel.y + 12,
    size: 7.5,
    font,
    color: rgb(0.5, 0.55, 0.62),
  });

  drawDivider(proofPage, {
    x: signaturePanel.x + 12,
    y: signaturePanel.y + 28,
    width: signaturePanel.width - 24,
  });

  const proofRows = [
    { label: 'Signer', value: proofBlock.signerDisplayName || proofBlock.signerAddress },
    { label: 'Signed at', value: proofBlock.signedAt },
    { label: 'Document hash', value: proofBlock.documentHash },
    { label: 'Network', value: proofBlock.blockchainNetwork },
    { label: 'Transaction', value: proofBlock.transactionHash || 'Pending blockchain anchor' },
    { label: 'Agreement ID', value: proofBlock.agreementId },
  ];

  drawKeyValueRows(proofPage, proofRows, {
    x: block.x + 214,
    startY: block.y + block.height - 70,
    width: block.width - 350,
    font,
    boldFont,
    rowGap: 20,
    valueOffset: 92,
  });

  if (qrPngBytes) {
    const qrImage = await pdfDoc.embedPng(qrPngBytes);
    proofPage.drawImage(qrImage, {
      x: block.x + block.width - 116,
      y: block.y + 30,
      width: 76,
      height: 76,
    });
  }

  proofPage.drawText('Scan to verify', {
    x: block.x + block.width - 110,
    y: block.y + 16,
    size: 8.5,
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

  const finalPdf = await pdfDoc.save();
  return Buffer.from(finalPdf);
}

module.exports = {
  stampSignature,
  addProofPages,
};
