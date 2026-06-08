const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: ['http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

const CONTRACT_ADDRESS = '0x358F2B897e6372bdC889b6C0d3AdB0fdE32c9Ccc';
const ABI = [
  'function getInbox(address _wallet) view returns (uint256[])',
  'function getMessage(uint256 _index) view returns (address sender, address receiver, string ipfsHash, uint256 timestamp)',
];

app.get('/', (req, res) => {
  res.json({ status: 'ArcMail API running', version: '1.0.0' });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/api/upload', async (req, res) => {
  try {
    const { subject, encryptedContent, senderAddress, receiverAddress } = req.body;
    if (!subject || !encryptedContent || !senderAddress || !receiverAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const payload = { subject, encryptedContent, senderAddress, receiverAddress, timestamp: Date.now(), version: '1.0' };
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_SECRET,
      },
      body: JSON.stringify({ pinataContent: payload, pinataMetadata: { name: `arcmail-${Date.now()}` } }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Pinata error: ${err}`);
    }
    const data = await response.json();
    res.json({ cid: data.IpfsHash, success: true });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/message/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const response = await fetch(`${gateway}/ipfs/${cid}`);
    if (!response.ok) throw new Error('Failed to fetch from IPFS');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inbox/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    const indexes = await contract.getInbox(address);
    const messages = [];
    for (const idx of [...indexes].reverse()) {
      try {
        const [sender, receiver, ipfsHash, timestamp] = await contract.getMessage(idx);
        messages.push({ index: Number(idx), sender, receiver, ipfsHash, timestamp: Number(timestamp) });
      } catch { continue; }
    }
    res.json({ messages });
  } catch (error) {
    console.error('Inbox error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`ArcMail API running on http://localhost:${PORT}`);
});