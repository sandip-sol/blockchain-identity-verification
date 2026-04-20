const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function truncateForPdf(str, head = 18, tail = 6) {
  if (!str) return '-';
  const s = String(str);
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

function drawPanel(page, { x, y, width, height, fill, border = rgb(0.88, 0.9, 0.94), borderWidth = 0.7 }) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fill,
    borderColor: border,
    borderWidth,
  });
}

function drawDivider(page, { x, y, width }) {
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1,
    color: rgb(0.89, 0.91, 0.95),
  });
}

function drawSectionLabel(page, label, { x, y, font, size = 6.8, color = rgb(0.56, 0.6, 0.67) }) {
  page.drawText(String(label || '').toUpperCase(), {
    x,
    y,
    size,
    font,
    color,
  });
}

function drawValue(page, value, { x, y, font, size = 9, color = rgb(0.07, 0.1, 0.16), maxWidth }) {
  page.drawText(String(value || '-'), {
    x,
    y,
    size,
    font,
    color,
    maxWidth,
  });
}

function drawWrappedField(page, {
  label,
  value,
  x,
  y,
  width,
  labelFont,
  valueFont,
  labelSize = 6.5,
  valueSize = 8.4,
  lineGap = 9,
  color = rgb(0.07, 0.1, 0.16),
}) {
  drawSectionLabel(page, label, { x, y, font: labelFont, size: labelSize });
  page.drawText(String(value || '-'), {
    x,
    y: y - 10,
    size: valueSize,
    font: valueFont,
    color,
    maxWidth: width,
    lineHeight: lineGap,
  });
}

