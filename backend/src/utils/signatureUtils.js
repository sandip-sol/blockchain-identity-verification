const MAX_SIGNATURE_IMAGE_BYTES = 512 * 1024;
const PNG_HEADER_HEX = '89504e470d0a1a0a';

function parsePngDimensions(bytes) {
  if (bytes.length < 24) {
    throw new Error('Signature image is too small to be a valid PNG');
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return { width, height };
}

function parseStoredSignaturePng(signatureImageBase64) {
  const bytes = Buffer.from(signatureImageBase64, 'base64');
  if (!bytes.length || bytes.length > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new Error(`Signature image must be between 1 byte and ${MAX_SIGNATURE_IMAGE_BYTES} bytes`);
  }

  const pngHeader = bytes.subarray(0, 8).toString('hex');
  if (pngHeader !== PNG_HEADER_HEX) {
    throw new Error('Signature image must be a PNG');
  }

  const { width, height } = parsePngDimensions(bytes);
  if (width < 40 || height < 20 || width > 1600 || height > 800) {
    throw new Error('Signature image dimensions are outside the allowed range');
  }

  return {
    bytes,
    width,
    height,
    contentType: 'image/png',
  };
}

module.exports = {
  MAX_SIGNATURE_IMAGE_BYTES,
  parseStoredSignaturePng,
};
