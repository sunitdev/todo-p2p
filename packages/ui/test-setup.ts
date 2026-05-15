import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'bun:test';

if (!(globalThis as { document?: unknown }).document) {
  GlobalRegistrator.register({ url: 'http://localhost/' });
}

expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);
