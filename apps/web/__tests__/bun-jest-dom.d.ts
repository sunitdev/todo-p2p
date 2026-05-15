import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// Bring jest-dom matchers onto bun:test's expect via declaration merging.
declare module 'bun:test' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<T>
    extends TestingLibraryMatchers<typeof expect.stringContaining, T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchers
    extends TestingLibraryMatchers<typeof expect.stringContaining, unknown> {}
}
