import { describe, it, expect } from 'vitest';
import { extractIndianPhoneNumbers } from '@/components/tst/PhoneNumberScannerDialog';

describe('Phone Number Scanner - Indian Format Recognition', () => {
  it('extracts standard 10-digit mobile numbers', () => {
    const text = 'Customer mobile: 9876543210, call urgently';
    const result = extractIndianPhoneNumbers(text);
    expect(result).toContain('+919876543210');
  });

  it('extracts numbers with +91 country code and spaces', () => {
    const text = 'Visiting card: +91 98765 43210 - Plant Engineer';
    const result = extractIndianPhoneNumbers(text);
    expect(result).toContain('+919876543210');
  });

  it('extracts compact +91 numbers', () => {
    const text = 'Contact: +919876543210';
    const result = extractIndianPhoneNumbers(text);
    expect(result).toContain('+919876543210');
  });

  it('extracts numbers with leading 0 (STD/Landline style)', () => {
    const text = 'Office Tel: 09876543210';
    const result = extractIndianPhoneNumbers(text);
    expect(result).toContain('+919876543210');
  });

  it('handles hyphens and formatting within phone numbers', () => {
    const text = 'Support: 98765-43210';
    const result = extractIndianPhoneNumbers(text);
    expect(result).toContain('+919876543210');
  });

  it('deduplicates multiple occurrences of the same number', () => {
    const text = 'Direct: 9876543210, WhatsApp: +91 9876543210';
    const result = extractIndianPhoneNumbers(text);
    expect(result.length).toBe(1);
    expect(result[0]).toBe('+919876543210');
  });

  it('returns empty array when no phone number exists in text', () => {
    const text = 'Siemens PLC CPU 1214C DC/DC/DC firmware 4.5';
    const result = extractIndianPhoneNumbers(text);
    expect(result).toEqual([]);
  });
});
