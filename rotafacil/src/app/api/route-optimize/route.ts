import { NextRequest, NextResponse } from 'next/server';
import { getOptimizedRoute } from '@/lib/osrmService';

export async function POST(req: NextRequest) {
  const { coordinates } = await req.json();
  if (!coordinates || !Array.isArray(coordinates)) {
    return NextResponse.json({ error: 'Coordinates are required' }, { status: 400 });
  }
  try {
    const route = await getOptimizedRoute(coordinates);
    return NextResponse.json({ route });
  } catch (error) {
    return NextResponse.json({ error: 'Route optimization failed', details: error }, { status: 500 });
  }
}
