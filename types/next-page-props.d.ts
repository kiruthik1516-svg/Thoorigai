// Global fallback for Next.js App Router PageProps during standalone tsc execution before next build
declare global {
  interface PageProps<AppRoute extends string = string> {
    params: Promise<Record<string, string>>
    searchParams: Promise<Record<string, string | string[] | undefined>>
  }
}

export {}
