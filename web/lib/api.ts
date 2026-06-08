const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function uploadToIPFS(data: {
  subject: string;
  encryptedContent: string;
  senderAddress: string;
  receiverAddress: string;
}): Promise<string> {
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Upload failed');
  }

  const { cid } = await res.json();
  return cid;
}

export async function fetchFromIPFS(cid: string): Promise<{
  subject: string;
  encryptedContent: string;
  senderAddress: string;
  receiverAddress: string;
  timestamp: number;
}> {
  const res = await fetch(`${API_URL}/api/message/${cid}`);
  if (!res.ok) throw new Error('Failed to fetch message');
  return res.json();
}