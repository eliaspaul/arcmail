"use client";
import { useState } from "react";
import { useAccount, useConnect, useContractWrite } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { isAddress } from "viem";
import Link from "next/link";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/contracts/config";
import { uploadToIPFS } from "@/lib/api";
import { encryptMessage } from "@/lib/crypto";

export default function ComposePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({ connector: new InjectedConnector() });
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const { writeAsync } = useContractWrite({
    address: CONTRACT_ADDRESS as any,
    abi: CONTRACT_ABI,
    functionName: "sendMessage",
  });

  const handleSend = async () => {
    try {
      setError("");
      if (!isAddress(to)) return setError("Invalid recipient wallet address");
      if (!subject.trim()) return setError("Subject is required");
      if (!body.trim()) return setError("Message body is required");
      if (!address) return setError("Wallet not connected");
      setStatus("encrypting");
      const encryptedContent = encryptMessage(body, to);
      setStatus("uploading");
      const cid = await uploadToIPFS({ subject: subject.trim(), encryptedContent, senderAddress: address, receiverAddress: to });
      setStatus("sending");
      const result = await writeAsync({ args: [to, cid] });
      setTxHash(result.hash);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6">
        <p className="text-gray-400">Connect your wallet to compose a message</p>
        <button onClick={() => connect()} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg">Connect Wallet</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Link href="/inbox" className="text-gray-400 hover:text-white">Back</Link>
          <span className="font-semibold text-lg">Compose</span>
        </div>
        <span className="text-sm font-mono text-gray-400">{address?.slice(0,6)}...{address?.slice(-4)}</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">To (wallet address)</label>
            <input type="text" placeholder="0x..." value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subject</label>
            <input type="text" placeholder="Subject..." value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Message</label>
            <textarea placeholder="Write your message..." value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          {error && <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
          {status !== "idle" && status !== "error" && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg px-4 py-3 text-blue-400 text-sm">
              {status === "encrypting" && "Encrypting message..."}
              {status === "uploading" && "Uploading to IPFS..."}
              {status === "sending" && "Recording on Arc Testnet..."}
              {status === "done" && "Message sent successfully!"}
            </div>
          )}
          <button onClick={handleSend} disabled={["encrypting","uploading","sending"].includes(status)} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-medium py-3 rounded-lg">
            {["encrypting","uploading","sending"].includes(status) ? "Sending..." : "Send Message"}
          </button>
        </div>
      </div>
    </main>
  );
}

