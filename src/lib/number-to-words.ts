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

export function convertToIndianWords(amount: number): string {
  if (amount === 0) return 'Zero Only';
  
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  
  let words = 'INR ';
  
  if (rupees === 0) {
    words += 'Zero';
  } else {
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
    
    words += parts.join(' ');
  }
  
  if (paise > 0) {
    words += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  
  words += ' Only';
  
  return words;
}
