"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useSent } from "@/lib/useMessages";
import MessageList from "@/components/MessageList";
import MessageView from "@/components/MessageView";
import type { Message } from "@/lib/useMessages";

export default function SentPage() {
  const { address } = useAccount();
  const { messages, loading, refresh } = useSent(address);
  const [selected, setSelected] = useState<Message | null>(null);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={`flex flex-col border-r border-gray-200 ${selected ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full"}`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-base">Sent</h1>
            <p className="text-xs text-gray-400">{messages.length} messages</p>
          </div>
          <button onClick={refresh} className="text-xs text-gray-400 hover:text-black transition p-1.5 rounded hover:bg-gray-100">
            ↻ Refresh
          </button>
        </div>
        <MessageList
          messages={messages}
          loading={loading}
          selected={selected}
          onSelect={setSelected}
          emptyIcon="📤"
          emptyText="No sent messages"
          emptySubtext="Messages you send will appear here"
          showReceiver={true}
        />
      </div>

      {selected ? (
        <MessageView
          message={selected}
          address={address || ""}
          onBack={() => setSelected(null)}
          onAction={refresh}
          showReply={false}
        />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-center">
          <div>
            <div className="text-4xl mb-3">📤</div>
            <p className="text-gray-400 text-sm">Select a message to view</p>
          </div>
        </div>
      )}
    </div>
  );
}