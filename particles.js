/**
 * Cosmic Strike - Particle VFX & Screen FX Engine
 */

class Particle {
  constructor(x, y, vx, vy, color, size, life, decay, type = 'spark') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.originalSize = size;
    this.life = life; // 0 to 1
    this.decay = decay; // life reduction per sec
    this.type = type; // 'spark', 'smoke', 'ring', 'glow', 'trail'
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 8;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotSpeed * dt;

    if (this.type === 'spark') {
      this.vx *= Math.pow(0.96, dt * 60);
      this.vy *= Math.pow(0.96, dt * 60);
    } else if (this.type === 'ring') {
      this.size += 220 * dt; // expand ring
    }

    this.life -= this.decay * dt;
    if (this.type !== 'ring') {
      this.size = Math.max(0, this.originalSize * (this.life));
    }
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();

    if (this.type === 'ring') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = Math.max(0, this.life * 0.8);
      ctx.lineWidth = Math.max(1, 4 * this.life);
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
    } else if (this.type === 'glow' || this.type === 'trail') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0, this.life * 0.7);
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.fill();
    } else {
      // standard spark / debris
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    }

    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color, fontSize = 16, duration = 0.9) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.duration = duration;
    this.life = 1.0;
    this.decay = 1.0 / duration;
    this.vy = -45; // float upward
    this.vx = (Math.random() - 0.5) * 20;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= this.decay * dt;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.font = `900 ${this.fontSize}px 'Orbitron', monospace`;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class ParticleManager {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeOffset = { x: 0, y: 0 };
  }

  triggerShake(intensity = 8, duration = 0.3) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }

  createThruster(x, y, angle = Math.PI / 2, spread = 0.3, color = '#00f0ff') {
    const pAngle = angle + Math.PI + (Math.random() - 0.5) * spread;
    const speed = 80 + Math.random() * 120;
    const vx = Math.cos(pAngle) * speed;
    const vy = Math.sin(pAngle) * speed;
    const size = 3 + Math.random() * 4;
    const decay = 2.8 + Math.random() * 2;
    this.particles.push(new Particle(x, y, vx, vy, color, size, 1.0, decay, 'trail'));
  }

  createExplosion(x, y, count = 25, colors = ['#ff0055', '#ff9900', '#ffff00', '#00f0ff']) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 280;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 5;
      const decay = 1.0 + Math.random() * 1.5;
      this.particles.push(new Particle(x, y, vx, vy, color, size, 1.0, decay, 'spark'));
    }

    // Add glowing shockwave ring
    this.particles.push(new Particle(x, y, 0, 0, colors[0] || '#ff0055', 4, 1.0, 2.2, 'ring'));
  }

  createBossExplosion(x, y) {
    // Multi-burst mega explosion
    for (let b = 0; b < 4; b++) {
      const ox = x + (Math.random() - 0.5) * 60;
      const oy = y + (Math.random() - 0.5) * 60;
      this.createExplosion(ox, oy, 40, ['#ef233c', '#ff007f', '#ffb703', '#ffffff', '#00f0ff']);
    }
    // Massive shockwave
    this.particles.push(new Particle(x, y, 0, 0, '#ffffff', 10, 1.0, 1.2, 'ring'));
    this.particles.push(new Particle(x, y, 0, 0, '#00f0ff', 15, 1.0, 0.9, 'ring'));
    this.triggerShake(18, 0.7);
  }

  createHitSparks(x, y, count = 6, color = '#00f0ff') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 2 + Math.random() * 3, 1.0, 3.5, 'spark'));
    }
  }

  addText(x, y, text, color = '#ffb703', fontSize = 16, duration = 0.9) {
    this.floatingTexts.push(new FloatingText(x, y, text, color, fontSize, duration));
  }

  update(dt) {
    // Update screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeOffset.x = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffset.y = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity *= Math.pow(0.92, dt * 60);
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
        this.shakeOffset.x = 0;
        this.shakeOffset.y = 0;
      }
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.update(dt);
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // Draw all particles
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx);
    }
    // Draw floating texts
    for (let i = 0; i < this.floatingTexts.length; i++) {
      this.floatingTexts[i].draw(ctx);
    }
  }

  clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeOffset = { x: 0, y: 0 };
  }
}

window.particleManager = new ParticleManager();
