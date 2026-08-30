import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';

describe('IconComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'github');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render SVG content for a known icon', () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'github');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const svg = compiled.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('should render empty span for unknown icon name', () => {
    const fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'nonexistent');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const svg = compiled.querySelector('svg');
    expect(svg).toBeNull();
  });

  it('should render different icons', () => {
    const names = ['github', 'linkedin', 'envelope', 'calculator', 'terminal'];
    for (const name of names) {
      const fixture = TestBed.createComponent(IconComponent);
      fixture.componentRef.setInput('name', name);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const svg = compiled.querySelector('svg');
      expect(svg).toBeTruthy();
    }
  });
});
