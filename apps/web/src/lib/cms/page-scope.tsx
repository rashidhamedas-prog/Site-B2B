'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type CmsChannel = 'WHOLESALE' | 'RETAIL';

export type CmsPageScopeValue = {
  channel: CmsChannel;
  pageKey: string;
};

const CmsPageScopeContext = createContext<CmsPageScopeValue | null>(null);

export function CmsPageScope({
  channel,
  pageKey,
  children,
}: CmsPageScopeValue & { children: ReactNode }) {
  return (
    <CmsPageScopeContext.Provider value={{ channel, pageKey }}>{children}</CmsPageScopeContext.Provider>
  );
}

/** Missing provider is not home — campaign inject must fail closed. */
export function useCmsPageScope(): CmsPageScopeValue {
  return useContext(CmsPageScopeContext) ?? { channel: 'WHOLESALE', pageKey: '' };
}
