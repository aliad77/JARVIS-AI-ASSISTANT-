import { MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { Panel, PixelButton } from "../components/ui";
import { useJarvis } from "../hooks/useJarvis";

export function HistoryPage({ onOpen, activeId }: { onOpen: (id: string) => void; activeId: string | null }) {
  const { store, prefs } = useJarvis();
  const [items, setItems] = useState(() => store.listConversations());

  return (
    <Panel title="Mission log" icon={<MessageSquare size={16} />}>
      {!prefs.saveHistory && <p className="mb-3 text-sm text-warn">Saving history is turned off in Settings.</p>}
      {items.length === 0 ? (
        <p className="py-6 text-center text-ink-dim">No saved conversations yet. Conversations are stored only on this device.</p>
      ) : (
        <ul className="divide-y-2 divide-[#2a2438]">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <button type="button" onClick={() => onOpen(c.id)} className="min-h-12 min-w-0 flex-1 cursor-pointer text-left hover:text-red-hi">
                <span className="block truncate font-semibold">
                  {c.title}
                  {c.id === activeId && <span className="pixel-title ml-2 text-[0.46rem] text-red">active</span>}
                </span>
                <span className="block text-xs text-ink-dim">
                  Grade {c.grade} · {c.messageCount} messages · {new Date(c.updatedAt).toLocaleString()}
                </span>
              </button>
              <PixelButton
                onClick={() => {
                  store.deleteConversation(c.id);
                  setItems(store.listConversations());
                }}
                aria-label={`Delete conversation ${c.title}`}
                className="h-11 w-11 px-0"
              >
                <Trash2 size={14} />
              </PixelButton>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
