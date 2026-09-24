export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'RMB' | 'RUB';

// Convert amount from INR to target currency using exchange rate
export function convertFromINR(amountINR: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return amountINR;
  return amountINR / exchangeRate;
}

// Convert amount to INR from target currency using exchange rate
export function convertToINR(amount: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return amount;
  return amount * exchangeRate;
}

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  wordPrefix: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN',
    wordPrefix: 'INR',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    wordPrefix: 'USD',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    wordPrefix: 'EUR',
  },
  RMB: {
    code: 'RMB',
    symbol: '¥',
    name: 'Chinese Yuan',
    locale: 'zh-CN',
    wordPrefix: 'CNY',
  },
  RUB: {
    code: 'RUB',
    symbol: '₽',
    name: 'Russian Ruble',
    locale: 'ru-RU',
    wordPrefix: 'RUB',
  },
};

export const CURRENCY_OPTIONS = Object.values(CURRENCIES);

// Format rounded currency with Indian number formatting
export function formatRoundedINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function getCurrencySymbol(code: CurrencyCode): string {
  return CURRENCIES[code]?.symbol || '₹';
}

export function formatCurrencyAmount(amount: number, currencyCode: CurrencyCode = 'INR'): string {
  const currency = CURRENCIES[currencyCode];
  if (!currency) {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  return amount.toLocaleString(currency.locale, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

export function formatCurrencyWithSymbol(amount: number, currencyCode: CurrencyCode = 'INR'): string {
  const currency = CURRENCIES[currencyCode];
  if (!currency) {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  // For most currencies, symbol comes before amount
  const formattedAmount = formatCurrencyAmount(amount, currencyCode);
  return `${currency.symbol}${formattedAmount}`;
}

// Number to words functions for different currencies
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertTwoDigits(num: number): string {
  if (num < 20) return ones[num];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return tens[ten] + (one ? ' ' + ones[one] : '');
}

function convertThreeDigits(num: number): string {
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  if (hundred === 0) return convertTwoDigits(remainder);
  return ones[hundred] + ' Hundred' + (remainder ? ' ' + convertTwoDigits(remainder) : '');
}

// Indian system (Crore, Lakh, Thousand)
function convertToIndianSystemWords(amount: number): string {
  if (amount === 0) return 'Zero';
  
  const rupees = Math.floor(amount);
  
  if (rupees === 0) return 'Zero';
  
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;
  
  const parts: string[] = [];
  
  if (crore > 0) {
    parts.push(convertTwoDigits(crore) + ' Crore');
  }
  if (lakh > 0) {
    parts.push(convertTwoDigits(lakh) + ' Lakh');
  }
  if (thousand > 0) {
    parts.push(convertTwoDigits(thousand) + ' Thousand');
  }
  if (hundred > 0) {
    parts.push(convertThreeDigits(hundred));
  }
  
  return parts.join(' ');
}

// Western system (Million, Billion, Thousand)
function convertToWesternSystemWords(amount: number): string {
  if (amount === 0) return 'Zero';
  
  const wholeAmount = Math.floor(amount);
  
  if (wholeAmount === 0) return 'Zero';
  
  const billion = Math.floor(wholeAmount / 1000000000);
  const million = Math.floor((wholeAmount % 1000000000) / 1000000);
  const thousand = Math.floor((wholeAmount % 1000000) / 1000);
  const hundred = wholeAmount % 1000;
  
  const parts: string[] = [];
  
  if (billion > 0) {
    parts.push(convertThreeDigits(billion) + ' Billion');
  }
  if (million > 0) {
    parts.push(convertThreeDigits(million) + ' Million');
  }
  if (thousand > 0) {
    parts.push(convertThreeDigits(thousand) + ' Thousand');
  }
  if (hundred > 0) {
    parts.push(convertThreeDigits(hundred));
  }
  
  return parts.join(' ');
}

// Chinese system (万 Wan, 亿 Yi)
function convertToChineseSystemWords(amount: number): string {
  // For international documents, use Western system with Chinese unit names
  const wholeAmount = Math.floor(amount);
  
  if (wholeAmount === 0) return 'Zero';
  
  const yi = Math.floor(wholeAmount / 100000000); // 亿
  const wan = Math.floor((wholeAmount % 100000000) / 10000); // 万
  const remainder = wholeAmount % 10000;
  
  const parts: string[] = [];
  
  if (yi > 0) {
    parts.push(convertThreeDigits(yi) + ' Yi');
  }
  if (wan > 0) {
    parts.push(convertThreeDigits(wan) + ' Wan');
  }
  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }
  
  return parts.join(' ');
}

export function convertAmountToWords(amount: number, currencyCode: CurrencyCode = 'INR'): string {
  const currency = CURRENCIES[currencyCode];
  const wholeAmount = Math.floor(amount);
  const decimals = Math.round((amount - wholeAmount) * 100);
  
  let mainWords: string;
  let mainUnit: string;
  let decimalUnit: string;
  
  switch (currencyCode) {
    case 'INR':
      mainWords = convertToIndianSystemWords(wholeAmount);
      mainUnit = 'Rupees';
      decimalUnit = 'Paise';
      break;
    case 'USD':
      mainWords = convertToWesternSystemWords(wholeAmount);
      mainUnit = 'Dollars';
      decimalUnit = 'Cents';
      break;
    case 'EUR':
      mainWords = convertToWesternSystemWords(wholeAmount);
      mainUnit = 'Euros';
      decimalUnit = 'Cents';
      break;
    case 'RMB':
      mainWords = convertToChineseSystemWords(wholeAmount);
      mainUnit = 'Yuan';
      decimalUnit = 'Fen';
      break;
    case 'RUB':
      mainWords = convertToWesternSystemWords(wholeAmount);
      mainUnit = 'Rubles';
      decimalUnit = 'Kopeks';
      break;
    default:
      mainWords = convertToWesternSystemWords(wholeAmount);
      mainUnit = '';
      decimalUnit = '';
  }
  
  let result = `${currency?.wordPrefix || currencyCode} ${mainWords}`;
  
  if (mainUnit) {
    result += ` ${mainUnit}`;
  }
  
  if (decimals > 0) {
    result += ` and ${convertTwoDigits(decimals)} ${decimalUnit}`;
  }
  
  result += ' Only';
  
  return result;
}
