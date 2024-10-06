import { describe, expect, it } from 'vitest';

import { generateCsv } from './csv';

describe('generateCsv', () => {
  it('should generate a CSV string from an array of objects', () => {
    const data = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Alice', age: 25, city: 'London' },
      { name: 'Bob', age: 35, city: 'Paris' },
    ];

    const expected =
      'name,age,city\nJohn,30,New York\nAlice,25,London\nBob,35,Paris';
    expect(generateCsv(data)).toBe(expected);
  });

  it('should handle empty arrays', () => {
    const data: Record<string, any>[] = [];
    expect(generateCsv(data)).toBe('');
  });

  it('should handle arrays with a single object', () => {
    const data = [{ key: 'value' }];
    expect(generateCsv(data)).toBe('key\nvalue');
  });

  it('should handle objects with different keys', () => {
    const data = [
      { a: 1, b: 2 },
      { b: 3, c: 4 },
      { a: 5, c: 6 },
    ];

    const expected = 'a,b\n1,2\n,3\n5,';
    expect(generateCsv(data)).toBe(expected);
  });

  it('should handle objects with nested structures', () => {
    const data = [
      { name: 'John', details: { age: 30, city: 'New York' } },
      { name: 'Alice', details: { age: 25, city: 'London' } },
    ];

    const expected =
      'name,details\nJohn,[object Object]\nAlice,[object Object]';
    expect(generateCsv(data)).toBe(expected);
  });
});
