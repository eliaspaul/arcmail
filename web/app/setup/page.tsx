"use client";
import { useState, useEffect } from "react";
import { useAccount, useContractWrite } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { useConnect, useRouter } from "next/navigation";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/contracts/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function SetupPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  const { writeAsync } = useContractWrite({
    address: CONTRACT_ADDRESS as any,
    abi: CONTRACT_ABI,
    functionName: "setAlias",
  });

  useEffect(() => {
    if (!isConnected) { router.push("/"); return; }
    fetch(API_URL + "/api/alias/by-address/" + address)
      .then(r => r.json())
      .then(data => { if (data.alias) router.push("/messenger"); })
      .catch(() => {});
  }, [isConnected, address]);

  const checkAvailability = async (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(clean);
    setAvailable(null);
    if (clean.length < 3) return;
    setChecking(true);
    try {
      const res = await fetch(API_URL + "/api/alias/check/" + clean);
      const data = await res.json();
      setAvailable(data.available);
    } catch { setAvailable(null); }
    setChecking(false);
  };

  const handleRegister = async () => {
    try {
      setError("");
      if (!username || username.length < 3) return setError("Username must be at least 3 characters");
      if (!available) return setError("Username is not available");
      setStatus("registering");
      await writeAsync({ args: [username] });
      const res = await fetch(API_URL + "/api/alias/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus("done");
      setTimeout(() => router.push("/messenger"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }} className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <span className="text-3xl">🎭</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Choose your username</h1>
          <p style={{ color: "var(--text-secondary)" }} className="text-sm">
            This is how people will find and message you on ArcMail.
          </p>
        </div>

        <div style={{ background: "var(--input-bg)", border: "1px solid var(--border-color)" }} className="flex items-center rounded-2xl px-4 py-3 mb-2">
          <input
            type="text"
            placeholder="yourname"
            value={username}
            onChange={(e) => checkAvailability(e.target.value)}
            style={{ background: "transparent", color: "var(--text-primary)" }}
            className="flex-1 text-base outline-none"
            maxLength={30}
          />
          <span style={{ color: "var(--text-secondary)" }} className="text-sm font-medium">@arcmail.io</span>
        </div>

        {username.length >= 3 && (
          <p className={"text-xs mb-4 px-1 " + (checking ? "text-gray-400" : available ? "text-green-500" : "text-red-500")}>
            {checking ? "Checking..." : available ? "✓ Available" : "✗ Already taken"}
          </p>
        )}

        {error && <p className="text-red-500 text-xs mb-4 px-1">{error}</p>}

        <button
          onClick={handleRegister}
          disabled={!available || status === "registering" || status === "done"}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-2xl text-sm transition mb-6"
        >
          {status === "registering" ? "Registering on-chain..." :
           status === "done" ? "✓ Done! Opening messenger..." :
           username ? "Claim " + username + "@arcmail.io" : "Enter a username"}
        </button>

        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} className="rounded-2xl p-4">
          <p style={{ color: "var(--text-secondary)" }} className="text-xs mb-1">Connected wallet</p>
          <p className="text-xs font-mono break-all">{address}</p>
        </div>

        <p style={{ color: "var(--text-secondary)" }} className="text-xs text-center mt-4">
          Your alias is permanently recorded on Arc Testnet
        </p>
      </div>
    </div>
  );
}