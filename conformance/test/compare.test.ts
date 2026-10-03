import { describe, expect, it } from 'vitest';
import { compareValues, parseQuantity } from '../src/compare.js';

describe('compareValues', () => {
  it('reads colour notations by meaning, not by spelling', () => {
    expect(compareValues('color', '#336699', 'rgb(20% 40% 60%)').category).toBe('match');
    expect(compareValues('color', '#000000', 'rgb(0, 0, 0)').category).toBe('match');
    expect(compareValues('color', 'rgba(0, 0, 0, 0.22)', 'rgb(0% 0% 0% / 0.22)').category).toBe('match');
  });

  it('separates a 1/255 rounding tie from a real divergence', () => {
    expect(compareValues('color', '#ff8c71', '#ff8c70').category).toBe('rounding');
    expect(compareValues('color', '#ff8c71', '#ff7652')).toMatchObject({ category: 'divergent' });
  });

  it('flags a value that is not a colour as unparseable, not as divergent', () => {
    expect(compareValues('color', '{colors.none}', 'rgb(0, 0, 0)').category).toBe('unparseable');
  });

  it('canonicalises lengths and times', () => {
    expect(compareValues('dimension', '16px', '1rem').category).toBe('match');
    expect(compareValues('dimension', '16px', '1.5rem')).toMatchObject({ category: 'divergent' });
    expect(compareValues('duration', '0.2s', '200ms').category).toBe('match');
    expect(compareValues('letterSpacings', '2%', '0.02em').category).toBe('match');
    expect(compareValues('lineHeights', '150%', '1.5').category).toBe('match');
  });

  it('treats zero as unit-less and a bare length number as px', () => {
    expect(compareValues('dimension', '0px', '0').category).toBe('match');
    expect(compareValues('letterSpacing', '0%', '0').category).toBe('match');
    expect(compareValues('borderRadius', '99999', '6249.9375rem').category).toBe('match');
    expect(compareValues('lineHeights', '1.5', '24px')).toMatchObject({ category: 'divergent' });
  });

  it('reads cubic-bezier by its four numbers and calls empty ones a source defect', () => {
    expect(compareValues('cubicBezier', [0.4, 0, 0.2, 1], 'cubic-bezier(0.4, 0, 0.2, 1)').category).toBe('match');
    expect(compareValues('cubicBezier', [{}, {}, {}, {}], 'cubic-bezier([object Object], [object Object], [object Object], [object Object])').category).toBe('unparseable');
  });

  it('maps font-weight names onto numbers', () => {
    expect(compareValues('fontWeights', 'Bold', '700').category).toBe('match');
    expect(compareValues('fontWeights', 'Regular', '700')).toMatchObject({ category: 'divergent' });
  });

  it('ignores quoting around font families', () => {
    expect(compareValues('fontFamilies', 'Public Sans', "'Public Sans'").category).toBe('match');
  });

  it('counts object values as composite and reports a one-sided token as missing', () => {
    expect(compareValues('typography', { fontSize: '16px' }, '400 16px/1.5 x').category).toBe('composite');
    expect(compareValues('color', undefined, '#fff').category).toBe('missing');
  });
});

describe('parseQuantity', () => {
  it('returns null for non-quantities', () => {
    expect(parseQuantity('Bold')).toBeNull();
    expect(parseQuantity('{spacing.base}')).toBeNull();
  });
});
