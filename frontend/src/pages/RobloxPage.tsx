import { Gamepad2, Plus, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Notice, Panel, PixelButton } from "../components/ui";
import { RobloxLaunchCard } from "../features/roblox/RobloxLaunchCard";
import { useJarvis } from "../hooks/useJarvis";
import { parsePlaceId } from "../platform/roblox";
import { LIMITS } from "../platform/storage";

export function RobloxPage() {
  const { prefs, updatePrefs, platform } = useJarvis();
  const [name, setName] = useState("");
  const [idInput, setIdInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const r = parsePlaceId(idInput);
    if (!r.ok) return setError(r.error);
    const clean = name.trim().replace(/[^\p{L}\p{N} '!-]/gu, "").slice(0, 40);
    if (!clean) return setError("Give the game a short name, like “Adopt Me”.");
    if (prefs.robloxPlaces.some((p) => p.placeId === r.placeId)) return setError("That game is already saved.");
    if (prefs.robloxPlaces.length >= LIMITS.robloxPlaces) return setError(`You can save up to ${LIMITS.robloxPlaces} games.`);
    updatePrefs({ robloxPlaces: [...prefs.robloxPlaces, { name: clean, placeId: r.placeId }] });
    setName("");
    setIdInput("");
    setError(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel glow title="Roblox launcher" icon={<Gamepad2 size={16} />}>
        <RobloxLaunchCard />
        <p className="mt-3 text-xs text-ink-dim">
          Detected device: <strong className="text-ink">{platform === "ios" ? "iPhone / iPad" : platform === "android" ? "Android" : platform === "windows" ? "Windows PC" : platform === "mac" ? "Mac" : "other"}</strong>. Links follow Roblox's
          documented deep-link formats, which Roblox now marks as deprecated, so they may change in the future.
        </p>
      </Panel>

      <Panel title="Favourite games" icon={<Star size={16} />}>
        {prefs.robloxPlaces.length === 0 ? (
          <p className="text-sm text-ink-dim">Save a game to launch it straight from JARVIS — or say “open Roblox &lt;name&gt;”.</p>
        ) : (
          <ul className="space-y-2">
            {prefs.robloxPlaces.map((p) => (
              <li key={p.placeId} className="border-2 border-[#2a2438] bg-deck p-2">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setOpen(open === p.placeId ? null : p.placeId)} className="min-h-11 flex-1 cursor-pointer text-left font-semibold hover:text-red-hi">
                    {p.name} <span className="font-mono text-xs text-ink-dim">#{p.placeId}</span>
                  </button>
                  <PixelButton onClick={() => updatePrefs({ robloxPlaces: prefs.robloxPlaces.filter((x) => x.placeId !== p.placeId) })} aria-label={`Remove ${p.name}`} className="h-11 w-11 px-0">
                    <Trash2 size={14} />
                  </PixelButton>
                </div>
                {open === p.placeId && (
                  <div className="mt-2">
                    <RobloxLaunchCard placeId={p.placeId} placeName={p.name} compact />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="mt-4 space-y-2 border-t-2 border-[#2a2438] pt-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Game name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3 text-base" placeholder="Adopt Me" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Place ID or roblox.com game link</span>
            <input value={idInput} onChange={(e) => setIdInput(e.target.value)} maxLength={300} inputMode="url" autoCapitalize="off" className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3 font-mono text-sm" placeholder="https://www.roblox.com/games/920587237/…" />
          </label>
          <p className="text-xs text-ink-dim">Find it in the game's web address: roblox.com/games/<strong>NUMBER</strong>/… Only roblox.com links are accepted.</p>
          {error && <Notice tone="error">{error}</Notice>}
          <PixelButton type="submit" variant="primary" className="min-h-12">
            <Plus size={14} /> Save game
          </PixelButton>
        </form>
      </Panel>
    </div>
  );
}
