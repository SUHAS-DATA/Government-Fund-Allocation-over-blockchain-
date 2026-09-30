import contractInfo from '../config/contract_info.json';

export const getContractAddress = () => {
  return contractInfo?.contractAddress || '0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20';
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

// Directory of Multi-Tier Government Accounts & Registered Contractors
export const KNOWN_ENTITIES = {
  // Administrative Accounts
  '0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B': {
    name: 'Ministry of Finance (Central Office)',
    shortName: 'Finance Dept',
    tier: 'Tier 1: Central Finance',
    color: '#0369A1',
    bg: '#E0F2FE'
  },
  '0x3bE9Fb1473BcAEe6790dBb9556A8C9637eCC54bC': {
    name: 'Karnataka State Finance Department',
    shortName: 'State Office',
    tier: 'Tier 2: State Department',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x2Db964805531b2cc0Cb6961AF0f7d7489F1e4Aa9': {
    name: 'Belagavi District Office',
    shortName: 'District Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0xd49155782d0C91e4fF69024ACf6F7811467800C2': {
    name: 'Apex Infrastructure Contractors Pvt Ltd',
    shortName: 'Contractor',
    tier: 'Tier 4: Contractor Account',
    color: '#15803D',
    bg: '#DCFCE7'
  },
  '0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20': {
    name: 'Government Project Account',
    shortName: 'Project Account',
    tier: 'Project Account',
    color: '#6D28D9',
    bg: '#EDE9FE'
  },
  // Central Apex
  '0x1E3A8A93FD0b4c8A9bE14c46f1F0A84D63A50001': {
    name: 'Central Secretariat',
    shortName: 'Central Office',
    tier: 'Tier 1: Central Admin',
    color: '#0F766E',
    bg: '#CCFBF1'
  },
  '0x0F766E99F6E4A836bE9344445839DC9E86DA0002': {
    name: 'Ministry of Finance',
    shortName: 'Finance Dept',
    tier: 'Tier 1: Central Finance',
    color: '#0369A1',
    bg: '#E0F2FE'
  },
  // State Departments
  '0x0369A1BAE6FD3c8290f79BF6Eb2C4F8703650003': {
    name: 'Karnataka State Department',
    shortName: 'Karnataka State',
    tier: 'Tier 2: State Department',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x14dC79964da2C08b23698B3D3cc7Ca32193D0004': {
    name: 'Maharashtra State Department',
    shortName: 'Maharashtra State',
    tier: 'Tier 2: State Department',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C0005': {
    name: 'Gujarat State Department',
    shortName: 'Gujarat State',
    tier: 'Tier 2: State Department',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x9965507D1a55bcC2695C58ba16FB37d819B00006': {
    name: 'Tamil Nadu State Department',
    shortName: 'Tamil Nadu State',
    tier: 'Tier 2: State Department',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  '0x976EA74026E726554dB657fA54763abd0C3a0007': {
    name: 'Uttar Pradesh State Department',
    shortName: 'UP State',
    tier: 'Tier 2: State Department',
    color: '#4338CA',
    bg: '#EEF2FF'
  },
  // District Offices
  '0x7C3AEDDDD6FE90f79BF6eb2C4f870365E7850008': {
    name: 'Belagavi District Office',
    shortName: 'Belagavi Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x90F79bf6EB2c4f870365E785982E1f101E930009': {
    name: 'Bengaluru Urban Office',
    shortName: 'Bengaluru Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA420010': {
    name: 'Mysuru District Office',
    shortName: 'Mysuru Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x92db14e403b83dfe3df233f83dfa3a0d709600016': {
    name: 'Mangaluru District Office',
    shortName: 'Mangaluru Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B20011': {
    name: 'Pune District Office',
    shortName: 'Pune Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x8b3a350cf5c34c9194ca85829a2df0ec315300015': {
    name: 'Nagpur District Office',
    shortName: 'Nagpur Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0xBcd4042DE499D14e55001CcbB24a551F3b900014': {
    name: 'Ahmedabad District Office',
    shortName: 'Ahmedabad Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0x71bE63f3384f5fb9899544c7b624147781400013': {
    name: 'Chennai District Office',
    shortName: 'Chennai Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a70012': {
    name: 'Lucknow District Office',
    shortName: 'Lucknow Office',
    tier: 'Tier 3: District Office',
    color: '#B45309',
    bg: '#FEF3C7'
  },
  // Contractors
  '0xC2410CFED7AA70997970C51812dc3A010C7d0017': {
    name: 'Apex Infrastructure Contractors Pvt Ltd',
    shortName: 'Apex Infra',
    tier: 'Tier 4: Contractor Account',
    color: '#15803D',
    bg: '#DCFCE7'
  },
  '0x5de4111afa1a4b94908f83103eb1f17063670018': {
    name: 'Karnataka Highway Infra Concessionaires',
    shortName: 'KA Highway Infra',
    tier: 'Tier 4: Contractor Account',
    color: '#15803D',
    bg: '#DCFCE7'
  },
  '0x7c852118294e51e653712a81e05800f419140019': {
    name: 'Southern Roads & Bridges Infrastructure',
    shortName: 'Southern Roads',
    tier: 'Tier 4: Contractor Account',
    color: '#15803D',
    bg: '#DCFCE7'
  },
  // Project Account
  '0x825A248BdC512e02e77445B3D76Ab01eBC46A22B': {
    name: 'Government Project Account',
    shortName: 'Project Account',
    tier: 'Project Account',
    color: '#6D28D9',
    bg: '#EDE9FE'
  }
};

export const getKnownEntity = (address, fallbackName = null) => {
  if (!address) return { name: fallbackName || 'Public Citizen', shortName: fallbackName || 'Public', tier: 'Public User', color: '#64748B', bg: '#F1F5F9' };
  
  const target = String(address).toLowerCase();
  for (const [k, v] of Object.entries(KNOWN_ENTITIES)) {
    if (k.toLowerCase() === target) return v;
  }
  
  const contract = getContractAddress().toLowerCase();
  if (target === contract) return KNOWN_ENTITIES['0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20'] || KNOWN_ENTITIES['0x825A248BdC512e02e77445B3D76Ab01eBC46A22B'];

  return {
    name: fallbackName || `Verified Account (${formatAddress(address)})`,
    shortName: fallbackName || formatAddress(address),
    tier: 'Verified Account',
    color: '#334155',
    bg: '#F8FAFC'
  };
};
