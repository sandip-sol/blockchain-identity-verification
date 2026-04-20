#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const { addProofPages } = require('../src/services/pdfService');
const { buildQrPngBuffer } = require('../src/utils/qrCode');

async function buildBasePdf(title) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color: rgb(1, 1, 1),
  });

  page.drawText(title, {
    x: 56,
    y: 520,
    size: 24,
    font: boldFont,
    color: rgb(0.08, 0.11, 0.17),
  });

  page.drawText('Sample source page for digital signature proof preview.', {
    x: 56,
    y: 496,
    size: 11,
    font,
    color: rgb(0.42, 0.46, 0.53),
  });

  page.drawRectangle({
    x: 56,
    y: 118,
    width: 730,
    height: 340,
    color: rgb(0.985, 0.988, 0.993),
    borderColor: rgb(0.89, 0.91, 0.95),
    borderWidth: 1,
  });

  const lines = [
    'This preview PDF is generated locally with mock agreement data.',
    'Use it to iterate on the visible signature proof card and audit layout.',
    'No envelope creation, sending, or signing flow is required for this file.',
    '',
    'You can edit backend/scripts/generateProofPreview.js to try different:',
    '- signer names and wallet addresses',
    '- timestamps and status values',
    '- agreement IDs, hashes, and chain labels',
    '- signature images and verification URLs',
  ];

  let y = 420;
  for (const line of lines) {
    page.drawText(line, {
      x: 78,
      y,
      size: 12,
      font,
      color: line.startsWith('-') ? rgb(0.16, 0.2, 0.28) : rgb(0.26, 0.3, 0.38),
    });
    y -= line === '' ? 18 : 22;
  }

  page.drawText('Digitally acknowledged by', {
    x: 522,
    y: 184,
    size: 10,
    font,
    color: rgb(0.45, 0.49, 0.56),
  });
  page.drawText('Aarav Mehta', {
    x: 522,
    y: 158,
    size: 24,
    font: italicFont,
    color: rgb(0.12, 0.28, 0.71),
  });
  page.drawLine({
    start: { x: 520, y: 148 },
    end: { x: 720, y: 148 },
    thickness: 1.1,
    color: rgb(0.76, 0.8, 0.88),
  });
  page.drawText(`Signed at ${new Date().toISOString()}`, {
    x: 522,
    y: 132,
    size: 9.5,
    font,
    color: rgb(0.3, 0.35, 0.43),
  });

  return Buffer.from(await pdfDoc.save());
}

async function main() {
  const outputArg = process.argv[2];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(__dirname, `../tmp/proof-preview-${timestamp}.pdf`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const now = new Date();
  const createdAt = new Date(now.getTime() - 4 * 60 * 1000).toISOString();
  const sentAt = new Date(now.getTime() - 3 * 60 * 1000).toISOString();
  const viewedAt = new Date(now.getTime() - 90 * 1000).toISOString();
  const signedAt = new Date(now.getTime() - 20 * 1000).toISOString();

  const proofBlock = {
    label: 'Digitally Signed',
    signerDisplayName: 'Aarav Mehta',
    signerAddress: '0x4c233fe0c292c291f985451b60e33426c3e0e1a5',
    signedAt,
    documentHash: 'c3893ce61bdd1ab899b975c6716ef0eb4d040649119b54dca2b0ec82817f5f08',
    blockchainNetwork: 'Chain 560048',
    transactionHash: null,
    agreementId: '35cb183f-3d23-4b1f-b4c4-0f8df0060cd6',
    verificationStatusText: 'Blockchain anchor pending',
    verificationUrl: 'http://localhost:3000/verify?envelopeId=35cb183f-3d23-4b1f-b4c4-0f8df0060cd6',
  };

  const auditTrail = {
    documentCreatedAt: createdAt,
    documentSentAt: sentAt,
    signerViewedAt: viewedAt,
    signerSignedAt: signedAt,
    signerWalletAddress: proofBlock.signerAddress,
    ipAddress: '::1',
    documentHash: proofBlock.documentHash,
    transactionHash: null,
    chain: proofBlock.blockchainNetwork,
    agreementId: proofBlock.agreementId,
    finalStatus: 'Signed',
  };

  const basePdfBytes = await buildBasePdf('Digital Signature Proof Preview');
  const qrPngBytes = await buildQrPngBuffer(proofBlock.verificationUrl);
  const previewPdfBytes = await addProofPages({
    pdfBytes: basePdfBytes,
    proofBlock,
    auditTrail,
    qrPngBytes,
    signaturePngBytes: null,
  });

  fs.writeFileSync(outputPath, previewPdfBytes);
  console.log(`Preview PDF written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
