"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useInbox } from "@/lib/useMessages";
import MessageList from "@/components/MessageList";
import MessageView from "@/components/MessageView";
import type { Message } from "@/lib/useMessages";

export default function ArchivedPage() {
  const { address } = useAccount();
  const { messages, loading, refresh } = useInbox(address);
  const [selected, setSelected] = useState<Message | null>(null);

  const archived = messages.filter(m => m.state === "archived");

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={`flex flex-col border-r border-gray-200 ${selected ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full"}`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-base">Archived</h1>
            <p className="text-xs text-gray-400">{archived.length} messages</p>
          </div>
          <button onClick={refresh} className="text-xs text-gray-400 hover:text-black transition p-1.5 rounded hover:bg-gray-100">
            ↻ Refresh
          </button>
        </div>
        <MessageList
          messages={archived}
          loading={loading}
          selected={selected}
          onSelect={setSelected}
          emptyIcon="🗃️"
          emptyText="No archived messages"
          emptySubtext="Archived messages will appear here"
        />
      </div>

      {selected ? (
        <MessageView
          message={selected}
          address={address || ""}
          onBack={() => setSelected(null)}
          onAction={refresh}
        />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-center">
          <div>
            <div className="text-4xl mb-3">🗃️</div>
            <p className="text-gray-400 text-sm">Select a message to view</p>
          </div>
        </div>
      )}
    </div>
  );
}