function drawKeyValueRows(page, rows, { x, startY, width, font, boldFont, rowGap = 18, valueOffset = 130, valueSize = 8.4, labelSize = 7 }) {
  let cursorY = startY;
  rows.forEach(({ label, value }) => {
    page.drawText(String(label || '-'), {
      x,
      y: cursorY,
      size: labelSize,
      font: boldFont,
      color: rgb(0.36, 0.41, 0.48),
      maxWidth: Math.max(28, valueOffset - 6),
    });

    page.drawText(String(value || '-'), {
      x: x + valueOffset,
      y: cursorY,
      size: valueSize,
      font,
      color: rgb(0.08, 0.11, 0.17),
      maxWidth: Math.max(40, width - valueOffset - 2),
    });

    cursorY -= rowGap;
  });
}

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

  if (labelText) {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText(String(labelText), {
      x,
      y: Math.max(0, y - 12),
      size: 9,
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

  const page = pdfDoc.addPage([width, height]);
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.997, 0.997, 0.995) });

  const M = 38;
  const cardW = width - M * 2;
  const cardH = 156;
  const cardY = height - M - cardH;
  const headerH = 30;
  const bodyY = cardY + 10;
  const bodyH = cardH - headerH - 16;
  const gap = 10;
  const sigW = 92;
  const qrW = 154;
  const midW = (cardW - sigW - qrW - gap * 3) / 2;
  const sigX = M + 10;
  const detailsX = sigX + sigW + gap;
  const integrityX = detailsX + midW + gap;
  const blockchainX = integrityX + midW + gap;

  const cardFill = rgb(1, 1, 1);
  const softFill = rgb(0.987, 0.988, 0.992);
  const panelBorder = rgb(0.88, 0.9, 0.94);

  drawPanel(page, {
    x: M,
    y: cardY,
    width: cardW,
    height: cardH,
    fill: cardFill,
    border: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  drawPanel(page, {
    x: M,
    y: cardY + cardH - headerH,
    width: cardW,
    height: headerH,
    fill: rgb(0.983, 0.984, 0.987),
    border: rgb(0.9, 0.92, 0.95),
    borderWidth: 0.6,
  });

  drawSectionLabel(page, 'Signature Proof', {
    x: M + 14,
    y: cardY + cardH - 12,
    font: boldFont,
    size: 6.7,
  });
  drawValue(page, proofBlock.label || 'Digitally Signed', {
    x: M + 14,
    y: cardY + cardH - 24,
    font: boldFont,
    size: 12.5,
    maxWidth: 180,
  });

  const isVerified = auditTrail.finalStatus === 'Verified' || !!proofBlock.transactionHash;
  const signedBadge = {
    label: auditTrail.finalStatus || 'SIGNED',
    fill: rgb(0.93, 0.98, 0.95),
    border: rgb(0.74, 0.89, 0.8),
    text: rgb(0.12, 0.46, 0.29),
    width: 50,
  };
  const anchorBadge = isVerified
    ? {
      label: 'BLOCKCHAIN VERIFIED',
      fill: rgb(0.93, 0.98, 0.95),
      border: rgb(0.74, 0.89, 0.8),
      text: rgb(0.12, 0.46, 0.29),
      width: 96,
    }
    : {
      label: 'ANCHOR PENDING',
      fill: rgb(1, 0.98, 0.93),
      border: rgb(0.95, 0.86, 0.63),
      text: rgb(0.58, 0.39, 0.05),
      width: 82,
    };
  const badgeGap = 8;
  const badgeY = cardY + cardH - 21;
  const anchorX = M + cardW - anchorBadge.width - 14;
  const signedX = anchorX - signedBadge.width - badgeGap;

  [
    { x: signedX, badge: signedBadge },
    { x: anchorX, badge: anchorBadge },
  ].forEach(({ x, badge }) => {
    drawPanel(page, {
      x,
      y: badgeY,
      width: badge.width,
      height: 14,
      fill: badge.fill,
      border: badge.border,
      borderWidth: 0.6,
    });
    page.drawText(badge.label, {
      x: x + 6,
      y: badgeY + 4.2,
      size: 6,
      font: boldFont,
      color: badge.text,
      maxWidth: badge.width - 10,
    });
  });

  [
    { x: sigX, width: sigW },
    { x: detailsX, width: midW },
    { x: integrityX, width: midW },
    { x: blockchainX, width: qrW },
  ].forEach(({ x, width: panelW }) => {
    drawPanel(page, {
      x,
      y: bodyY,
      width: panelW,
      height: bodyH,
      fill: softFill,
      border: panelBorder,
      borderWidth: 0.6,
    });
  });

  drawSectionLabel(page, 'Signature Preview', { x: sigX + 8, y: bodyY + bodyH - 12, font: boldFont, size: 6.3 });
  const sigBoxX = sigX + 10;
  const sigBoxY = bodyY + 18;
  const sigBoxW = sigW - 20;
  const sigBoxH = bodyH - 34;
  drawPanel(page, {
    x: sigBoxX,
    y: sigBoxY,
    width: sigBoxW,
    height: sigBoxH,
    fill: rgb(1, 1, 1),
    border: rgb(0.86, 0.89, 0.94),
    borderWidth: 0.6,
  });

  if (signaturePngBytes) {
    const sigImg = await pdfDoc.embedPng(signaturePngBytes);
    const maxW = sigBoxW - 14;
    const maxH = sigBoxH - 12;
    const aspect = sigImg.width / sigImg.height;
    let sw = maxW;
    let sh = sw / aspect;
    if (sh > maxH) {
      sh = maxH;
      sw = sh * aspect;
    }
    page.drawImage(sigImg, {
      x: sigBoxX + 7 + (maxW - sw) / 2,
      y: sigBoxY + 6 + (maxH - sh) / 2,
      width: sw,
      height: sh,
    });
  } else {
    drawValue(page, 'Wallet-signed', {
      x: sigBoxX + 18,
      y: sigBoxY + sigBoxH / 2,
      font,
      size: 7.4,
      color: rgb(0.45, 0.49, 0.56),
      maxWidth: sigBoxW - 20,
    });
  }

  page.drawText('View Signature', {
    x: sigX + 15,
    y: bodyY + 8,
    size: 6.2,
    font: boldFont,
    color: rgb(0.45, 0.49, 0.56),
  });

  drawSectionLabel(page, 'Signing Details', { x: detailsX + 10, y: bodyY + bodyH - 12, font: boldFont, size: 6.5 });
  const detailsFieldX = detailsX + 10;
  const detailsFieldW = midW - 20;
  drawWrappedField(page, {
    label: 'Signer',
    value: truncateForPdf(proofBlock.signerDisplayName || proofBlock.signerAddress, 20, 6),
    x: detailsFieldX,
    y: bodyY + bodyH - 27,
    width: detailsFieldW,
    labelFont: boldFont,
    valueFont: boldFont,
    valueSize: 8.6,
  });
  drawWrappedField(page, {
    label: 'Signed At',
    value: proofBlock.signedAt || '-',
    x: detailsFieldX,
    y: bodyY + bodyH - 48,
    width: detailsFieldW,
    labelFont: boldFont,
    valueFont: font,
    valueSize: 8.2,
  });
  drawWrappedField(page, {
    label: 'Status',
    value: auditTrail.finalStatus || 'Signed',
    x: detailsFieldX,
    y: bodyY + bodyH - 69,
    width: detailsFieldW,
    labelFont: boldFont,
    valueFont: boldFont,
    valueSize: 8.8,
  });
  drawWrappedField(page, {
    label: 'Agreement ID',
    value: truncateForPdf(auditTrail.agreementId || proofBlock.agreementId, 14, 6),
    x: detailsFieldX,
    y: bodyY + bodyH - 90,
    width: detailsFieldW,
    labelFont: boldFont,
    valueFont: font,
    valueSize: 7.9,
  });

  drawSectionLabel(page, 'Document Integrity', { x: integrityX + 10, y: bodyY + bodyH - 12, font: boldFont, size: 6.5 });
  const integrityFieldX = integrityX + 10;
  const integrityFieldW = midW - 20;
  drawWrappedField(page, {
    label: 'Document Hash',
    value: truncateForPdf(auditTrail.documentHash || proofBlock.documentHash, 14, 8),
    x: integrityFieldX,
    y: bodyY + bodyH - 27,
    width: integrityFieldW,
    labelFont: boldFont,
    valueFont: boldFont,
    valueSize: 8.1,
  });
  drawWrappedField(page, {
    label: 'IP Address',
    value: auditTrail.ipAddress || 'Not captured',
    x: integrityFieldX,
    y: bodyY + bodyH - 50,
    width: integrityFieldW,
    labelFont: boldFont,
    valueFont: font,
    valueSize: 8.2,
  });
  drawWrappedField(page, {
    label: 'Verification',
    value: isVerified ? 'Blockchain verified' : 'Anchor pending',
    x: integrityFieldX,
    y: bodyY + bodyH - 73,
    width: integrityFieldW,
    labelFont: boldFont,
    valueFont: boldFont,
    valueSize: 8.6,
  });

  drawSectionLabel(page, 'Blockchain / Verify', { x: blockchainX + 10, y: bodyY + bodyH - 12, font: boldFont, size: 6.5 });
  const qrWrapSize = 54;
  const qrWrapX = blockchainX + qrW - qrWrapSize - 12;
  const qrWrapY = bodyY + 24;
  drawPanel(page, {
    x: qrWrapX,
    y: qrWrapY,
    width: qrWrapSize,
    height: qrWrapSize,
    fill: rgb(1, 1, 1),
    border: rgb(0.86, 0.89, 0.94),
    borderWidth: 0.6,
  });
  if (qrPngBytes) {
    const qrImg = await pdfDoc.embedPng(qrPngBytes);
    page.drawImage(qrImg, {
      x: qrWrapX + 5,
      y: qrWrapY + 5,
      width: qrWrapSize - 10,
      height: qrWrapSize - 10,
    });
  }

  const chainFieldX = blockchainX + 10;
  const chainFieldW = qrW - qrWrapSize - 28;
  drawWrappedField(page, {
    label: 'Transaction',
    value: truncateForPdf(auditTrail.transactionHash || 'Pending anchor', 12, 6),
    x: chainFieldX,
    y: bodyY + bodyH - 30,
    width: chainFieldW,
    labelFont: boldFont,
    valueFont: font,
    valueSize: 7.3,
    lineGap: 8,
  });
  drawWrappedField(page, {
    label: 'Network',
    value: truncateForPdf(auditTrail.chain || proofBlock.blockchainNetwork || '-', 14, 0),
    x: chainFieldX,
    y: bodyY + bodyH - 48,
    width: chainFieldW,
    labelFont: boldFont,
    valueFont: font,
    valueSize: 7.1,
    lineGap: 8,
  });
  drawWrappedField(page, {
    label: 'Signer Wallet',
    value: truncateForPdf(auditTrail.signerWalletAddress || proofBlock.signerAddress, 12, 6),
    x: chainFieldX,
    y: bodyY + bodyH - 66,
    width: chainFieldW,
    labelFont: boldFont,
    valueFont: font,
    valueSize: 6.9,
    lineGap: 7,
  });
  page.drawText('Scan to verify', {
    x: qrWrapX + 1,
    y: qrWrapY - 10,
    size: 5.8,
    font: boldFont,
    color: rgb(0.42, 0.46, 0.53),
  });

  const auditTop = cardY - 24;
  page.drawText('Verification Details', {
    x: M,
    y: auditTop,
    size: 13,
    font: boldFont,
    color: rgb(0.07, 0.1, 0.16),
  });
  page.drawText('Machine-readable proof for the completed agreement.', {
    x: M,
    y: auditTop - 14,
    size: 8.5,
    font,
    color: rgb(0.4, 0.45, 0.52),
  });
  drawDivider(page, { x: M, y: auditTop - 22, width: cardW });

  const panelGap = 10;
  const auditPanelW = (cardW - panelGap * 2) / 3;
  const auditPanelY = auditTop - 148;
  const auditPanelH = 118;
  const panelXs = [M, M + auditPanelW + panelGap, M + (auditPanelW + panelGap) * 2];

  panelXs.forEach((x) => {
    drawPanel(page, {
      x,
      y: auditPanelY,
      width: auditPanelW,
      height: auditPanelH,
      fill: rgb(1, 1, 1),
      border: rgb(0.88, 0.91, 0.95),
      borderWidth: 0.7,
    });
  });

  drawSectionLabel(page, 'Timeline', { x: panelXs[0] + 10, y: auditPanelY + auditPanelH - 12, font: boldFont, size: 6.8 });
  drawKeyValueRows(page, [
    { label: 'Created', value: auditTrail.documentCreatedAt || 'Not recorded' },
    { label: 'Sent', value: auditTrail.documentSentAt || 'Not recorded' },
    { label: 'Viewed', value: auditTrail.signerViewedAt || 'Not recorded' },
    { label: 'Signed', value: auditTrail.signerSignedAt || 'Not recorded' },
  ], {
    x: panelXs[0] + 10,
    startY: auditPanelY + auditPanelH - 28,
    width: auditPanelW - 20,
    font,
    boldFont,
    rowGap: 20,
    valueOffset: 45,
    valueSize: 8,
    labelSize: 6.8,
  });

  drawSectionLabel(page, 'Identity', { x: panelXs[1] + 10, y: auditPanelY + auditPanelH - 12, font: boldFont, size: 6.8 });
  drawKeyValueRows(page, [
    { label: 'Wallet', value: truncateForPdf(auditTrail.signerWalletAddress, 12, 8) },
    { label: 'IP', value: auditTrail.ipAddress || 'Not captured' },
  ], {
    x: panelXs[1] + 10,
    startY: auditPanelY + auditPanelH - 28,
    width: auditPanelW - 20,
    font,
    boldFont,
    rowGap: 20,
    valueOffset: 42,
    valueSize: 8.2,
    labelSize: 6.8,
  });

  drawSectionLabel(page, 'Integrity / Blockchain', { x: panelXs[2] + 10, y: auditPanelY + auditPanelH - 12, font: boldFont, size: 6.8 });
  drawKeyValueRows(page, [
    { label: 'Hash', value: truncateForPdf(auditTrail.documentHash, 12, 8) },
    { label: 'Tx', value: truncateForPdf(auditTrail.transactionHash || 'Pending anchor', 12, 8) },
    { label: 'Chain', value: auditTrail.chain || '-' },
    { label: 'Agreement', value: truncateForPdf(auditTrail.agreementId, 10, 6) },
    { label: 'Status', value: auditTrail.finalStatus || 'Signed' },
  ], {
    x: panelXs[2] + 10,
    startY: auditPanelY + auditPanelH - 28,
    width: auditPanelW - 20,
    font,
    boldFont,
    rowGap: 16,
    valueOffset: 48,
    valueSize: 7.9,
    labelSize: 6.6,
  });

  const finalPdf = await pdfDoc.save();
  return Buffer.from(finalPdf);
}

module.exports = {
  stampSignature,
  addProofPages,
};
