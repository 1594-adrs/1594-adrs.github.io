import { Component, signal, HostListener, PLATFORM_ID, Inject, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';

@Component({
  selector: 'hero-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="hero-container" id="inicio">
      <!-- Ojo que sigue el cursor -->
      <div class="eye-container">
        <div class="eye" #eye>
          <div class="eye-outer">
            <!-- Venas detrás -->
            <div class="eye-veins"></div>
          </div>
          <!-- Iris fuera de eye-outer para que no sea cortado -->
          <div class="eye-inner">
            <div class="iris" [style.transform]="irisTransform()">
              <div class="pupil"></div>
              <div class="reflection"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contenido principal -->
      <div class="hero-content">
        <!-- Texto con animación escalonada -->
        <div class="staggered-text">
          <div class="greeting">
            @for (char of greetingChars; track $index) {
              <span 
                class="char" 
                [style.animation-delay]="($index * 0.05) + 's'"
                [class.space]="char === ' '">
                {{ char === ' ' ? '&nbsp;' : char }}
              </span>
            }
          </div>
          <h1 class="name">
            @for (char of nameChars; track $index) {
              <span 
                class="char name-char" 
                [style.animation-delay]="(0.5 + $index * 0.08) + 's'">
                {{ char === ' ' ? '&nbsp;' : char }}
              </span>
            }
          </h1>
          <div class="role">
            @for (char of roleChars; track $index) {
              <span 
                class="char role-char" 
                [style.animation-delay]="(1.2 + $index * 0.04) + 's'"
                [class.space]="char === ' '">
                {{ char === ' ' ? '&nbsp;' : char }}
              </span>
            }
          </div>
        </div>

        <!-- Espacio para imagen de perfil -->
        <div class="profile-image-container">
          <div class="image-frame">
            <div class="image-placeholder">
              <!-- Aquí irá tu imagen -->
              <img src="assets/profile-placeholder.png" alt="Andrés David Rincón" class="profile-img" />
              <div class="image-overlay"></div>
            </div>
            <div class="frame-border"></div>
            <div class="frame-glow"></div>
          </div>
        </div>
      </div>

      <!-- Indicador de scroll -->
      <div class="scroll-indicator">
        <div class="scroll-arrow"></div>
        <span>Scroll</span>
      </div>
    </section>

    <!-- Sección de proyectos con Scroll Reveal -->
    <section class="projects-section" id="proyectos" #projectsSection>
      <div class="reveal-container" [class.revealed]="projectsRevealed()">
        <h2 class="section-title">Projects</h2>
        <p class="placeholder-text">Projects content coming soon...</p>
      </div>
    </section>
  `,
  styles: [`
    .hero-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
      padding: 2rem;
    }

    /* ===== OJO REALISTA ===== */
    .eye-container {
      position: absolute;
      top: 10%;
      right: 10%;
      z-index: 1;
      filter: drop-shadow(0 0 30px rgba(2, 211, 200, 0.3));
    }

    .eye {
      width: 120px;
      height: 120px;
      position: relative;
    }

    .eye-outer {
      width: 100%;
      height: 100%;
      background: radial-gradient(ellipse at center, 
        #f5f5f5 0%, 
        #e8e8e8 40%, 
        #d0d0d0 70%, 
        #a0a0a0 100%);
      border-radius: 50%;
      position: relative;
      box-shadow: 
        inset 0 0 30px rgba(0, 0, 0, 0.3),
        0 0 20px rgba(0, 0, 0, 0.5),
        0 0 40px rgba(2, 211, 200, 0.2);
    }

    .eye-veins {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      background: 
        radial-gradient(ellipse at 10% 20%, rgba(180, 50, 50, 0.3) 0%, transparent 20%),
        radial-gradient(ellipse at 90% 30%, rgba(180, 50, 50, 0.2) 0%, transparent 15%),
        radial-gradient(ellipse at 20% 80%, rgba(180, 50, 50, 0.25) 0%, transparent 18%),
        radial-gradient(ellipse at 85% 75%, rgba(180, 50, 50, 0.2) 0%, transparent 12%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 1;
    }

    .eye-inner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 70px;
      height: 70px;
      border-radius: 50%;
      z-index: 2;
    }

    .iris {
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 30% 30%,
        #23d5ab 0%,
        #02d3c8 30%,
        #018a82 60%,
        #014d49 100%);
      border-radius: 50%;
      position: relative;
      transition: transform 0.1s ease-out;
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }

    .iris::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        repeating-conic-gradient(
          from 0deg,
          transparent 0deg 10deg,
          rgba(0, 0, 0, 0.1) 10deg 20deg
        );
      border-radius: 50%;
    }

    .pupil {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 25px;
      height: 25px;
      background: radial-gradient(circle at 40% 40%,
        #1a1a1a 0%,
        #000000 100%);
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
    }

    .reflection {
      position: absolute;
      top: 15%;
      left: 25%;
      width: 12px;
      height: 12px;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      filter: blur(1px);
    }

    .reflection::after {
      content: '';
      position: absolute;
      top: 20px;
      left: 15px;
      width: 6px;
      height: 6px;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 50%;
    }

    /* ===== CONTENIDO HERO ===== */
    .hero-content {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4rem;
      z-index: 2;
      flex-wrap: wrap;
    }

    /* ===== TEXTO ESCALONADO ===== */
    .staggered-text {
      text-align: left;
    }

    .char {
      display: inline-block;
      opacity: 0;
      transform: translateY(50px) rotateX(-90deg);
      animation: charReveal 0.6s forwards;
    }

    .char.space {
      width: 0.3em;
    }

    @keyframes charReveal {
      to {
        opacity: 1;
        transform: translateY(0) rotateX(0);
      }
    }

    .greeting {
      font-size: 1.5rem;
      color: #02d3c8;
      margin-bottom: 0.5rem;
      text-shadow: 0 0 10px rgba(2, 211, 200, 0.5);
    }

    .name {
      font-size: 4rem;
      font-weight: bold;
      margin: 0;
      line-height: 1.1;
    }

    .name-char {
      background: linear-gradient(135deg, #ffffff, #02d3c8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: none;
      filter: drop-shadow(0 0 20px rgba(2, 211, 200, 0.3));
    }

    .role {
      font-size: 1.8rem;
      color: #888888;
      margin-top: 1rem;
    }

    .role-char {
      transition: color 0.3s ease;
    }

    .role-char:hover {
      color: #23d5ab;
      text-shadow: 0 0 10px rgba(35, 213, 171, 0.8);
    }

    /* ===== IMAGEN DE PERFIL ===== */
    .profile-image-container {
      position: relative;
    }

    .image-frame {
      position: relative;
      width: 300px;
      height: 300px;
    }

    .image-placeholder {
      width: 100%;
      height: 100%;
      border-radius: 20px;
      overflow: hidden;
      position: relative;
      background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    }

    .profile-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.5s ease;
    }

    .image-placeholder:hover .profile-img {
      transform: scale(1.05);
    }

    .image-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        135deg,
        rgba(2, 211, 200, 0.1) 0%,
        transparent 50%,
        rgba(35, 213, 171, 0.1) 100%
      );
      pointer-events: none;
    }

    .frame-border {
      position: absolute;
      top: -3px;
      left: -3px;
      right: -3px;
      bottom: -3px;
      border-radius: 23px;
      background: linear-gradient(135deg, #02d3c8, #23d5ab, #02d3c8);
      z-index: -1;
      animation: borderRotate 3s linear infinite;
    }

    @keyframes borderRotate {
      0% {
        background: linear-gradient(0deg, #02d3c8, #23d5ab, #02d3c8);
      }
      25% {
        background: linear-gradient(90deg, #02d3c8, #23d5ab, #02d3c8);
      }
      50% {
        background: linear-gradient(180deg, #02d3c8, #23d5ab, #02d3c8);
      }
      75% {
        background: linear-gradient(270deg, #02d3c8, #23d5ab, #02d3c8);
      }
      100% {
        background: linear-gradient(360deg, #02d3c8, #23d5ab, #02d3c8);
      }
    }

    .frame-glow {
      position: absolute;
      top: -10px;
      left: -10px;
      right: -10px;
      bottom: -10px;
      border-radius: 30px;
      background: transparent;
      box-shadow: 0 0 30px rgba(2, 211, 200, 0.3),
                  0 0 60px rgba(35, 213, 171, 0.2);
      z-index: -2;
      animation: glowPulse 2s ease-in-out infinite;
    }

    @keyframes glowPulse {
      0%, 100% {
        opacity: 0.5;
      }
      50% {
        opacity: 1;
      }
    }

    /* ===== INDICADOR DE SCROLL ===== */
    .scroll-indicator {
      position: absolute;
      bottom: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: #02d3c8;
      animation: bounce 2s infinite;
    }

    .scroll-arrow {
      width: 30px;
      height: 30px;
      border-right: 3px solid #02d3c8;
      border-bottom: 3px solid #02d3c8;
      transform: rotate(45deg);
    }

    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% {
        transform: translateY(0);
      }
      40% {
        transform: translateY(-10px);
      }
      60% {
        transform: translateY(-5px);
      }
    }

    /* ===== SECCIÓN DE PROYECTOS ===== */
    .projects-section {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 4rem 2rem;
    }

    .reveal-container {
      opacity: 0;
      transform: translateY(100px);
      transition: all 1s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
    }

    .reveal-container.revealed {
      opacity: 1;
      transform: translateY(0);
    }

    .section-title {
      font-size: 3rem;
      color: #ffffff;
      margin-bottom: 2rem;
      position: relative;
      display: inline-block;
    }

    .section-title::after {
      content: '';
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 100px;
      height: 4px;
      background: linear-gradient(90deg, #02d3c8, #23d5ab);
      border-radius: 2px;
    }

    .placeholder-text {
      font-size: 1.5rem;
      color: #666666;
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 900px) {
      .hero-content {
        flex-direction: column;
        text-align: center;
      }

      .staggered-text {
        text-align: center;
      }

      .name {
        font-size: 2.5rem;
      }

      .role {
        font-size: 1.3rem;
      }

      .image-frame {
        width: 250px;
        height: 250px;
      }

      .eye-container {
        top: 5%;
        right: 5%;
      }

      .eye {
        width: 80px;
        height: 80px;
      }

      .eye-inner {
        width: 50px;
        height: 50px;
      }

      .pupil {
        width: 18px;
        height: 18px;
      }

      .reflection {
        width: 8px;
        height: 8px;
      }
    }

    @media (max-width: 480px) {
      .name {
        font-size: 2rem;
      }

      .greeting {
        font-size: 1.2rem;
      }

      .image-frame {
        width: 200px;
        height: 200px;
      }
    }
  `]
})
export class HeroSection implements AfterViewInit {
  @ViewChild('eye') eyeElement!: ElementRef;
  @ViewChild('projectsSection') projectsSection!: ElementRef;

  private isBrowser: boolean;
  
  // Texto para animación escalonada
  greetingChars = 'Hello, I am'.split('');
  nameChars = 'Andrés Rincón'.split('');
  roleChars = 'Full Stack Developer'.split('');

  // Señales reactivas
  irisTransform = signal('translate(0px, 0px)');
  projectsRevealed = signal(false);

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.setupIntersectionObserver();
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isBrowser || !this.eyeElement) return;

    const eye = this.eyeElement.nativeElement;
    const rect = eye.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height / 2;

    const angle = Math.atan2(event.clientY - eyeCenterY, event.clientX - eyeCenterX);
    const distance = Math.min(15, Math.hypot(event.clientX - eyeCenterX, event.clientY - eyeCenterY) / 20);

    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    this.irisTransform.set(`translate(${x}px, ${y}px)`);
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.projectsRevealed.set(true);
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px'
      }
    );

    if (this.projectsSection) {
      observer.observe(this.projectsSection.nativeElement);
    }
  }
}