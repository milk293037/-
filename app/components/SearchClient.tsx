"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MapSection = dynamic(() => import("./MapSection"), { ssr: false });

type SearchMode = "now" | "datetime";
type OpenStatus = "open" | "break" | "closed" | "unknown";

type Hospital = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance: number | null;
  openStatus: OpenStatus;
  minutesToOpen: number | null;
  breakTime: string | null;
  placeId: string;
  website: string | null;
  phone: string | null;
};

export default function SearchClient() {
  const [symptom, setSymptom] = useState("");
  const [results, setResults] = useState<Hospital[]>([]);
  const [location, setLocation] =
    useState<{ lat: number; lng: number } | null>(null);

  const [searchMode, setSearchMode] = useState<SearchMode>("now");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [loading, setLoading] = useState(false);

  /** 初期日時 = 現在 */
  useEffect(() => {
    const now = new Date();
    setVisitDate(now.toISOString().slice(0, 10));
    setVisitTime(now.toTimeString().slice(0, 5));
  }, []);

  /** 現在地取得 */
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        alert("現在地を取得できませんでした");
      }
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;

    setLoading(true);
    setResults([]);

    try {
      const body: any = {
        department: symptom || "内科",
        lat: location.lat,
        lng: location.lng,
        mode: searchMode,
      };

      if (searchMode === "datetime") {
        body.visitDate = visitDate;
        body.visitTime = visitTime;
      }

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: Hospital[] = await res.json();

      /** open → break → closed → unknown → 距離 */
      const sorted = [...data].sort((a, b) => {
        const order: Record<OpenStatus, number> = {
          open: 0,
          break: 1,
          closed: 2,
          unknown: 3,
        };
        if (a.openStatus !== b.openStatus) {
          return order[a.openStatus] - order[b.openStatus];
        }
        if (a.distance != null && b.distance != null) {
          return a.distance - b.distance;
        }
        return 0;
      });

      setResults(sorted);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* タイトル */}
      <h1
        style={{
          fontSize: "2.2rem",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "1.5rem",
          color: "#1976d2",
        }}
      >
        病院検索システム
      </h1>
            
      {/* 説明文 */}
      <p style={{ color: "#555", marginBottom: "1.5rem", textAlign: "center", }}>
        今すぐ行ける病院・日時指定で探せます
      </p>

      <p
        style={{
          textAlign: "center",
          color: "#555",
          marginBottom: "1.2rem",
          fontSize: "1.25rem",
        }}
      >
        ↓キーワードを入力して病院を探す↓
      </p>



      {/* 🔍 検索フォーム */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <input
          type="text"
          placeholder="症状（例：頭痛）または 病院名 で検索　※空欄でも検索できます"
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          style={{
            padding: "0.8rem",
            borderRadius: "8",
            border: "1.5px solid #ccc",
            fontSize: "1rem",
          }}
        />

        {/* モード切替 */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setSearchMode("now")}
            style={{
              minHeight: "48px",
              flex: 1,
              padding: "0.8rem",
              borderRadius: "8px",
              border: "2px solid #1976d2",
              background: searchMode === "now" ? "#1976d2" : "white",
              color: searchMode === "now" ? "white" : "#1976d2",
              fontWeight: "bold",
              fontSize: "1rem",
            }}
          >
            今すぐ行ける病院
          </button>

          <button
            type="button"
            onClick={() => setSearchMode("datetime")}
            style={{
              minHeight: "48px",
              flex: 1,
              padding: "0.8rem",
              borderRadius: "8px",
              border: "2px solid #1976d2",
              background: searchMode === "datetime" ? "#1976d2" : "white",
              color: searchMode === "datetime" ? "white" : "#1976d2",
              fontWeight: "bold",
              fontSize: "1rem",
            }}
          >
            日時指定
          </button>
        </div>


        {searchMode === "datetime" && (
          <div style={{ marginTop: "1rem" }}>
            <label
              style={{
                fontWeight: "bold",
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              日時を指定して検索
            </label>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                style={{
                  fontSize: "1.1rem",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "8px",
                  border: "2px solid #1976d2",
                  minHeight: "44px",
                }}
              />

              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                style={{
                  fontSize: "1.1rem",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "8px",
                  border: "2px solid #1976d2",
                  minHeight: "44px",
                }}
              />
            </div>

            <p style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.4rem" }}>
              ※ 指定した日時に診療している病院を検索します
            </p>
          </div>
        )}


        <button
          type="submit"
          disabled={loading}
          style={{
            minHeight: "48px",
            padding: "0.9rem",
            borderRadius: 8,
            background: "#FA8000",
            color: "white",
            fontWeight: "bold",
            fontSize: "1.1rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "検索中…" : "病院を検索する"}
        </button>


      </form>

      {/* 📋 結果 + 地図 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* リスト */}
        <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {/* 注意文  */}
          <p
            style={{
              fontSize: "0.85rem",
              color: "#555",
              background: "#f1f5f9",
              padding: "0.5rem",
              borderRadius: "6px",
              marginBottom: "0.75rem",
            }}
          >

            ※ 診療時間は変更される場合があります。来院前に公式情報をご確認ください。<br></br>
            ※ 病院名をクリックすると公式ホームページやGoogleMapに飛ぶことができます。
          </p>
          {results.map((h, i) => {
            const color =
              h.openStatus === "open"
                ? "green"
                : h.openStatus === "break"
                ? "orange"
                : h.openStatus === "closed"
                ? "red"
                : "gray";

            return (
              <div
                  key={i}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    padding: "1rem",
                    marginBottom: "0.5rem",
                  }}
                >
                <h4>
                  <a href={h.website ?? `https://www.google.com/maps/place/?q=place_id:${h.placeId}`} target="_blank">
                    {h.name}
                  </a>
                </h4>

                <p>{h.address}</p>
                <p>距離: {h.distance?.toFixed(2)}km</p>
                {h.phone && <p>📞 {h.phone}</p>}

                <p style={{ color, fontWeight: "bold" }}>
                  {h.openStatus === "open" && "診療中"}
                  {h.openStatus === "break" && (
                    <div>
                      🟠 昼休み中（{h.breakTime}）
                      {h.minutesToOpen != null && (
                        <div style={{ fontSize: "0.85em", marginTop: "4px" }}>
                          → あと{h.minutesToOpen}分で診療再開
                        </div>
                      )}
                    </div>
                  )}

                  {h.openStatus === "closed" && "本日は診療終了"}
                  {h.openStatus === "unknown" && "診療状況不明"}
                </p>
              </div>
            );
          })}
        </div>

        {/* 🗺 地図 */}
        <MapSection results={results} center={location} />
      </div>
    </>
  );
}
