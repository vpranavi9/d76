/**
 * Cosmic Strike - Multi-Layer Parallax Starfield & Space Nebulae
 */

class Starfield {
  constructor() {
    this.layers = [];
    this.nebulae = [];
    this.warpFactor = 1.0;
    this.targetWarpFactor = 1.0;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.init();
  }

  init() {
    this.layers = [
      // Distant micro stars (slow, small, faint)
      this.generateLayer(140, 0.6, 1.2, 25, '#6c7a9c', 0.4),
      // Mid-depth stars (medium speed, crisp blue/cyan)
      this.generateLayer(70, 1.2, 2.0, 60, '#90e0ef', 0.7),
      // Foreground bright stars (fast, large, glowing)
      this.generateLayer(30, 2.0, 3.2, 120, '#ffffff', 0.95)
    ];

    // Procedural ambient nebula clouds
    this.nebulae = [
      { x: this.width * 0.2, y: this.height * 0.2, radius: 260, color: 'rgba(76, 0, 130, 0.08)', vy: 8 },
      { x: this.width * 0.8, y: this.height * 0.6, radius: 320, color: 'rgba(0, 119, 182, 0.07)', vy: 12 },
      { x: this.width * 0.5, y: this.height * 0.85, radius: 280, color: 'rgba(181, 23, 158, 0.06)', vy: 6 }
    ];
  }

  generateLayer(count, minSize, maxSize, speed, color, alpha) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: minSize + Math.random() * (maxSize - minSize),
        speed: speed * (0.8 + Math.random() * 0.4),
        color: color,
        baseAlpha: alpha,
        alpha: alpha,
        twinkleSpeed: 1 + Math.random() * 3,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
    return stars;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.init();
  }

  setWarp(active = false) {
    this.targetWarpFactor = active ? 6.0 : 1.0;
  }

  update(dt) {
    // Smooth transition for warp speed
    this.warpFactor += (this.targetWarpFactor - this.warpFactor) * 4 * dt;

    // Update stars
    for (let l = 0; l < this.layers.length; l++) {
      const stars = this.layers[l];
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y += s.speed * this.warpFactor * dt;
        s.twinklePhase += s.twinkleSpeed * dt;
        s.alpha = s.baseAlpha * (0.65 + 0.35 * Math.sin(s.twinklePhase));

        // Wrap around screen
        if (s.y > this.height) {
          s.y = -10;
          s.x = Math.random() * this.width;
        }
      }
    }

    // Update nebulae
    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i];
      n.y += n.vy * this.warpFactor * dt;
      if (n.y - n.radius > this.height) {
        n.y = -n.radius;
        n.x = Math.random() * this.width;
      }
    }
  }

  draw(ctx) {
    // Draw Nebulae
    for (let i = 0; i < this.nebulae.length; i++) {
      const n = this.nebulae[i];
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Star Layers
    const isWarping = this.warpFactor > 1.5;

    for (let l = 0; l < this.layers.length; l++) {
      const stars = this.layers[l];
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        ctx.save();
        ctx.fillStyle = s.color;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = s.alpha;

        if (isWarping) {
          // Stretch star into light streaks
          const streakLen = s.speed * (this.warpFactor * 0.12);
          ctx.lineWidth = s.size;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y - streakLen);
          ctx.stroke();
        } else {
          // Normal star dot
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }
}

window.starfield = new Starfield();
