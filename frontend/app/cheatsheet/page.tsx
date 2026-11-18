import CheatsheetView from "@/components/CheatsheetView";

export const metadata = { title: "Cheatsheet — ScaleForge" };

export default function CheatsheetPage() {
  return (
    <main className="container wide page">
      <div className="eyebrow">Reference</div>
      <h1 style={{ marginBottom: 6 }}>System design cheatsheet</h1>
      <p className="muted" style={{ maxWidth: 760 }}>Numbers, formulas, patterns and a framework you can keep open in an interview prep session. Print-friendly.</p>
      <CheatsheetView />
    </main>
  );
}
