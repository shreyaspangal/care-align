// Browser stub for `next/link` used only by the /design-sync bundle.
// Renders a plain anchor — the real component pulls in Next's client runtime.
import * as React from 'react'

type LinkProps = {
  href: string | { pathname?: string }
  children?: React.ReactNode
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, ...rest },
  ref,
) {
  const resolved = typeof href === 'string' ? href : (href?.pathname ?? '#')
  return (
    <a ref={ref} href={resolved} {...rest}>
      {children}
    </a>
  )
})

export default Link
