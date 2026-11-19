// Global fallback for Next.js App Router PageProps during standalone tsc execution before next build
declare global {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mirrors the generic signature Next generates
  interface PageProps<AppRoute extends string = string> {
    params: Promise<Record<string, string | string[] | undefined>>
    searchParams: Promise<Record<string, string | string[] | undefined>>
  }
}

export {}
