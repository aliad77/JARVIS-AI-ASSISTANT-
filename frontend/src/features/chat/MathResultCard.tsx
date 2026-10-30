/** Shows the math engine's result separately from any AI-written explanation. */
import { BadgeCheck, CircleAlert, CircleHelp, Cpu, Waves } from "lucide-react";
import { renderKatex } from "../../components/MathText";
import type { MathResult } from "../../engine/math/types";

function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  return <span dangerouslySetInnerHTML={{ __html: renderKatex(tex, display) }} />;
}

const STATUS: Record<MathResult["status"], { label: string; tone: string; Icon: typeof BadgeCheck }> = {
  verified: { label: "VERIFIED BY MATH ENGINE", tone: "text-ok border-ok/60", Icon: BadgeCheck },
  approximate: { label: "APPROXIMATE (NUMERIC)", tone: "text-warn border-warn/60", Icon: Waves },
  no_solution: { label: "ENGINE: NO REAL SOLUTION", tone: "text-warn border-warn/60", Icon: CircleAlert },
  undefined: { label: "ENGINE: UNDEFINED", tone: "text-warn border-warn/60", Icon: CircleAlert },
  unverified: { label: "ENGINE: NOT FULLY CHECKED", tone: "text-warn border-warn/60", Icon: CircleHelp },
  unsupported: { label: "NOT SUPPORTED YET", tone: "text-ink-dim border-[#3a2f48]", Icon: CircleHelp },
  error: { label: "ENGINE COULDN'T READ THIS", tone: "text-ink-dim border-[#3a2f48]", Icon: CircleHelp },
};

export function MathResultCard({ result }: { result: MathResult }) {
  const s = STATUS[result.status] ?? STATUS.unsupported;
  return (
    <aside className={`mt-3 border-2 bg-void/70 p-3 text-sm ${s.tone}`} aria-label="Math engine result">
      <p className="pixel-title flex flex-wrap items-center gap-2 text-[0.5rem]">
        <s.Icon size={14} aria-hidden /> {s.label}
        <span className="ml-auto flex items-center gap-1 text-ink-dim">
          <Cpu size={12} aria-hidden /> {result.engine === "sympy" ? "SymPy" : "on-device engine"}
        </span>
      </p>
      <div className="mt-2 space-y-1 overflow-x-auto text-ink">
        {result.input_latex && (
          <p className="text-ink-dim">
            Problem: <Tex tex={result.input_latex} />
          </p>
        )}
        {result.result_latex && (
          <div className="text-lg">
            <Tex tex={result.result_latex} display />
          </div>
        )}
        {result.solutions?.map((sol) =>
          sol.check ? (
            <p key={sol.value_text} className="text-xs text-ink-dim">
              Check{sol.check.method === "numeric" ? " (to 9 digits)" : ""}: <Tex tex={sol.check.latex} /> {sol.check.ok ? "✔" : "?"}
            </p>
          ) : null,
        )}
        {result.excluded?.map((ex) => (
          <p key={ex.value_text} className="text-warn">
            <Tex tex={ex.value_latex} /> rejected — {ex.reason}
          </p>
        ))}
        {result.restrictions && result.restrictions.length > 0 && <p className="text-ink-dim">Restrictions: {result.restrictions.join(", ")}</p>}
        {result.message && <p className="text-ink-dim">{result.message}</p>}
      </div>
    </aside>
  );
}
