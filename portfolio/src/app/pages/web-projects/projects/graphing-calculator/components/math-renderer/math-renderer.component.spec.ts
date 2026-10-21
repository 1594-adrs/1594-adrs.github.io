import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MathRendererComponent } from './math-renderer.component';
import type { ExpressionNode } from '../../engine/parser';

/** The flat list of top-level rendered children (siblings), e.g. ['paren', 'radical', 'paren',
 *  'superscript'] for "(sqrt(...))²" - lets tests assert structure/order without depending on
 *  exact HTML string formatting. */
function renderChildren(ast: ExpressionNode): string[] {
  const fixture = TestBed.createComponent(MathRendererComponent);
  fixture.componentRef.setInput('ast', ast);
  fixture.detectChanges();
  const container = (fixture.nativeElement as HTMLElement).querySelector('.math-display > span')!;
  return Array.from(container.children).map((el) => el.className);
}

function renderText(ast: ExpressionNode): string {
  const fixture = TestBed.createComponent(MathRendererComponent);
  fixture.componentRef.setInput('ast', ast);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();
}

const num = (value: number): ExpressionNode => ({ type: 'NumberLiteral', value });
const v = (name: string): ExpressionNode => ({ type: 'Variable', name });
const bin = (operator: string, left: ExpressionNode, right: ExpressionNode): ExpressionNode => ({
  type: 'BinaryOp',
  operator,
  left,
  right,
});
const negate = (operand: ExpressionNode): ExpressionNode => ({
  type: 'UnaryOp',
  operator: '-',
  operand,
});

describe('MathRendererComponent: parentheses by precedence', () => {
  const lnx: ExpressionNode = { type: 'FunctionCall', name: 'ln', arg: v('x') };
  it.each<[string, ExpressionNode, string]>([
    // d/dx x^x: the sum factor must stay grouped.
    [
      'x^x·(ln x + 1)',
      bin('*', bin('^', v('x'), v('x')), bin('+', lnx, num(1))),
      'xx · (ln(x) + 1)',
    ],
    ['(a + b)·c', bin('*', bin('+', v('a'), v('b')), v('c')), '(a + b) · c'],
    ['a − (b − c)', bin('-', v('a'), bin('-', v('b'), v('c'))), 'a − (b − c)'],
    ['a − (b + c)', bin('-', v('a'), bin('+', v('b'), v('c'))), 'a − (b + c)'],
    ['(a − b) − c', bin('-', bin('-', v('a'), v('b')), v('c')), 'a − b − c'],
    ['a + (b − c)', bin('+', v('a'), bin('-', v('b'), v('c'))), 'a + b − c'],
    ['a·(b·c)', bin('*', v('a'), bin('*', v('b'), v('c'))), 'a · bc'],
    ['a − (−b)', bin('-', v('a'), negate(v('b'))), 'a − (−b)'],
    ['a + (−2)', bin('+', v('a'), num(-2)), 'a + (-2)'],
    ['x·(−2)', bin('*', v('x'), num(-2)), 'x · (-2)'],
    ['(a + b)^c', bin('^', bin('+', v('a'), v('b')), v('c')), '(a + b)c'],
    ['(−2)^x', bin('^', num(-2), v('x')), '(-2)x'],
    ['(−x)^2', bin('^', negate(v('x')), num(2)), '(−x)2'],
    ['−x^2', negate(bin('^', v('x'), num(2))), '−x2'],
    ['−(a + b)', negate(bin('+', v('a'), v('b'))), '−(a + b)'],
    ['−sin(x)', negate({ type: 'FunctionCall', name: 'sin', arg: v('x') }), '−sin(x)'],
    ['(a/b)^2', bin('^', bin('/', v('a'), v('b')), num(2)), '(ab)2'],
    ['(a + b)/c: fraction groups itself', bin('/', bin('+', v('a'), v('b')), v('c')), 'a + bc'],
    ['2·(x + 1)', bin('*', num(2), bin('+', v('x'), num(1))), '2 · (x + 1)'],
  ])('%s', (_, ast, text) => {
    expect(renderText(ast)).toBe(text);
  });
});

describe('MathRendererComponent', () => {
  it('wraps a radical in parentheses when it is the base of a power, superscript after', () => {
    // (sqrt(1 - x^2))^2
    const ast: ExpressionNode = {
      type: 'BinaryOp',
      operator: '^',
      left: {
        type: 'FunctionCall',
        name: 'sqrt',
        arg: {
          type: 'BinaryOp',
          operator: '-',
          left: { type: 'NumberLiteral', value: 1 },
          right: {
            type: 'BinaryOp',
            operator: '^',
            left: { type: 'Variable', name: 'x' },
            right: { type: 'NumberLiteral', value: 2 },
          },
        },
      },
      right: { type: 'NumberLiteral', value: 2 },
    };
    // The radical must be enclosed in visible parens, and the *outer* superscript must be a
    // sibling after the closing paren - not glued directly onto the radical - so it doesn't
    // visually collide with the inner x² sitting at the top of the radical's own content.
    expect(renderChildren(ast)).toEqual(['paren', 'radical', 'paren', 'superscript']);
  });

  it('does not add extra parens around a plain function call raised to a power', () => {
    // sin(x)^2
    const ast: ExpressionNode = {
      type: 'BinaryOp',
      operator: '^',
      left: { type: 'FunctionCall', name: 'sin', arg: { type: 'Variable', name: 'x' } },
      right: { type: 'NumberLiteral', value: 2 },
    };
    expect(renderChildren(ast)).toEqual(['function', 'paren', 'variable', 'paren', 'superscript']);
  });

  it('renders a plain radical without parens when not a power base', () => {
    const ast: ExpressionNode = {
      type: 'FunctionCall',
      name: 'sqrt',
      arg: { type: 'Variable', name: 'x' },
    };
    expect(renderChildren(ast)).toEqual(['radical']);
  });
});

describe('MathRendererComponent: if()', () => {
  const call = (...args: ExpressionNode[]): ExpressionNode => ({
    type: 'FunctionCallMultiArg',
    name: 'if',
    args,
  });

  it('renders if(c, a, b) as a cases block with an otherwise row', () => {
    const text = renderText(call(bin('<', v('x'), num(0)), num(1), num(2)));
    expect(text).toContain('{');
    expect(text).toContain('otherwise');
    expect(text).not.toContain('if(');
  });

  it('renders a chained comparison as a < b < c', () => {
    const x = v('x'); // the parser shares the middle operand between the two links
    const first = bin('<=', num(0), x);
    const second = bin('<', x, num(1));
    const text = renderText(call(first, second, num(0)));
    expect(text.replace(/\s/g, '')).toBe('0≤x<1');
  });
});
