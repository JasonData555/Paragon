import { NextResponse } from 'next/server';
import type { QueryResult, QueryParams } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { queryResult, params, recipientName } = (await request.json()) as {
      queryResult: QueryResult;
      params: QueryParams;
      recipientName: string;
    };

    // Dynamic import to prevent react-pdf from loading in client bundles
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const { ParagonPDFDocument } = await import('@/components/pdf/ParagonPDFDocument');
    const React = (await import('react')).default;

    /* eslint-disable */
    const element = React.createElement(ParagonPDFDocument as any, {
      result: queryResult,
      params,
      recipientName: recipientName || 'Hitch Partners',
      generatedDate: new Date().toISOString(),
    });
    const buffer = await renderToBuffer(element as any);
    /* eslint-enable */

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `paragon_${params.mode}_${dateStr}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[export] PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
