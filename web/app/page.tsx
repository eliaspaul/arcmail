"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LandingPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({ connector: new InjectedConnector() });
  const router = useRouter();

  useEffect(() => {
    if (!isConnected || !address) return;
    fetch(API_URL + "/api/alias/by-address/" + address)
      .then(r => r.json())
      .then(data => {
        if (data.alias) router.push("/messenger");
        else router.push("/setup");
      })
      .catch(() => router.push("/setup"));
  }, [isConnected, address]);

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }} className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid var(--border-color)" }} className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-base">A</span>
          </div>
          <span className="font-bold text-xl tracking-tight">ArcMail</span>
        </div>
        <button
          onClick={() => connect()}
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition shadow-sm"
        >
          Get Started
        </button>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="w-24 h-24 bg-blue-500 rounded-3xl flex items-center justify-center shadow-2xl mb-8">
          <span className="text-5xl">💬</span>
        </div>
        <h1 className="text-5xl font-bold mb-4 tracking-tight">
          Private Messaging<br />
          <span className="text-blue-500">for Web3</span>
        </h1>
        <p style={{ color: "var(--text-secondary)" }} className="text-lg max-w-md mb-10 leading-relaxed">
          Send encrypted messages directly between wallets.
          No servers. No surveillance. Just you and your contacts.
        </p>

        <button
          onClick={() => connect()}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-10 py-4 rounded-full text-base transition shadow-lg hover:shadow-xl mb-4"
        >
          Connect Wallet to Start
        </button>
        <p style={{ color: "var(--text-secondary)" }} className="text-xs">
          Works with MetaMask and any EVM wallet
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          {["🔐 End-to-End Encrypted", "📡 IPFS Storage", "⛓️ On-Chain", "📎 File Sharing", "🎭 Aliases"].map(f => (
            <div key={f} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} className="px-4 py-2 rounded-full text-sm font-medium">
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-secondary)" }} className="px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", icon: "🔗", title: "Connect Wallet", desc: "Use MetaMask or any EVM wallet. Your wallet is your identity." },
              { step: "2", icon: "🎭", title: "Get Your Alias", desc: "Choose username@arcmail.io — share it like a normal address." },
              { step: "3", icon: "💬", title: "Start Messaging", desc: "Send encrypted messages to any wallet or alias instantly." },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-md">
                  {s.icon}
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p style={{ color: "var(--text-secondary)" }} className="text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border-color)" }} className="px-8 py-4 flex items-center justify-between text-xs" >
        <span style={{ color: "var(--text-secondary)" }}>© 2026 ArcMail · Built on Arc Testnet</span>
        <span style={{ color: "var(--text-secondary)" }}>Encrypted · Decentralized · Open</span>
      </div>
    </div>
  );
}