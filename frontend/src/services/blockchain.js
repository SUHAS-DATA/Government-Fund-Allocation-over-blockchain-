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
