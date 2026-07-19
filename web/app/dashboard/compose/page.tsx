"use client";
import { useState, useEffect, Suspense } from "react";
import { useAccount, useContractWrite } from "wagmi";
import { isAddress } from "viem";
import { useRouter, useSearchParams } from "next/navigation";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/contracts/config";
import { uploadToIPFS } from "@/lib/api";
import { encryptMessage } from "@/lib/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function ComposeForm() {
  const { address } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [to, setTo] = useState(searchParams.get("to") || "");
  const [subject, setSubject] = useState(searchParams.get("subject") || "");
  const [body, setBody] = useState(searchParams.get("body") || "");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const { writeAsync } = useContractWrite({
    address: CONTRACT_ADDRESS as any,
    abi: CONTRACT_ABI,
    functionName: "sendMessage",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
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
    try {
      setError("");
      let recipient = to.trim();

      if (recipient.includes("@arcmail.io")) {
        const username = recipient.replace("@arcmail.io", "").trim();
        const res = await fetch(API_URL + "/api/alias/by-alias/" + username);
        if (!res.ok) return setError("Alias not found: " + recipient);
        const data = await res.json();
        recipient = data.address;
      }

      if (!isAddress(recipient)) return setError("Invalid recipient wallet address or alias");
      if (!subject.trim()) return setError("Subject is required");
      if (!body.trim()) return setError("Message body is required");
      if (!address) return setError("Wallet not connected");

      setStatus("encrypting");
      const encryptedContent = encryptMessage(body, recipient);

      setStatus("uploading");
      let attachmentCids: string[] = [];
      if (files.length > 0) attachmentCids = await uploadAttachments();

      const cid = await uploadToIPFS({
        subject: subject.trim(),
        encryptedContent,
        senderAddress: address,
        receiverAddress: recipient,
        attachments: attachmentCids,
      });

      setStatus("sending");
      const result = await writeAsync({ args: [recipient, cid] });

      // Record in sent folder
      await fetch(API_URL + "/api/sent/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderAddress: address,
          receiverAddress: recipient,
          ipfsHash: cid,
          timestamp: Math.floor(Date.now() / 1000),
          index: result.hash,
        }),
      });

      setStatus("done");
      setTimeout(() => router.push("/dashboard/sent"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const isSending = ["encrypting", "uploading", "sending"].includes(status);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="font-semibold text-base">New Message</h1>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-black text-sm transition">
          Discard
        </button>
      </div>

      {/* Compose area */}
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6 py-6">
        <div className="flex-1 border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          {/* To */}
          <div className="flex items-center px-5 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-16 shrink-0">To</span>
            <input
              type="text"
              placeholder="wallet address or username@arcmail.io"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 text-sm outline-none placeholder-gray-300"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center px-5 py-3 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-16 shrink-0">Subject</span>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 text-sm outline-none placeholder-gray-300"
            />
          </div>

          {/* Body */}
          <div className="flex-1 px-5 py-4">
            <textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-full text-sm outline-none resize-none placeholder-gray-300"
            />
          </div>

          {/* Attachments preview */}
          {files.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 text-xs border border-gray-200">
                  <span>📎</span>
                  <span className="truncate max-w-32 text-gray-700">{f.name}</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 transition font-bold">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSend}
                disabled={isSending}
                className="bg-black text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition"
              >
                {status === "encrypting" ? "Encrypting..." :
                 status === "uploading" ? "Uploading..." :
                 status === "sending" ? "Sending..." :
                 status === "done" ? "✓ Sent" : "Send"}
              </button>
              <label className="cursor-pointer flex items-center gap-1.5 text-gray-500 hover:text-black border border-gray-200 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition text-xs">
                <span>📎</span> Attach file
                <input type="file" multiple onChange={handleFileChange} className="hidden" />
              </label>
            </div>
            {error && <p className="text-red-500 text-xs max-w-xs text-right">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense>
      <ComposeForm />
    </Suspense>
  );
}