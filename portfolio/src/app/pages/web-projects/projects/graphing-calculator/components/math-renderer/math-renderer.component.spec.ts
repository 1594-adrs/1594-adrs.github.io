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
