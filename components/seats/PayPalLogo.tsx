/**
 * PayPal's official full-colour logo, served from PayPal's own asset host
 * (the way PayPal hands it to merchants) — made for its gold #ffc439 buttons.
 */
export const PAYPAL_LOGO_URL = 'https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-color.svg'

export default function PayPalLogo({ className = 'h-4' }: { className?: string }) {
  return (
    // Plain <img>: an external SVG that needs no optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={PAYPAL_LOGO_URL} alt="PayPal" width={170} height={48} className={`${className} w-auto`} />
  )
}

/**
 * "Pay €338 with PayPal" → the same sentence with the word PayPal swapped
 * for the logo, wherever the language puts it ("… mit PayPal bezahlen").
 */
export function withPayPalLogo(text: string, logoClassName?: string) {
  const at = text.indexOf('PayPal')
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <PayPalLogo className={logoClassName} />
      {text.slice(at + 'PayPal'.length)}
    </>
  )
}
