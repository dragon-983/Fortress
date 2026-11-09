import { describe, it, expect } from 'vitest';
import { formatAddress, formatAmount } from '../src/lib/stellar.js';

describe('FORTRESS Client Utility & Formatting Suite', () => {
  it('formatAddress correctly truncates ed25519 public keys', () => {
    const address = 'GAOWNER111111111111111111111111111111111111111111111111111';
    const formatted = formatAddress(address);
    expect(formatted).toBe('GAOW...1111');
  });

  it('formatAddress handles null or short strings safely', () => {
    expect(formatAddress(null)).toBe('');
    expect(formatAddress(undefined)).toBe('');
    expect(formatAddress('GABCD')).toBe('GABCD');
  });

  it('formatAmount formats currency numbers with 2 decimals by default', () => {
    expect(formatAmount(500)).toBe('500.00');
    expect(formatAmount(2500.75)).toBe('2,500.75');
    expect(formatAmount('1500')).toBe('1,500.00');
  });

  it('formatAmount handles null, undefined, or invalid inputs safely', () => {
    expect(formatAmount(null)).toBe('0.00');
    expect(formatAmount(undefined)).toBe('0.00');
    expect(formatAmount('not_a_number')).toBe('0.00');
  });
});

