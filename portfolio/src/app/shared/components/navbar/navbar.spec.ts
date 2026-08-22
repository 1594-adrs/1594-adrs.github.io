import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Navbar } from './navbar';
import { NAV_LINKS } from '../../data/portfolio.data';

describe('Navbar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Navbar);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render navigation links', () => {
    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.nav-item').length).toBe(NAV_LINKS.length);
  });

  it('should toggle menu on button click', () => {
    const fixture = TestBed.createComponent(Navbar);
    const component = fixture.componentInstance;
    expect(component.isMenuOpen()).toBeFalsy();
    component.toggleMenu();
    expect(component.isMenuOpen()).toBeTruthy();
  });

  it('should close menu when scrolling to section', () => {
    const fixture = TestBed.createComponent(Navbar);
    const component = fixture.componentInstance;
    component.toggleMenu();
    expect(component.isMenuOpen()).toBeTruthy();
    component.scrollToSection('about');
    expect(component.isMenuOpen()).toBeFalsy();
    expect(component.activeLink()).toBe('about');
  });
});
