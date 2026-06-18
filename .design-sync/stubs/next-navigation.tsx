// Browser stub for `next/navigation` used only by the /design-sync bundle.
// The real module pulls in Next's client runtime (reads `process.env.__NEXT_*`),
// which throws outside Next. The design-system bundle has no router, so these
// return inert values — nav components render, just without route-driven state.

export function usePathname(): string {
  return '/'
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams()
}

export function useParams<T = Record<string, string>>(): T {
  return {} as T
}

export function useSelectedLayoutSegment(): string | null {
  return null
}

export function useSelectedLayoutSegments(): string[] {
  return []
}

const noop = () => {}

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    refresh: noop,
    back: noop,
    forward: noop,
    prefetch: noop,
  }
}

export function redirect(_url: string): never {
  throw new Error('redirect() is a no-op in the design-sync bundle')
}

export function notFound(): never {
  throw new Error('notFound() is a no-op in the design-sync bundle')
}
