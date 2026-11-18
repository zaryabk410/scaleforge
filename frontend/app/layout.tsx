import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "ScaleForge — Interactive System Design",
  description: "Learn system design with animated 3D diagrams, a traffic simulator, algorithm labs, practice drills and cheatsheets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <footer className="footer no-print">
          <div className="container row between">
            <span>ScaleForge · learn by building, breaking and fixing systems.</span>
            <span className="mono tiny">Next.js · Three.js · FastAPI</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
