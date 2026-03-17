const QRCode = require('qrcode');

async function buildQrPngBuffer(text) {
  if (!text) return null;
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    color: {
      dark: '#0B1220',
      light: '#FFFFFF',
    },
  });

  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

module.exports = {
  buildQrPngBuffer,
};
