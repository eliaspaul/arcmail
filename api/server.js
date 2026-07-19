const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const upload = multer({ storage: multer.memoryStorage() });

const ALIASES_FILE = './aliases.json';
const STATES_FILE = './message_states.json';
const SENT_FILE = './sent_messages.json';

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

// ─── File helpers ────────────────────────────────────────────────────────────

function loadJSON(file, def = {}) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Basic routes ────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.json({ status: 'ArcMail API running', version: '1.0.0' }));
app.get('/health', (req, res) => res.json({ ok: true }));

// ─── Alias routes ────────────────────────────────────────────────────────────

app.get('/api/alias/check/:username', (req, res) => {
  const { username } = req.params;
  const aliases = loadJSON(ALIASES_FILE);
  const taken = Object.values(aliases).includes(username.toLowerCase());
  res.json({ available: !taken });
});

app.post('/api/alias/register', (req, res) => {
  try {
    const { address, username } = req.body;
    if (!address || !username) return res.status(400).json({ error: 'Missing fields' });
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) return res.status(400).json({ error: 'Username too short' });
    const aliases = loadJSON(ALIASES_FILE);
    if (aliases[address.toLowerCase()]) return res.status(400).json({ error: 'Wallet already has an alias' });
    if (Object.values(aliases).includes(clean)) return res.status(400).json({ error: 'Username taken' });
    aliases[address.toLowerCase()] = clean;
    saveJSON(ALIASES_FILE, aliases);
    res.json({ success: true, alias: clean + '@arcmail.io' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alias/by-address/:address', (req, res) => {
  const { address } = req.params;
  const aliases = loadJSON(ALIASES_FILE);
  const username = aliases[address.toLowerCase()];
  if (!username) return res.status(404).json({ error: 'No alias found' });
  res.json({ alias: username + '@arcmail.io', username });
});

app.get('/api/alias/by-alias/:username', (req, res) => {
  const { username } = req.params;
  const aliases = loadJSON(ALIASES_FILE);
  const entry = Object.entries(aliases).find(([, v]) => v === username.toLowerCase());
  if (!entry) return res.status(404).json({ error: 'Alias not found' });
  res.json({ address: entry[0], alias: username + '@arcmail.io' });
});

// ─── Message state routes ─────────────────────────────────────────────────────
// States: inbox | archived | deleted
// Key format: address_messageIndex

app.post('/api/message/state', (req, res) => {
  try {
    const { address, index, state } = req.body;
    if (!address || index === undefined || !state) return res.status(400).json({ error: 'Missing fields' });
    const states = loadJSON(STATES_FILE);
    const key = address.toLowerCase() + '_' + index;
    states[key] = { state, updatedAt: Date.now() };
    saveJSON(STATES_FILE, states);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/message/states/:address', (req, res) => {
  const { address } = req.params;
  const states = loadJSON(STATES_FILE);
  const result = {};
  for (const [key, val] of Object.entries(states)) {
    if (key.startsWith(address.toLowerCase() + '_')) {
      const idx = key.split('_')[1];
      result[idx] = val;
    }
  }
  res.json({ states: result });
});

// Permanently delete all trashed messages for an address
app.delete('/api/message/trash/:address', (req, res) => {
  try {
    const { address } = req.params;
    const states = loadJSON(STATES_FILE);
    for (const key of Object.keys(states)) {
      if (key.startsWith(address.toLowerCase() + '_') && states[key].state === 'deleted') {
        delete states[key];
      }
    }
    saveJSON(STATES_FILE, states);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-wipe deleted messages older than 30 days
function autoWipeDeleted() {
  const states = loadJSON(STATES_FILE);
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  for (const [key, val] of Object.entries(states)) {
    if (val.state === 'deleted' && Date.now() - val.updatedAt > thirtyDays) {
      delete states[key];
    }
  }
  saveJSON(STATES_FILE, states);
}
setInterval(autoWipeDeleted, 60 * 60 * 1000); // run every hour

// ─── Sent messages routes ─────────────────────────────────────────────────────

app.post('/api/sent/record', (req, res) => {
  try {
    const { senderAddress, receiverAddress, ipfsHash, timestamp, index } = req.body;
    const sent = loadJSON(SENT_FILE, {});
    if (!sent[senderAddress.toLowerCase()]) sent[senderAddress.toLowerCase()] = [];
    sent[senderAddress.toLowerCase()].unshift({ receiverAddress, ipfsHash, timestamp, index });
    saveJSON(SENT_FILE, sent);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sent/:address', (req, res) => {
  const { address } = req.params;
  const sent = loadJSON(SENT_FILE, {});
  const messages = sent[address.toLowerCase()] || [];
  res.json({ messages });
});

// ─── IPFS upload routes ───────────────────────────────────────────────────────

app.post('/api/upload', async (req, res) => {
  try {
    const { subject, encryptedContent, senderAddress, receiverAddress, attachments } = req.body;
    if (!subject || !encryptedContent || !senderAddress || !receiverAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const payload = {
      subject,
      encryptedContent,
      senderAddress,
      receiverAddress,
      attachments: attachments || [],
      timestamp: Date.now(),
      version: '1.0',
    };
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_SECRET,
      },
      body: JSON.stringify({
        pinataContent: payload,
        pinataMetadata: { name: 'arcmail-' + Date.now() },
      }),
    });
    if (!response.ok) throw new Error('Pinata error: ' + await response.text());
    const data = await response.json();
    res.json({ cid: data.IpfsHash, success: true });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-file', upload.single('file'), async (req, res) => {
  try {
    const { originalname, buffer, mimetype } = req.file;
    const blob = new Blob([buffer], { type: mimetype });
    const formData = new FormData();
    formData.append('file', blob, originalname);
    formData.append('pinataMetadata', JSON.stringify({ name: originalname }));
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_SECRET,
      },
      body: formData,
    });
    const data = await response.json();
    res.json({ cid: data.IpfsHash, name: originalname });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/message/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const response = await fetch(gateway + '/ipfs/' + cid);
    if (!response.ok) throw new Error('Failed to fetch from IPFS');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Inbox route ──────────────────────────────────────────────────────────────

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
        messages.push({
          index: Number(idx),
          sender,
          receiver,
          ipfsHash,
          timestamp: Number(timestamp),
        });
      } catch { continue; }
    }
    res.json({ messages });
  } catch (error) {
    console.error('Inbox error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('ArcMail API running on http://localhost:' + PORT);
  autoWipeDeleted();
});