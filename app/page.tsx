'use client';

import SearchClient from "./components/SearchClient";

export default function HomePage() {
  return (
    <div style={{ padding: "2rem", background: "#f8fafc", minHeight: "100vh" }}>
      <main>
        
        <SearchClient />
      </main>
    </div>
  );
}
