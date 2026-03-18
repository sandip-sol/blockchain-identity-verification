const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PROOF_BLOCK_MARGIN = 38;
const PROOF_BLOCK_HEIGHT = 198;
const PROOF_BLOCK_MIN_CONTENT_TOP = 240;

/**
 * Truncate long strings (hashes, addresses) for compact PDF display.
 * Shows first `head` + "…" + last `tail` characters.
 */
function truncateForPdf(str, head = 18, tail = 6) {
  if (!str) return '-';
  const s = String(str);
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

function drawKeyValueRows(page, rows, { x, startY, width, font, boldFont, rowGap = 18, valueOffset = 130 }) {
  let cursorY = startY;
  rows.forEach(({ label, value }) => {
    page.drawText(label, {
      x,
      y: cursorY,
      size: 9,
      font: boldFont,
      color: rgb(0.32, 0.38, 0.46),
    });

    const maxValWidth = Math.max(80, width - valueOffset - 4);
    page.drawText(String(value || '-'), {
      x: x + valueOffset,
      y: cursorY,
      size: 9,
      font,
      color: rgb(0.07, 0.1, 0.16),
      maxWidth: maxValWidth,
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

  /* Single new page for compact proof card + verification details */
  const proofPage = pdfDoc.addPage([width, height]);
  proofPage.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  const M = 38; // margin

  /* ================================================================
     Compact proof card: header bar + signature + QR   (height = 140)
     ================================================================ */
  const cardH = 140;
  const cardY = height - M - cardH;
  const cardW = width - M * 2;

  /* Card background */
  proofPage.drawRectangle({
    x: M, y: cardY, width: cardW, height: cardH,
    color: rgb(0.985, 0.989, 0.996),
    borderColor: rgb(0.84, 0.88, 0.93),
    borderWidth: 1,
  });

  /* Header bar (36px) – light premium style */
  const headerH = 36;
  proofPage.drawRectangle({
    x: M, y: cardY + cardH - headerH,
    width: cardW, height: headerH,
    color: rgb(0.96, 0.97, 0.98),
    borderColor: rgb(0.88, 0.9, 0.93),
    borderWidth: 0.5,
  });

  proofPage.drawText(proofBlock.label || 'Proof of Signature', {
    x: M + 14, y: cardY + cardH - 24,
    size: 9, font: boldFont, color: rgb(0.28, 0.31, 0.38),
  });

  proofPage.drawText(proofBlock.verificationStatusText || 'Blockchain-verified signature', {
    x: M + 14, y: cardY + cardH - 34,
    size: 7, font, color: rgb(0.58, 0.62, 0.7),
  });

  /* Status badge – subtle pill */
  const badgeW = 100;
  const badgeH = 16;
  const badgeX = M + cardW - badgeW - 12;
  const badgeY = cardY + cardH - headerH + (headerH - badgeH) / 2;
  const isVerified = !!proofBlock.transactionHash;
  proofPage.drawRectangle({
    x: badgeX, y: badgeY, width: badgeW, height: badgeH,
    color: isVerified ? rgb(0.92, 0.99, 0.96) : rgb(1, 0.98, 0.92),
    borderColor: isVerified ? rgb(0.72, 0.93, 0.82) : rgb(0.96, 0.85, 0.55),
    borderWidth: 0.6,
  });
  proofPage.drawText(isVerified ? 'ANCHOR VERIFIED' : 'ANCHOR PENDING', {
    x: badgeX + 8, y: badgeY + 5,
    size: 6.5, font: boldFont, color: isVerified ? rgb(0.09, 0.47, 0.3) : rgb(0.57, 0.39, 0.05),
  });

  /* Signature image (left side of body) */
  const bodyTop = cardY + cardH - headerH - 6;
  const bodyBottom = cardY + 8;
  const bodyH = bodyTop - bodyBottom;
  const sigPanelW = 130;
  const sigPanelX = M + 10;

  proofPage.drawRectangle({
    x: sigPanelX, y: bodyBottom,
    width: sigPanelW, height: bodyH,
    color: rgb(0.972, 0.978, 0.988),
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 0.6,
  });

  if (signaturePngBytes) {
    const sigImg = await pdfDoc.embedPng(signaturePngBytes);
    const maxW = sigPanelW - 16;
    const maxH = bodyH - 10;
    const aspect = sigImg.width / sigImg.height;
    let sw = maxW, sh = sw / aspect;
    if (sh > maxH) { sh = maxH; sw = sh * aspect; }
    proofPage.drawImage(sigImg, {
      x: sigPanelX + 8 + (maxW - sw) / 2,
      y: bodyBottom + 4 + (maxH - sh) / 2,
      width: sw, height: sh,
    });
  } else {
    proofPage.drawText('Wallet-signed', {
      x: sigPanelX + 8, y: bodyBottom + bodyH / 2 + 2,
      size: 8, font, color: rgb(0.44, 0.48, 0.56),
    });
  }

  /* Signer + timestamp (middle) */
  const midX = sigPanelX + sigPanelW + 14;
  proofPage.drawText('Signer', {
    x: midX, y: bodyTop - 10,
    size: 7.5, font: boldFont, color: rgb(0.4, 0.45, 0.52),
  });
  proofPage.drawText(
    truncateForPdf(proofBlock.signerDisplayName || proofBlock.signerAddress, 30, 6),
    { x: midX, y: bodyTop - 22, size: 9, font, color: rgb(0.07, 0.1, 0.16) }
  );
  proofPage.drawText('Signed at', {
    x: midX, y: bodyTop - 42,
    size: 7.5, font: boldFont, color: rgb(0.4, 0.45, 0.52),
  });
  proofPage.drawText(proofBlock.signedAt || '-', {
    x: midX, y: bodyTop - 54, size: 9, font, color: rgb(0.07, 0.1, 0.16),
  });
  proofPage.drawText('Status', {
    x: midX, y: bodyTop - 74,
    size: 7.5, font: boldFont, color: rgb(0.4, 0.45, 0.52),
  });
  proofPage.drawText(auditTrail.finalStatus || 'Signed', {
    x: midX, y: bodyTop - 86, size: 9, font, color: rgb(0.07, 0.1, 0.16),
  });

  /* QR code (right side) */
  if (qrPngBytes) {
    const qrSize = 64;
    const qrX = M + cardW - qrSize - 14;
    const qrY = bodyBottom + (bodyH - qrSize) / 2 + 4;

    const qrImg = await pdfDoc.embedPng(qrPngBytes);
    proofPage.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    proofPage.drawText('Scan to verify', {
      x: qrX + 2, y: qrY - 10,
      size: 7, font: boldFont, color: rgb(0.4, 0.45, 0.52),
    });
  }

  /* ================================================================
     Verification Details – below card, same page, no repetition
     ================================================================ */
  const auditTop = cardY - 22;

  proofPage.drawText('Verification Details', {
    x: M, y: auditTop,
    size: 13, font: boldFont, color: rgb(0.07, 0.1, 0.16),
  });

  proofPage.drawText('Machine-readable proof for the completed agreement.', {
    x: M, y: auditTop - 14,
    size: 8.5, font, color: rgb(0.4, 0.45, 0.52),
  });

  drawDivider(proofPage, { x: M, y: auditTop - 22, width: cardW });

  const auditRows = [
    { label: 'Document created', value: auditTrail.documentCreatedAt },
    { label: 'Document sent', value: auditTrail.documentSentAt || 'Not recorded' },
    { label: 'Signer viewed', value: auditTrail.signerViewedAt || 'Not recorded' },
    { label: 'Signer signed', value: auditTrail.signerSignedAt },
    { label: 'Signer wallet', value: auditTrail.signerWalletAddress },
    { label: 'IP address', value: auditTrail.ipAddress || 'Not captured' },
    { label: 'Document hash', value: auditTrail.documentHash },
    { label: 'Transaction', value: auditTrail.transactionHash || 'Pending blockchain anchor' },
    { label: 'Network', value: auditTrail.chain },
    { label: 'Agreement ID', value: auditTrail.agreementId },
  ];

  drawKeyValueRows(proofPage, auditRows, {
    x: M,
    startY: auditTop - 36,
    width: cardW,
    font,
    boldFont,
    rowGap: 20,
    valueOffset: 120,
  });

  const finalPdf = await pdfDoc.save();
  return Buffer.from(finalPdf);
}

module.exports = {
  stampSignature,
  addProofPages,
};

