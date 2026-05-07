'use client';

import { useState } from 'react';
import { QueryForm } from '@/components/shared/QueryForm';
import { RightColumnTabs } from '@/components/shared/RightColumnTabs';
import type { QueryResult, QueryParams } from '@/lib/types';

export default function OfferPage() {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [params, setParams] = useState<QueryParams | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100vh',
        gap: 16,
        padding: 16,
        overflow: 'hidden',
        background: '#F5F0E8',
      }}
    >
      {/* Left column — 480px fixed */}
      <div
        style={{
          flex: '0 0 480px',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <QueryForm
          mode="offer"
          onResult={(r, p) => { setResult(r); setParams(p); }}
          onLoading={setLoading}
          fssDistribution={result?.fss?.peer_distribution ?? undefined}
        />
      </div>

      {/* Right column — flex 1 */}
      <div
        style={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <RightColumnTabs
          result={result}
          params={params}
          loading={loading}
          mode="offer"
        />
      </div>
    </div>
  );
}
