'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import Link from 'next/link';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect({ connector: new InjectedConnector() });
  const { disconnect } = useDisconnect();

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="flex items-center justify-between p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">A</div>
          <span className="font-semibold text-lg">ArcMail</span>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-gray-400">{address?.slice(0,6)}...{address?.slice(-4)}</span>
            <button onClick={() => disconnect()} className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition">Disconnect</button>
          </div>
        ) : (
          <button onClick={() => connect()} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition">Connect Wallet</button>
        )}
      </header>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <h1 className="text-5xl font-bold mb-6 leading-tight">Encrypted Email<br /><span className="text-blue-400">for Web3 Wallets</span></h1>
        <p className="text-gray-400 text-lg max-w-xl mb-10">Send encrypted messages wallet-to-wallet. Messages stored on IPFS, metadata recorded on Arc Testnet.</p>
        {isConnected ? (
          <div className="flex gap-4">
            <Link href="/inbox" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition">Open Inbox</Link>
            <Link href="/compose" className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-6 py-3 rounded-lg transition">Compose Message</Link>
          </div>
        ) : (
          <p className="text-gray-400">Connect your wallet to get started</p>
        )}
      </div>
    </main>
  );
}
