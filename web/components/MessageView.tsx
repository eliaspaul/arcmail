"use client";
import { Message, setMessageState } from "@/lib/useMessages";
import { useRouter } from "next/navigation";

const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

interface Props {
  message: Message;
  address: string;
  onBack: () => void;
  onAction: () => void;
  showReply?: boolean;
}

export default function MessageView({ message, address, onBack, onAction, showReply = true }: Props) {
  const router = useRouter();

  const handleArchive = async () => {
    await setMessageState(address, message.index, "archived");
    onAction();
    onBack();
  };

  const handleDelete = async () => {
    await setMessageState(address, message.index, "deleted");
    onAction();
    onBack();
  };

  const handleRestore = async () => {
    await setMessageState(address, message.index, "inbox");
    onAction();
    onBack();
  };

  const handleReply = () => {
    const params = new URLSearchParams({ to: message.sender, subject: "Re: " + message.subject });
    router.push("/dashboard/compose?" + params.toString());
  };

  const handleForward = () => {
    const params = new URLSearchParams({
      subject: "Fwd: " + message.subject,
      body: "\n\n--- Forwarded message ---\nFrom: " + message.sender + "\n\n" + message.body,
    });
    router.push("/dashboard/compose?" + params.toString());
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          {showReply && (
            <>
              <button onClick={handleReply} className="text-xs text-gray-600 hover:text-black border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                ↩ Reply
              </button>
              <button onClick={handleForward} className="text-xs text-gray-600 hover:text-black border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                ↪ Forward
              </button>
            </>
          )}
          {message.state !== "archived" && message.state !== "deleted" && (
            <button onClick={handleArchive} className="text-xs text-gray-600 hover:text-black border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
              🗃 Archive
            </button>
          )}
          {message.state === "deleted" ? (
            <button onClick={handleRestore} className="text-xs text-gray-600 hover:text-black border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
              ↩ Restore
            </button>
          ) : (
            <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
              🗑 Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <h2 className="text-2xl font-semibold mb-6">{message.subject}</h2>
        <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
            {message.sender?.slice(2, 4).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{message.sender?.slice(0,6)}...{message.sender?.slice(-4)}</p>
                <p className="text-xs text-gray-400">To: {message.receiver?.slice(0,6)}...{message.receiver?.slice(-4)}</p>
              </div>
              <p className="text-xs text-gray-400">
                {message.timestamp ? new Date(message.timestamp * 1000).toLocaleString() : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm mb-8">
          {message.body}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="border-t border-gray-100 pt-6">
            <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Attachments</p>
            <div className="flex flex-wrap gap-3">
              {message.attachments.map((cid, i) => (
                <a key={i} href={PINATA_GATEWAY + cid} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2.5 text-sm hover:bg-gray-50 transition">
                  <span>📎</span>
                  <span className="text-gray-700">Attachment {i + 1}</span>
                  <span className="text-xs text-gray-400">↓</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {showReply && (
        <div className="px-8 py-4 border-t border-gray-200">
          <button onClick={handleReply} className="w-full text-left text-sm text-gray-400 border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-400 hover:text-gray-600 transition">
            Click to reply...
          </button>
        </div>
      )}
    </div>
  );
}