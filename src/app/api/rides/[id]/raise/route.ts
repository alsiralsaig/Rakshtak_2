export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getRiderToken, raisePrice } from "@/lib/rideServer";

/**
 * POST /api/rides/[id]/raise — زوّد السعر ٢٠٪ (صاحب الرحلة فقط وهي pending)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rideId = Number(id);
    if (!Number.isInteger(rideId) || rideId <= 0) {
      return NextResponse.json({ ok: false, error: "معرّف رحلة غير صالح" }, { status: 400 });
    }

    const riderToken = getRiderToken(request);
    if (!riderToken) {
      return NextResponse.json({ ok: false, error: "رمز الرحلة مطلوب" }, { status: 401 });
    }

    const result = await raisePrice(rideId, riderToken);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 403 });
    }
    return NextResponse.json({ ok: true, price: result.price });
  } catch (err) {
    console.error("raise price error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "فشل رفع السعر",
      },
      { status: 503 }
    );
  }
}
