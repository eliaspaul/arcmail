"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useInbox, emptyTrash } from "@/lib/useMessages";
import MessageList from "@/components/MessageList";
import MessageView from "@/components/MessageView";
import type { Message } from "@/lib/useMessages";

export default function DeletedPage() {
  const { address } = useAccount();
  const { messages, loading, refresh } = useInbox(address);
  const [selected, setSelected] = useState<Message | null>(null);
  const [emptying, setEmptying] = useState(false);

  const deleted = messages.filter(m => m.state === "deleted");

  const handleEmptyTrash = async () => {
    if (!address) return;
    if (!confirm("Permanently delete all trashed messages? This cannot be undone.")) return;
    setEmptying(true);
    await emptyTrash(address);
    setSelected(null);
    await refresh();
    setEmptying(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className={`flex flex-col border-r border-gray-200 ${selected ? "hidden md:flex md:w-80 lg:w-96" : "flex w-full"}`}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-base">Deleted</h1>
            <p className="text-xs text-gray-400">Auto-wipes after 30 days</p>
          </div>
          {deleted.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              disabled={emptying}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            >
              {emptying ? "Deleting..." : "Empty Trash"}
            </button>
          )}
        </div>
        <MessageList
          messages={deleted}
          loading={loading}
          selected={selected}
          onSelect={setSelected}
          emptyIcon="🗑️"
          emptyText="Trash is empty"
          emptySubtext="Deleted messages are permanently removed after 30 days"
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
            <div className="text-4xl mb-3">🗑️</div>
            <p className="text-gray-400 text-sm">Select a message to view</p>
            {deleted.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Messages are permanently deleted after 30 days</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}