import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MathRendererComponent } from '../math-renderer/math-renderer.component';
import { recognizeExact } from '../../engine/solids';
import type { ExpressionNode } from '../../engine/parser';
import type { SolidIntegralTerm } from '../../engine/solids/solid.types';

/**
 * Renders a sum of "coefficient ∫_a^b integrand d(variable)" terms (the volume formula behind a
 * SolidResult) using <app-math-renderer> for the coefficient/integrand, with the limits formatted
 * as a π-form when recognizeExact finds one, else to at most 4 decimals. Purely presentational.
 */
@Component({
  selector: 'app-integral-formula',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MathRendererComponent],
  templateUrl: './integral-formula.component.html',
  styleUrl: './integral-formula.component.css',
})
export class IntegralFormulaComponent {
  terms = input.required<SolidIntegralTerm[]>();

  formatLimit(value: number): string {
    const exact = recognizeExact(value);
    if (exact && exact.includes('π')) return exact;
    if (Number.isInteger(value)) return String(value);
    return trimTrailingZeros(value.toFixed(4));
  }

  spokenText(): string {
    return this.terms()
      .map((term) => this.spokenTerm(term))
      .join(' plus ');
  }

  private spokenTerm(term: SolidIntegralTerm): string {
    const coeff = term.coefficient ? `${spokenNode(term.coefficient)} times ` : '';
    return `${coeff}integral from ${this.formatLimit(term.a)} to ${this.formatLimit(term.b)} of ${spokenNode(term.integrand)} d${term.variable}`;
  }
}

function trimTrailingZeros(text: string): string {
  return text.replace(/\.?0+$/, '');
}

/** A minimal, English, linear reading of an ExpressionNode for the aria-label alternative. */
function spokenNode(node: ExpressionNode): string {
  switch (node.type) {
    case 'NumberLiteral':
      return String(node.value);
    case 'Variable':
      if (node.name === 'pi' || node.name === 'π') return 'pi';
      if (node.name === 'e') return 'e';
      return node.name;
    case 'UnaryOp':
      return `${node.operator === '-' ? 'negative ' : ''}${spokenNode(node.operand)}`;
    case 'BinaryOp':
      switch (node.operator) {
        case '+':
          return `${spokenNode(node.left)} plus ${spokenNode(node.right)}`;
        case '-':
          return `${spokenNode(node.left)} minus ${spokenNode(node.right)}`;
        case '*':
          return `${spokenNode(node.left)} times ${spokenNode(node.right)}`;
        case '/':
          return `${spokenNode(node.left)} over ${spokenNode(node.right)}`;
        case '^': {
          const exp = node.right;
          if (exp.type === 'NumberLiteral' && exp.value === 2)
            return `${spokenNode(node.left)} squared`;
          if (exp.type === 'NumberLiteral' && exp.value === 3)
            return `${spokenNode(node.left)} cubed`;
          return `${spokenNode(node.left)} to the power of ${spokenNode(node.right)}`;
        }
        default:
          return `${spokenNode(node.left)} ${node.operator} ${spokenNode(node.right)}`;
      }
    case 'FunctionCall':
      return `${node.name} of ${spokenNode(node.arg)}`;
    case 'FunctionCallMultiArg':
      return `${node.name} of ${node.args.map(spokenNode).join(', ')}`;
    case 'PoweredFunctionCall':
      return `${node.name} of ${spokenNode(node.arg)}, to the power of ${spokenNode(node.power)}`;
    default:
      return '';
  }
}
