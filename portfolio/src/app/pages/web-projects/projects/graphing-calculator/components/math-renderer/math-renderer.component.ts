import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';
import type { ExpressionNode, BinaryOp } from '../../engine/parser';

@Component({
  selector: 'app-math-renderer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './math-renderer.component.html',
  styleUrls: ['./math-renderer.component.css'],
})
export class MathRendererComponent {
  ast = input.required<ExpressionNode>();
  fontSize = input<number>(16);

  protected renderNode(node: ExpressionNode): string {
    switch (node.type) {
      case 'NumberLiteral':
        return `<span class="number">${formatNum(node.value)}</span>`;
      case 'Variable':
        if (node.name === 'pi' || node.name === 'π') {
          return '<span class="constant">π</span>';
        }
        if (node.name === 'e') {
          return '<span class="constant">e</span>';
        }
        return `<span class="variable">${node.name}</span>`;
      case 'UnaryOp':
        if (node.operator === '-') {
          return `<span class="operator">−</span>${this.wrapUnary(node.operand)}`;
        }
        return `<span class="operator">+</span>${this.wrapUnary(node.operand)}`;
      case 'BinaryOp':
        return this.renderBinary(node);
      case 'FunctionCall':
        if (node.name === 'sqrt') {
          return this.renderSqrt(node.arg);
        }
        return `<span class="function">${node.name}</span><span class="paren">(</span>${this.renderNode(node.arg)}<span class="paren">)</span>`;
      case 'FunctionCallMultiArg':
        return this.renderMultiArg(node);
    }
  }

  private renderSqrt(arg: ExpressionNode): string {
    const inner = this.renderNode(arg);
    return `<span class="radical"><span class="radical-sign">√</span><span class="vinculum-wrap"><span class="vinculum"></span><span class="radical-inner">${inner}</span></span></span>`;
  }

  private renderBinary(node: BinaryOp): string {
    const left = this.renderNode(node.left);
    const right = this.renderNode(node.right);

    switch (node.operator) {
      case '+':
        return `${left} <span class="operator">+</span> ${right}`;
      case '-':
        return `${left} <span class="operator">−</span> ${right}`;
      case '*':
        if (isImplicitMultiply(node)) {
          return `${left}${right}`;
        }
        return `${left} <span class="operator">·</span> ${right}`;
      case '/':
        return `<span class="fraction"><span class="numerator">${left}</span><span class="fraction-line"></span><span class="denominator">${right}</span></span>`;
      case '^':
        return `${this.wrapBase(node.left)}<span class="superscript">${this.renderNode(node.right)}</span>`;
      case '<':
        return `${left} <span class="operator">&lt;</span> ${right}`;
      case '>':
        return `${left} <span class="operator">&gt;</span> ${right}`;
      case '<=':
        return `${left} <span class="operator">≤</span> ${right}`;
      case '>=':
        return `${left} <span class="operator">≥</span> ${right}`;
      case '==':
        return `${left} <span class="operator">=</span> ${right}`;
      case '!=':
        return `${left} <span class="operator">≠</span> ${right}`;
      default:
        return `${left} <span class="operator">${node.operator}</span> ${right}`;
    }
  }

  private renderMultiArg(node: import('../../engine/parser').FunctionCallMultiArg): string {
    const args = node.args.map((a) => this.renderNode(a)).join('<span class="operator">,</span> ');
    return `<span class="function">${node.name}</span><span class="paren">(</span>${args}<span class="paren">)</span>`;
  }

  private wrapUnary(node: ExpressionNode): string {
    if (node.type === 'NumberLiteral' || node.type === 'Variable') {
      return this.renderNode(node);
    }
    return `<span class="paren">(</span>${this.renderNode(node)}<span class="paren">)</span>`;
  }

  private wrapBase(node: ExpressionNode): string {
    if (
      node.type === 'NumberLiteral' ||
      node.type === 'Variable' ||
      node.type === 'FunctionCall' ||
      node.type === 'FunctionCallMultiArg'
    ) {
      return this.renderNode(node);
    }
    return `<span class="paren">(</span>${this.renderNode(node)}<span class="paren">)</span>`;
  }
}

function isImplicitMultiply(node: BinaryOp): boolean {
  const l = node.left;
  const r = node.right;
  if (l.type === 'NumberLiteral' && r.type === 'Variable') return true;
  if (l.type === 'NumberLiteral' && r.type === 'BinaryOp' && r.operator === '^') {
    if (r.left.type === 'Variable') return true;
  }
  if (l.type === 'Variable' && r.type === 'Variable') return true;
  if (l.type === 'NumberLiteral' && r.type === 'FunctionCall') return true;
  if (l.type === 'Variable' && r.type === 'FunctionCall') return true;
  return false;
}

function formatNum(v: number): string {
  if (Math.abs(v - Math.PI) < 1e-10) return 'π';
  if (Math.abs(v - Math.E) < 1e-10) return 'e';
  if (Number.isInteger(v)) return String(v);
  return parseFloat(v.toPrecision(8)).toString();
}
