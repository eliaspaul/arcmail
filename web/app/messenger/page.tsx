"use client";
import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useContractWrite } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/contracts/config";
import { encryptMessage, decryptMessage } from "@/lib/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

interface ChatMessage {
  index: number;
  sender: string;
  receiver: string;
  ipfsHash: string;
  timestamp: number;
  subject: string;
  body: string;
  attachments: string[];
  isOutgoing: boolean;
}

interface Conversation {
  address: string;
  alias: string;
  lastMessage: string;
  timestamp: number;
}

export default function MessengerPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({ connector: new InjectedConnector() });
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newContact, setNewContact] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { writeAsync } = useContractWrite({
    address: CONTRACT_ADDRESS as any,
    abi: CONTRACT_ABI,
    functionName: "sendMessage",
  });

  useEffect(() => {
    if (!isConnected) { router.push("/"); return; }
    if (!address) return;
    fetch(API_URL + "/api/alias/by-address/" + address)
      .then(r => r.json())
      .then(data => {
        if (!data.alias) router.push("/setup");
        else setAlias(data.alias);
      })
      .catch(() => router.push("/setup"));
    loadConversations();
  }, [isConnected, address]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    if (!address) return;
    try {
      const [inboxRes, sentRes] = await Promise.all([
        fetch(API_URL + "/api/inbox/" + address),
        fetch(API_URL + "/api/sent/" + address),
      ]);
      const inboxData = await inboxRes.json();
      const sentData = await sentRes.json();
      const convMap = new Map<string, Conversation>();

      for (const msg of [...(inboxData.messages || []), ...(sentData.messages || [])]) {
        const other = msg.sender?.toLowerCase() === address.toLowerCase()
          ? msg.receiverAddress || msg.receiver
          : msg.sender;
        if (!other) continue;
        const aliasRes = await fetch(API_URL + "/api/alias/by-address/" + other).catch(() => null);
        const aliasData = aliasRes ? await aliasRes.json().catch(() => ({})) : {};
        const existing = convMap.get(other.toLowerCase());
        if (!existing || (msg.timestamp || 0) > existing.timestamp) {
          convMap.set(other.toLowerCase(), {
            address: other,
            alias: aliasData.alias || other.slice(0,6) + "..." + other.slice(-4),
            lastMessage: "",
            timestamp: msg.timestamp || 0,
          });
        }
      }
      setConversations(Array.from(convMap.values()).sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) { console.error(e); }
  };

  const loadMessages = async (chatAddress: string) => {
    if (!address) return;
    setLoadingMessages(true);
    setMessages([]);
    try {
      const [inboxRes, sentRes] = await Promise.all([
        fetch(API_URL + "/api/inbox/" + address),
        fetch(API_URL + "/api/sent/" + address),
      ]);
      const inboxData = await inboxRes.json();
      const sentData = await sentRes.json();
      const allMessages: ChatMessage[] = [];

      for (const msg of inboxData.messages || []) {
        if (msg.sender?.toLowerCase() !== chatAddress.toLowerCase()) continue;
        try {
          const ipfsRes = await fetch(API_URL + "/api/message/" + msg.ipfsHash);
          const ipfsData = await ipfsRes.json();
          const body = decryptMessage(ipfsData.encryptedContent, address);
          allMessages.push({
            ...msg,
            subject: ipfsData.subject,
            body,
            attachments: ipfsData.attachments || [],
            isOutgoing: false,
          });
        } catch { continue; }
      }

      for (const msg of sentData.messages || []) {
        const recv = msg.receiverAddress || msg.receiver;
        if (recv?.toLowerCase() !== chatAddress.toLowerCase()) continue;
        try {
          const ipfsRes = await fetch(API_URL + "/api/message/" + msg.ipfsHash);
          const ipfsData = await ipfsRes.json();
          allMessages.push({
            index: msg.index,
            sender: address,
            receiver: recv,
            ipfsHash: msg.ipfsHash,
            timestamp: msg.timestamp,
            subject: ipfsData.subject,
            body: ipfsData.encryptedContent,
            attachments: ipfsData.attachments || [],
            isOutgoing: true,
          });
        } catch { continue; }
      }

      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(allMessages);
    } catch (e) { console.error(e); }
    setLoadingMessages(false);
  };

  const handleSelectChat = (addr: string) => {
    setActiveChat(addr);
    loadMessages(addr);
  };

  const handleStartNewChat = async () => {
    let recipient = newContact.trim();
    if (recipient.includes("@arcmail.io")) {
      const username = recipient.replace("@arcmail.io", "").trim();
      const res = await fetch(API_URL + "/api/alias/by-alias/" + username);
      if (!res.ok) return alert("Alias not found");
      const data = await res.json();
      recipient = data.address;
    }
    if (!isAddress(recipient)) return alert("Invalid wallet address or alias");
    setShowNewChat(false);
    setNewContact("");
    handleSelectChat(recipient);
  };

  const uploadAttachments = async (): Promise<string[]> => {
    const cids: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(API_URL + "/api/upload-file", { method: "POST", body: formData });
      const data = await res.json();
      cids.push(data.cid);
    }
    return cids;
  };

  const handleSend = async () => {
    if (!newMessage.trim() && files.length === 0) return;
    if (!activeChat || !address) return;
    setSending(true);
    try {
      const encryptedContent = encryptMessage(newMessage, activeChat);
      let attachmentCids: string[] = [];
      if (files.length > 0) attachmentCids = await uploadAttachments();

      const uploadRes = await fetch(API_URL + "/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Message",
          encryptedContent,
          senderAddress: address,
          receiverAddress: activeChat,
          attachments: attachmentCids,
        }),
      });
      const uploadData = await uploadRes.json();
      const cid = uploadData.cid;

      await writeAsync({ args: [activeChat, cid] });

      await fetch(API_URL + "/api/sent/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderAddress: address,
          receiverAddress: activeChat,
          ipfsHash: cid,
          timestamp: Math.floor(Date.now() / 1000),
          index: Date.now(),
        }),
      });

      setMessages(prev => [...prev, {
        index: Date.now(),
        sender: address,
        receiver: activeChat,
        ipfsHash: cid,
        timestamp: Math.floor(Date.now() / 1000),
        subject: "Message",
        body: newMessage,
        attachments: attachmentCids,
        isOutgoing: true,
      }]);

      setNewMessage("");
      setFiles([]);
      loadConversations();
    } catch (e) {
      console.error(e);
      alert("Failed to send. Make sure you are on Arc Testnet.");
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp * 1000);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const activeChatData = conversations.find(
    c => c.address.toLowerCase() === activeChat?.toLowerCase()
  );

  const filteredConversations = conversations.filter(c =>
    c.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isConnected) {
    return (
      <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }} className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
          <p style={{ color: "var(--text-secondary)" }} className="mb-4">Connect your wallet to continue</p>
          <button onClick={() => connect()} className="bg-blue-500 text-white px-6 py-3 rounded-full font-semibold">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }} className="flex h-screen overflow-hidden">

      {/* Sidebar */}
      <div style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-color)" }} className="w-80 flex flex-col shrink-0">

        {/* Header */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-base">ArcMail</span>
            </div>
            <button
              onClick={() => setShowNewChat(true)}
              className="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition text-xl"
              title="New message"
            >
              +
            </button>
          </div>

          {/* Search */}
          <div style={{ background: "var(--input-bg)" }} className="flex items-center gap-2 px-3 py-2 rounded-xl">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: "transparent", color: "var(--text-primary)" }}
              className="flex-1 text-sm outline-none"
            />
          </div>
        </div>

        {/* New chat */}
        {showNewChat && (
          <div className="px-4 pb-3">
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} className="rounded-2xl p-3">
              <p style={{ color: "var(--text-secondary)" }} className="text-xs font-medium mb-2">New conversation</p>
              <input
                type="text"
                placeholder="wallet or alias@arcmail.io"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStartNewChat()}
                style={{ background: "var(--input-bg)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}
                className="w-full text-sm px-3 py-2 rounded-xl outline-none mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={handleStartNewChat} className="flex-1 bg-blue-500 text-white text-xs font-semibold py-2 rounded-xl">
                  Start Chat
                </button>
                <button
                  onClick={() => setShowNewChat(false)}
                  style={{ background: "var(--active-color)" }}
                  className="flex-1 text-xs font-semibold py-2 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center mb-3">
                <span className="text-white font-bold">+</span>
              </div>
              <p style={{ color: "var(--text-secondary)" }} className="text-sm font-medium">No conversations yet</p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs mt-1">Tap + to start a new chat</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.address}
                onClick={() => handleSelectChat(conv.address)}
                style={{
                  background: activeChat?.toLowerCase() === conv.address.toLowerCase()
                    ? "var(--active-color)"
                    : "transparent",
                  borderBottom: "1px solid var(--border-color)",
                }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:opacity-80 transition"
              >
                <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {conv.alias?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate">{conv.alias}</p>
                    <p style={{ color: "var(--text-secondary)" }} className="text-xs shrink-0 ml-2">
                      {formatTime(conv.timestamp)}
                    </p>
                  </div>
                  <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate mt-0.5">
                    {conv.address.slice(0,6)}...{conv.address.slice(-4)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* User info */}
        <div style={{ borderTop: "1px solid var(--border-color)" }} className="px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {alias?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{alias}</p>
            <p style={{ color: "var(--text-secondary)" }} className="text-xs truncate">
              {address?.slice(0,6)}...{address?.slice(-4)}
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      {activeChat ? (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Chat header */}
          <div style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-primary)" }} className="flex items-center gap-3 px-6 py-3 shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {(activeChatData?.alias || activeChat)?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {activeChatData?.alias || activeChat?.slice(0,6) + "..." + activeChat?.slice(-4)}
              </p>
              <p style={{ color: "var(--text-secondary)" }} className="text-xs">
                {activeChat?.slice(0,6)}...{activeChat?.slice(-4)}
              </p>
            </div>
            <button
              onClick={() => loadMessages(activeChat)}
              style={{ color: "var(--text-secondary)" }}
              className="ml-auto text-sm p-2 rounded-full hover:opacity-70 transition"
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto px-4 py-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p style={{ color: "var(--text-secondary)" }} className="text-sm">Loading messages...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-white font-bold text-2xl">Hi</span>
                </div>
                <p className="font-semibold mb-1">Start a conversation</p>
                <p style={{ color: "var(--text-secondary)" }} className="text-sm">Send a message to get started</p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const prevMsg = messages[i - 1];
                  const showDate = !prevMsg ||
                    new Date(msg.timestamp * 1000).toDateString() !==
                    new Date(prevMsg.timestamp * 1000).toDateString();
                  return (
                    <div key={String(msg.index) + "-" + i}>
                      {showDate && (
                        <div className="flex items-center justify-center my-4">
                          <span
                            style={{
                              background: "var(--bg-secondary)",
                              color: "var(--text-secondary)",
                              border: "1px solid var(--border-color)",
                            }}
                            className="text-xs px-3 py-1 rounded-full"
                          >
                            {new Date(msg.timestamp * 1000).toLocaleDateString([], {
                              weekday: "long", month: "long", day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                      <div className={"flex mb-2 " + (msg.isOutgoing ? "justify-end" : "justify-start")}>
                        <div className="max-w-xs lg:max-w-md xl:max-w-lg">
                          <div
                            style={{
                              background: msg.isOutgoing ? "var(--bg-bubble-out)" : "var(--bg-bubble-in)",
                              color: msg.isOutgoing ? "var(--text-bubble-out)" : "var(--text-bubble-in)",
                            }}
                            className={"px-4 py-2.5 text-sm leading-relaxed shadow-sm " +
                              (msg.isOutgoing
                                ? "rounded-t-2xl rounded-l-2xl rounded-br-sm"
                                : "rounded-t-2xl rounded-r-2xl rounded-bl-sm")}
                          >
                            {msg.body}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.attachments.map((cid, j) => (
                                  
                                    key={j}
                                    href={PINATA_GATEWAY + cid}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100"
                                  >
                                    [Attachment {j + 1}]
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <p
                            style={{ color: "var(--text-secondary)" }}
                            className={"text-xs mt-1 " + (msg.isOutgoing ? "text-right" : "text-left")}
                          >
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Attachment preview */}
          {files.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-secondary)" }} className="px-4 py-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                >
                  <span>[file]</span>
                  <span className="truncate max-w-24">{f.name}</span>
                  <button
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 font-bold ml-1"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-primary)" }} className="px-4 py-3 flex items-end gap-3">
            <label
              className="cursor-pointer p-2 rounded-full hover:opacity-70 transition shrink-0"
              style={{ color: "var(--text-secondary)" }}
              title="Attach file"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }}
                className="hidden"
              />
            </label>

            <div
              style={{ background: "var(--input-bg)", border: "1px solid var(--border-color)" }}
              className="flex-1 flex items-end rounded-2xl px-4 py-2.5"
            >
              <textarea
                placeholder="Message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  background: "transparent",
                  color: "var(--text-primary)",
                  resize: "none",
                  maxHeight: "120px",
                }}
                className="flex-1 text-sm outline-none"
                rows={1}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending || (!newMessage.trim() && files.length === 0)}
              className="w-10 h-10 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition shrink-0"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m22 2-7 20-4-9-9-4 20-7z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mb-6">
            <span className="text-white font-bold text-3xl">A</span>
          </div>
          <h2 className="text-xl font-bold mb-2">ArcMail Messenger</h2>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm max-w-xs mb-6">
            Select a conversation or start a new chat to send encrypted messages
          </p>
          <button
            onClick={() => setShowNewChat(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 rounded-full text-sm transition"
          >
            Start New Chat
          </button>
        </div>
      )}
    </div>
  );
}