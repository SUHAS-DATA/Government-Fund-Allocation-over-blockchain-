import contractInfo from '../config/contract_info.json';

export const getContractAddress = () => {
  return contractInfo?.contractAddress || '0x825A248BdC512e02e77445B3D76Ab01eBC46A22B';
};

export const formatTxHash = (hash, start = 8, end = 6) => {
  if (!hash) return '-';
  if (hash.length <= start + end) return hash;
  return `${hash.substring(0, start)}...${hash.substring(hash.length - end)}`;
};

export const formatAddress = (addr) => {
  if (!addr) return '-';
  if (addr.length <= 12) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
};

export const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} Lakh`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
};

// Authoritative Directory of Multi-Tier Government Wallets & Concessionaires
export const KNOWN_ENTITIES = {
  // Central Apex
  '0x1E3A8A93FD0b4c8A9bE14c46f1F0A84D63A50001': {
    name: 'Central Secretariat',
    shortName: 'Central Apex',
    tier: 'Tier 1: Central Admin',
    color: '#0F766E',
    bg: '#CCFBF1'
  },
  '0x0F766E99F6E4A836bE9344445839DC9E86DA0002': {
    name: 'Ministry of Finance',
    shortName: 'Finance Dept',
    tier: 'Tier 1: Finance Authority',
    color: '#0369A1',
    bg: '#E0F2FE'
  },
  // State Treasuries
  '0x0369A1BAE6FD3c8290f79BF6Eb2C4F8703650003': {
    name: 'Karnataka State Treasury',
    shortName: 'Karnataka Treasury',
    tier: 'Tier 2: State Treasury',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x14dC79964da2C08b23698B3D3cc7Ca32193D0004': {
    name: 'Maharashtra State Treasury',
    shortName: 'Maharashtra Treasury',
    tier: 'Tier 2: State Treasury',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C0005': {
    name: 'Gujarat State Treasury',
    shortName: 'Gujarat Treasury',
    tier: 'Tier 2: State Treasury',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x9965507D1a55bcC2695C58ba16FB37d819B00006': {
    name: 'Tamil Nadu State Treasury',
    shortName: 'Tamil Nadu Treasury',
    tier: 'Tier 2: State Treasury',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x976EA74026E726554dB657fA54763abd0C3a0007': {
    name: 'Uttar Pradesh State Treasury',
    shortName: 'UP Treasury',
    tier: 'Tier 2: State Treasury',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  // District Agencies
  '0x7C3AEDDDD6FE90f79BF6eb2C4f870365E7850008': {
    name: 'Belagavi District Agency',
    shortName: 'Belagavi DRDA',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x90F79bf6EB2c4f870365E785982E1f101E930009': {
    name: 'Bengaluru Urban Agency',
    shortName: 'Bengaluru Agency',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA420010': {
    name: 'Mysuru District Agency',
    shortName: 'Mysuru Agency',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x92db14e403b83dfe3df233f83dfa3a0d709600016': {
    name: 'Mangaluru District Agency',
    shortName: 'Mangaluru Agency',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B20011': {
    name: 'Pune District Agency',
    shortName: 'Pune DRDA',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x8b3a350cf5c34c9194ca85829a2df0ec315300015': {
    name: 'Nagpur District Agency',
    shortName: 'Nagpur Agency',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0xBcd4042DE499D14e55001CcbB24a551F3b900014': {
    name: 'Ahmedabad District Agency',
    shortName: 'Ahmedabad Agency',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x71bE63f3384f5fb9899544c7b624147781400013': {
    name: 'Chennai District Agency',
    shortName: 'Chennai Agency',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a70012': {
    name: 'Lucknow District Agency',
    shortName: 'Lucknow DRDA',
    tier: 'Tier 3: District Agency',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  // Contractors
  '0xC2410CFED7AA70997970C51812dc3A010C7d0017': {
    name: 'Apex Infrastructure Contractors Pvt Ltd',
    shortName: 'Apex Infra',
    tier: 'Tier 4: Contractor Escrow',
    color: '#15803D',
    bg: '#DCFCE7'
  },
  '0x5de4111afa1a4b94908f83103eb1f17063670018': {
    name: 'Karnataka Highway Infra Concessionaires',
    shortName: 'KA Highway Infra',
    tier: 'Tier 4: Contractor Escrow',
    color: '#15803D',
    bg: '#DCFCE7'
  },
  '0x7c852118294e51e653712a81e05800f419140019': {
    name: 'Southern Roads & Bridges Infrastructure',
    shortName: 'Southern Roads',
    tier: 'Tier 4: Contractor Escrow',
    color: '#15803D',
    bg: '#DCFCE7'
  },
  // Smart Contract Escrow
  '0x825A248BdC512e02e77445B3D76Ab01eBC46A22B': {
    name: 'Government Fund Tracking Smart Contract Escrow',
    shortName: 'Smart Contract Escrow',
    tier: 'Smart Contract Vault',
    color: '#6D28D9',
    bg: '#EDE9FE'
  },
  // Auditor
  '0xB91C1CFECACAa0Ee7A142d267C1f36714E4a8F750020': {
    name: 'CAG Audit & Inspection Directorate',
    shortName: 'CAG Auditor',
    tier: 'Oversight & Audit',
    color: '#BE123C',
    bg: '#FFE4E6'
  }
};

export const getKnownEntity = (address, fallbackName = null) => {
  if (!address) return { name: fallbackName || 'Public Citizen', shortName: fallbackName || 'Public', tier: 'Public User', color: '#64748B', bg: '#F1F5F9' };
  
  const target = String(address).toLowerCase();
  for (const [k, v] of Object.entries(KNOWN_ENTITIES)) {
    if (k.toLowerCase() === target) return v;
  }
  
  const contract = getContractAddress().toLowerCase();
  if (target === contract) return KNOWN_ENTITIES['0x825A248BdC512e02e77445B3D76Ab01eBC46A22B'];

  return {
    name: fallbackName || `Verified Account (${formatAddress(address)})`,
    shortName: fallbackName || formatAddress(address),
    tier: 'Network Participant',
    color: '#334155',
    bg: '#F8FAFC'
  };
};
