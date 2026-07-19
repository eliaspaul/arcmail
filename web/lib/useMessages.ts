import { useState, useEffect } from "react";
import { fetchFromIPFS } from "./api";
import { decryptMessage } from "./crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface Message {
  index: number;
  sender: string;
  receiver: string;
  ipfsHash: string;
  timestamp: number;
  subject: string;
  body: string;
  attachments: string[];
  state: string;
}

export async function setMessageState(address: string, index: number, state: string) {
  await fetch(API_URL + "/api/message/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, index, state }),
  });
}

export async function emptyTrash(address: string) {
  await fetch(API_URL + "/api/message/trash/" + address, { method: "DELETE" });
}

export function useInbox(address: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [inboxRes, statesRes] = await Promise.all([
        fetch(API_URL + "/api/inbox/" + address),
        fetch(API_URL + "/api/message/states/" + address),
      ]);
      const inboxData = await inboxRes.json();
      const statesData = await statesRes.json();
      const states = statesData.states || {};

      const fetched: Message[] = [];
      for (const msg of inboxData.messages) {
        const state = states[msg.index]?.state || "inbox";
        try {
          const ipfsData = await fetchFromIPFS(msg.ipfsHash);
          const body = decryptMessage(ipfsData.encryptedContent, address);
          fetched.push({
            ...msg,
            subject: ipfsData.subject,
            body,
            attachments: ipfsData.attachments || [],
            state,
          });
        } catch {
          fetched.push({ ...msg, subject: "Message " + msg.index, body: "[Could not load]", attachments: [], state });
        }
      }
      setMessages(fetched);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [address]);
  return { messages, loading, refresh };
}

export function useSent(address: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(API_URL + "/api/sent/" + address);
      const data = await res.json();
      const fetched: Message[] = [];
      for (const msg of data.messages) {
        try {
          const ipfsData = await fetchFromIPFS(msg.ipfsHash);
          fetched.push({
            index: msg.index,
            sender: address,
            receiver: msg.receiverAddress,
            ipfsHash: msg.ipfsHash,
            timestamp: msg.timestamp,
            subject: ipfsData.subject,
            body: ipfsData.encryptedContent,
            attachments: ipfsData.attachments || [],
            state: "sent",
          });
        } catch {
          fetched.push({
            index: msg.index,
            sender: address,
            receiver: msg.receiverAddress,
            ipfsHash: msg.ipfsHash,
            timestamp: msg.timestamp,
            subject: "Message " + msg.index,
            body: "[Could not load]",
            attachments: [],
            state: "sent",
          });
        }
      }
      setMessages(fetched);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [address]);
  return { messages, loading, refresh };
}