import { NextResponse } from "next/server";

/* =========================
   型定義
========================= */

type OpenStatus = "open" | "break" | "closed" | "unknown";

type StatusResult = {
  status: OpenStatus;
  minutesToOpen?: number;
  breakTime?: string;
};

type OpeningPeriod = {
  open: { day: number; time: string };
  close?: { day: number; time: string };
};

type OpeningHours = {
  periods?: OpeningPeriod[];
};

/* =========================
   ユーティリティ
========================= */

/** 距離計算（km） */
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** HHmm → 分 */
function toMinutes(t: string) {
  return parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(2, 4));
}

/** 分 → HH:mm */
function toHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* =========================
   昼休み対応・診療状態判定
   ※ datetime 用
========================= */

function judgeOpenStatus(
  openingHours: OpeningHours | undefined,
  target: Date
): StatusResult {
  if (!openingHours?.periods) {
    return { status: "unknown" };
  }

  const day = target.getDay(); // 0=日
  const nowMin = target.getHours() * 60 + target.getMinutes();

  const todays = openingHours.periods.filter(
    (p) => p.open.day === day
  );

  if (todays.length === 0) {
    return { status: "closed" };
  }

  const ranges = todays.map((p) => ({
    open: toMinutes(p.open.time),
    close: toMinutes(p.close?.time ?? "2359"),
  }));

  // 診療中
  if (ranges.some((r) => nowMin >= r.open && nowMin < r.close)) {
    return { status: "open" };
  }

  // 次に開く時間（昼休み or 開始前）
  const next = ranges
    .filter((r) => r.open > nowMin)
    .sort((a, b) => a.open - b.open)[0];

  if (next) {
    return {
      status: "break",
      minutesToOpen: next.open - nowMin,
      breakTime: `${toHHMM(nowMin)}–${toHHMM(next.open)}`,
    };
  }

  return { status: "closed" };
}

/* =========================
   ★① Place Details
   opening_hours を含める
========================= */

async function fetchPlaceDetails(placeId: string, apiKey: string) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=website,formatted_phone_number,opening_hours` +
      `&language=ja` +
      `&key=${apiKey}`
  );

  const json = await res.json();
  return json.result ?? {};
}

/* =========================
   API 本体
========================= */

export async function POST(req: Request) {
  try {
    const { department, lat, lng, mode, visitDate, visitTime } =
      await req.json();

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API Key が未設定");
    }

    /** Nearby Search */
    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=3000` +
      `&keyword=${encodeURIComponent(department)}` +
      `&language=ja` +
      `&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    const targetDate =
      mode === "datetime" && visitDate && visitTime
        ? new Date(`${visitDate}T${visitTime}`)
        : new Date();

    const hospitals = await Promise.all(
      (data.results ?? []).map(async (h: any) => {
        const distance = h.geometry?.location
          ? calcDistance(
              lat,
              lng,
              h.geometry.location.lat,
              h.geometry.location.lng
            )
          : null;

        // ★ Place Details 取得
        const details = await fetchPlaceDetails(h.place_id, apiKey);

        /* =========================
           ★② statusInfo 決定ロジック
           now と datetime を完全分離
        ========================= */

        let statusInfo: StatusResult;

        if (mode === "now") {
          // 今すぐ検索：Nearby Search の open_now
          statusInfo =
            h.opening_hours?.open_now === true
              ? { status: "open" }
              : h.opening_hours?.open_now === false
              ? { status: "closed" }
              : { status: "unknown" };
        } else {
          // 日時指定：Place Details の opening_hours
          statusInfo = judgeOpenStatus(
            details.opening_hours,
            targetDate
          );
        }

        return {
          name: h.name,
          address: h.vicinity,
          lat: h.geometry?.location?.lat,
          lng: h.geometry?.location?.lng,
          distance,
          openStatus: statusInfo.status,
          minutesToOpen: statusInfo.minutesToOpen ?? null,
          breakTime: statusInfo.breakTime ?? null,
          placeId: h.place_id,
          website: details.website ?? null,
          phone: details.formatted_phone_number ?? null,
        };
      })
    );

    return NextResponse.json(hospitals);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "検索失敗" }, { status: 500 });
  }
}
