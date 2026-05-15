import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { StoreProvider } from '../../src/lib/store';
import { FakeEngine } from './fakeEngine';

export interface RenderWithStoreResult extends RenderResult {
  engine: FakeEngine;
}

export function renderWithStore(
  ui: ReactElement,
  options: RenderOptions & { engine?: FakeEngine } = {},
): RenderWithStoreResult {
  const engine = options.engine ?? new FakeEngine();
  const { engine: _ignore, ...rest } = options;
  void _ignore;
  const result = render(ui, {
    wrapper: ({ children }) => (
      <StoreProvider engine={engine.asEngine()}>{children}</StoreProvider>
    ),
    ...rest,
  });
  return { ...result, engine };
}
