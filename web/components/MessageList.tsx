"use client";
import { Message } from "@/lib/useMessages";

interface Props {
  messages: Message[];
  loading: boolean;
  selected: Message | null;
  onSelect: (msg: Message) => void;
  emptyIcon?: string;
  emptyText?: string;
  emptySubtext?: string;
  showReceiver?: boolean;
}

export default function MessageList({
  messages,
  loading,
  selected,
  onSelect,
  emptyIcon = "📭",
  emptyText = "No messages",
  emptySubtext = "",
  showReceiver = false,
}: Props) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">{emptyIcon}</div>
        <p className="text-gray-600 font-medium text-sm">{emptyText}</p>
        {emptySubtext && <p className="text-gray-400 text-xs mt-1">{emptySubtext}</p>}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto divide-y divide-gray-100">
      {messages.map((msg) => (
        <div
          key={msg.index}
          onClick={() => onSelect(msg)}
          className={"px-5 py-4 cursor-pointer hover:bg-gray-50 transition " +
            (selected?.index === msg.index ? "bg-blue-50 border-l-2 border-blue-500" : "")}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                {showReceiver
                  ? msg.receiver?.slice(2, 4).toUpperCase()
                  : msg.sender?.slice(2, 4).toUpperCase()}
              </div>
              <span className="text-sm font-medium truncate">
                {showReceiver
                  ? msg.receiver?.slice(0,6) + "..." + msg.receiver?.slice(-4)
                  : msg.sender?.slice(0,6) + "..." + msg.sender?.slice(-4)}
              </span>
            </div>
            <span className="text-xs text-gray-400 ml-2 shrink-0">
              {msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate pl-9">{msg.subject}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5 pl-9">{msg.body?.slice(0, 80)}</p>
          {msg.attachments?.length > 0 && (
            <div className="flex items-center gap-1 mt-1 pl-9">
              <span className="text-xs text-gray-400">📎 {msg.attachments.length} attachment{msg.attachments.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}