/// <reference types="vite/client" />

declare module 'virtual:crow-assets' {
  /** Filenames present in public/assets/crow at build (or dev-server) time. */
  export const available: string[]
  /** Filenames present in public/assets/bg. */
  export const plates: string[]
}
