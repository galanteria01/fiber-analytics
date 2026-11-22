import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { hasData } from '@/lib/duckdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  let storeKind: string;
  try {
    storeKind = getStore().kind;
  } catch (error) {
    const msg = process.env.NODE_ENV === 'production' ? 'storage error' : String(error);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }

  let bool: boolean;
  try {
    bool = await hasData();
  } catch (error) {
    const msg = process.env.NODE_ENV === 'production' ? 'storage error' : String(error);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }

  const version = process.env.npm_package_version ?? '0.1.0';

  return NextResponse.json({
    ok: true,
    storage: storeKind,
    hasData: bool,
    version,
    time: new Date().toISOString(),
  });
}
