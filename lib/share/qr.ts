import QRCode from 'qrcode'

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: {
      dark: '#050505',
      light: '#ffffff',
    },
  })
}
