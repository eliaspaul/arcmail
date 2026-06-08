"use client";
import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import Link from "next/link";
import { fetchFromIPFS } from "@/lib/api";
import { decryptMessage } from "@/lib/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Message {
  index: number;
  sender: string;
  ipfsHash: string;
  timestamp: number;
  subject: string;
  body: string;
}

export default function InboxPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({ connector: new InjectedConnector() });
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    const fetchInbox = async () => {
      setLoading(true);
      try {
        const url = API_URL + "/api/inbox/" + address;
        const res = await fetch(url);
        const data = await res.json();
        const fetched: Message[] = [];
        for (const msg of data.messages) {
          try {
            const ipfsData = await fetchFromIPFS(msg.ipfsHash);
            const body = decryptMessage(ipfsData.encryptedContent, address);
            fetched.push({
              index: msg.index,
              sender: msg.sender,
              ipfsHash: msg.ipfsHash,
              timestamp: msg.timestamp,
              subject: ipfsData.subject,
              body,
            });
          } catch {
            fetched.push({
              index: msg.index,
              sender: msg.sender,
              ipfsHash: msg.ipfsHash,
              timestamp: msg.timestamp,
              subject: "Message " + msg.index,
              body: "[Could not load message]",
            });
          }
        }
        setMessages(fetched);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchInbox();
  }, [address]);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6">
        <p className="text-gray-400">Connect your wallet to view your inbox</p>
        <button onClick={() => connect()} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg">
          Connect Wallet
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white">Back</Link>
          <span className="font-semibold text-lg">Inbox</span>
          {messages.length > 0 && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{messages.length}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/compose" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + Compose
          </Link>
          <span className="text-sm font-mono text-gray-400">{address?.slice(0,6)}...{address?.slice(-4)}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {selected ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-sm mb-4 block">
              Back to inbox
            </button>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">From</p>
              <p className="font-mono text-blue-400 text-sm">{selected.sender}</p>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Subject</p>
              <p className="font-semibold text-white">{selected.subject}</p>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Date</p>
              <p className="text-gray-400 text-sm">
                {selected.timestamp ? new Date(selected.timestamp * 1000).toLocaleString() : "Unknown"}
              </p>
            </div>
            <div className="border-t border-gray-800 pt-4 mt-4">
              <p className="text-white whitespace-pre-wrap">{selected.body}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-16 text-gray-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-2">No messages yet</p>
            <p className="text-gray-600 text-sm">Messages sent to your wallet will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.index}
                onClick={() => setSelected(msg)}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-blue-400 text-sm">
                    {msg.sender?.slice(0,6)}...{msg.sender?.slice(-4)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="text-white text-sm font-medium">{msg.subject}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}