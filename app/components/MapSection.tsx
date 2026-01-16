"use client";

import { useEffect, useRef, useState } from "react";

type Hospital = {
  name: string;
  lat: number;
  lng: number;
  openStatus: "open" | "break" | "closed" | "unknown";
};

type Props = {
  results: Hospital[];
  center: { lat: number; lng: number } | null;
};

export default function MapSection({ results, center }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const hospitalMarkersRef = useRef<google.maps.Marker[]>([]);
  const currentMarkerRef = useRef<google.maps.Marker | null>(null);

  const [googleReady, setGoogleReady] = useState(false);

  /** Google Maps Script 読み込み */
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).google) {
      setGoogleReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
  }, []);

  /** マップ初期化 + 現在地ピン */
  useEffect(() => {
    if (!googleReady || !mapRef.current || !center) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
      });
    } else {
      mapInstanceRef.current.setCenter(center);
    }

    // 🔵 現在地ピン
    if (!currentMarkerRef.current) {
      currentMarkerRef.current = new google.maps.Marker({
        position: center,
        map: mapInstanceRef.current,
        title: "現在地",
        icon: {
          url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
        },
      });
    } else {
      currentMarkerRef.current.setPosition(center);
    }
  }, [googleReady, center]);

  /** 病院マーカー */
  useEffect(() => {
    if (!googleReady || !mapInstanceRef.current) return;

    hospitalMarkersRef.current.forEach((m) => m.setMap(null));
    hospitalMarkersRef.current = [];

    results.forEach((h) => {
      if (h.lat == null || h.lng == null) return;

      const iconUrl =
        h.openStatus === "open"
          ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
          : h.openStatus === "break"
          ? "http://maps.google.com/mapfiles/ms/icons/orange-dot.png"
          : h.openStatus === "closed"
          ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
          : "http://maps.google.com/mapfiles/ms/icons/grey-dot.png";

      const marker = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map: mapInstanceRef.current!,
        title: h.name,
        icon: { url: iconUrl },
      });

      hospitalMarkersRef.current.push(marker);
    });
  }, [googleReady, results]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "70vh",
        borderRadius: "8px",
        border: "1px solid #ccc",
      }}
    />
  );
}
