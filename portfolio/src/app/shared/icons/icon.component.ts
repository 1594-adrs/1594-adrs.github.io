import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ICON_SVGS } from './icon-data';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="icon-container" [innerHTML]="svgContent()" aria-hidden="true"></span>`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
      .icon-container {
        display: inline-flex;
        width: 1em;
        height: 1em;
      }
      .icon-container :global(svg) {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);

  name = input.required<string>();

  svgContent = computed(() => {
    const raw = ICON_SVGS[this.name()] ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  });
}
