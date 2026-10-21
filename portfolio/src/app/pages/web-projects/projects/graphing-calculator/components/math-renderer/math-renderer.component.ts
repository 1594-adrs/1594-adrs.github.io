import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';
import type { ExpressionNode, BinaryOp, PoweredFunctionCall } from '../../engine/parser';
import { precedence } from '../../engine/symbolic-diff';

const OP_TEXT: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '<=': '≤',
  '>=': '≥',
  '==': '=',
  '!=': '≠',
};

type Cmp = BinaryOp;
const isCmp = (n: ExpressionNode): n is Cmp => n.type === 'BinaryOp' && n.operator in OP_TEXT;

/** Comparisons of a parser-desugared chain `a<b<c` = `if(a<b, b<c, 0)`, or null for any other `if`. */
function ifChain(n: ExpressionNode): Cmp[] | null {
  if (n.type !== 'FunctionCallMultiArg' || n.name !== 'if' || n.args.length !== 3) return null;
  const [first, rest, zero] = n.args;
  if (!isCmp(first) || zero.type !== 'NumberLiteral' || zero.value !== 0) return null;
  const tail = isCmp(rest) ? [rest] : ifChain(rest);
  return tail && tail[0].left === first.right ? [first, ...tail] : null;
}

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
      case 'PoweredFunctionCall':
        return this.renderPoweredFunctionCall(node);
    }
  }

  private renderPoweredFunctionCall(node: PoweredFunctionCall): string {
    const arg = this.renderNode(node.arg);
    const power = this.renderNode(node.power);

    const powerNum = this.extractNumber(node.power);
    let superscript: string;
    if (powerNum === 2) superscript = '²';
    else if (powerNum === 3) superscript = '³';
    else superscript = `<span class="superscript">${power}</span>`;

    return `<span class="function">${node.name}${superscript}</span><span class="paren">(</span>${arg}<span class="paren">)</span>`;
  }

  private extractNumber(node: ExpressionNode): number | null {
    if (node.type === 'NumberLiteral') return node.value;
    if (node.type === 'UnaryOp' && node.operator === '-' && node.operand.type === 'NumberLiteral') {
      return -node.operand.value;
    }
    return null;
  }

  private renderSqrt(arg: ExpressionNode): string {
    const inner = this.renderNode(arg);
    return `<span class="radical"><span class="radical-sign">√</span><span class="vinculum-wrap"><span class="vinculum"></span><span class="radical-inner">${inner}</span></span></span>`;
  }

  private renderBinary(node: BinaryOp): string {
    // The fraction bar groups both sides: no parentheses needed.
    if (node.operator === '/') {
      return `<span class="fraction"><span class="numerator">${this.renderNode(node.left)}</span><span class="fraction-line"></span><span class="denominator">${this.renderNode(node.right)}</span></span>`;
    }
    if (node.operator === '^') {
      return `${this.wrapBase(node.left)}<span class="superscript">${this.renderNode(node.right)}</span>`;
    }
    // Minimum operand precedence per side: − is left-associative, and a negative right operand
    // is always wrapped (a − (−b), x · (−2)).
    const [minLeft, minRight] =
      node.operator === '-' ? [1, 2] : node.operator === '*' ? [2, 2] : [1, 1];
    const left = this.operand(node.left, minLeft, false);
    const right = this.operand(
      node.right,
      minRight,
      node.operator === '+' || node.operator === '-' || node.operator === '*',
    );

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

  /** `if(c, a, b)` as a cases block; the parser's chained comparison `a<b<c` as `a < b < c`. */
  private renderIf(node: import('../../engine/parser').FunctionCallMultiArg): string {
    const links = ifChain(node);
    if (links) {
      const [first, ...rest] = links;
      return rest.reduce(
        (acc, l) => `${acc} ${OP_TEXT[l.operator]} ${this.renderNode(l.right)}`,
        this.renderBinary(first),
      );
    }
    const rows: string[] = [];
    let cur: ExpressionNode = node;
    while (cur.type === 'FunctionCallMultiArg' && cur.name === 'if' && !ifChain(cur)) {
      rows.push(this.casesRow(cur.args[1], this.renderNode(cur.args[0])));
      if (cur.args.length < 3) break;
      cur = cur.args[2];
    }
    if (cur.type !== 'FunctionCallMultiArg' || cur.name !== 'if' || ifChain(cur)) {
      rows.push(this.casesRow(cur, 'otherwise'));
    }
    return `<span class="cases"><span class="cases-brace">{</span><span class="cases-rows">${rows.join('')}</span></span>`;
  }

  private casesRow(value: ExpressionNode, cond: string): string {
    return `<span class="cases-row"><span>${this.renderNode(value)}</span><span class="cases-cond">${cond}</span></span>`;
  }

  private renderMultiArg(node: import('../../engine/parser').FunctionCallMultiArg): string {
    if (node.name === 'if') return this.renderIf(node);
    const args = node.args.map((a) => this.renderNode(a)).join('<span class="operator">,</span> ');
    return `<span class="function">${node.name}</span><span class="paren">(</span>${args}<span class="paren">)</span>`;
  }

  private wrapUnary(node: ExpressionNode): string {
    // −x², −sin(x), −a/b read right bare; sums, products and another sign need parentheses.
    return displayPrecedence(node) <= UNARY_PREC ? this.paren(node) : this.renderNode(node);
  }

  private operand(node: ExpressionNode, min: number, wrapNegative: boolean): string {
    const p = displayPrecedence(node);
    return p < min || (wrapNegative && p === UNARY_PREC) ? this.paren(node) : this.renderNode(node);
  }

  private paren(node: ExpressionNode): string {
    return `<span class="paren">(</span>${this.renderNode(node)}<span class="paren">)</span>`;
  }

  private wrapBase(node: ExpressionNode): string {
    if (
      (node.type === 'NumberLiteral' && node.value >= 0) ||
      node.type === 'Variable' ||
      // A plain function call (sin(x), ln(x), ...) reads fine unparenthesised before a
      // superscript, e.g. sin(x)²; a radical does not - its vinculum has no fixed "cap
      // height", so an outer exponent placed right after it visually collides with
      // whatever sits at the top of the radical's own content (e.g. an inner x²).
      // Wrapping it in parentheses gives the superscript a normal glyph to attach after.
      (node.type === 'FunctionCall' && node.name !== 'sqrt') ||
      node.type === 'FunctionCallMultiArg'
    ) {
      return this.renderNode(node);
    }
    return `<span class="paren">(</span>${this.renderNode(node)}<span class="paren">)</span>`;
  }
}

const UNARY_PREC = 3;

/** The engine printer's precedence, except that a fraction is visually grouped (an atom). */
function displayPrecedence(node: ExpressionNode): number {
  return node.type === 'BinaryOp' && node.operator === '/' ? 5 : precedence(node);
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
