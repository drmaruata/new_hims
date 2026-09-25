import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges Tailwind classes and resolves conflicts', () => {
    expect(cn('px-2', 'px-4', 'font-medium')).toContain('px-4');
    expect(cn('px-2', 'px-4', 'font-medium')).not.toContain('px-2');
  });
});
