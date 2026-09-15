/**
 * Cosmic Strike - Entities System
 * Player, Enemies, Bosses, Projectiles, Asteroids, and Power-ups
 */

// ============================================================================
// PROJECTILES
// ============================================================================
class Projectile {
  constructor(x, y, vx, vy, damage = 20, isPlayer = true, color = '#00f0ff', radius = 4) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.isPlayer = isPlayer;
    this.color = color;
    this.radius = radius;
    this.markedForRemoval = false;
  }

  update(dt, width, height) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Check bounds
    if (this.y < -30 || this.y > height + 30 || this.x < -30 || this.x > width + 30) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fill();

    // Bullet trail tail
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.radius * 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

// ============================================================================
// POWER-UPS
// ============================================================================
const POWERUP_TYPES = {
  SHIELD: { id: 'shield', name: 'Shield Boost', color: '#00b4d8', icon: '🛡' },
  RAPID: { id: 'rapid', name: 'Rapid Fire', color: '#ffb703', icon: '⚡' },
  SPREAD: { id: 'spread', name: 'Spread Cannon', color: '#ff007f', icon: '🔱' },
  HEALTH: { id: 'health', name: 'Nanite Repair', color: '#06d6a0', icon: '➕' },
  BOMB: { id: 'bomb', name: 'EMP Bomb', color: '#ffd166', icon: '💣' }
};

class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 16;
    this.vy = 65;
    this.vx = (Math.random() - 0.5) * 30;
    this.pulse = Math.random() * Math.PI * 2;
    this.markedForRemoval = false;
  }

  update(dt, width, height) {
    this.pulse += 5 * dt;
    this.y += this.vy * dt;
    this.x += this.vx * dt;

    if (this.y > height + 30) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    ctx.save();
    const scale = 1 + 0.15 * Math.sin(this.pulse);

    // Glowing halo
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.type.color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.stroke();

    // Icon text
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.type.icon, this.x, this.y);

    ctx.restore();
  }
}

// ============================================================================
// PLAYER SPACESHIP
// ============================================================================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.speed = 360;
    this.radius = 20;

    // Health & Shields
    this.maxHealth = 100;
    this.health = 100;
    this.maxShield = 100;
    this.shield = 100;
    this.shieldRechargeDelay = 4.0;
    this.shieldTimer = 0;

    // Power-up buff timers
    this.rapidFireTimer = 0;
    this.spreadShotTimer = 0;
    this.invulnerableTimer = 0; // i-frames
    this.shieldBuffTimer = 0;

    // Weapon cooldown
    this.shootCooldown = 0;
    this.bombs = 2;
    this.maxBombs = 4;

    // Aesthetics & Banking roll
    this.roll = 0; // banking angle in radians
    this.thrusterCycle = 0;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.rapidFireTimer = 0;
    this.spreadShotTimer = 0;
    this.invulnerableTimer = 0;
    this.shieldBuffTimer = 0;
    this.shootCooldown = 0;
    this.bombs = 2;
  }

  applyDamage(amount) {
    if (this.invulnerableTimer > 0) return false;

    this.shieldTimer = 0; // reset recharge delay

    // If shield boost is active, shield absorbs all damage
    if (this.shieldBuffTimer > 0) {
      window.soundEngine.playShieldHit();
      window.particleManager.createHitSparks(this.x, this.y, 8, '#00b4d8');
      return false;
    }

    if (this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
        window.soundEngine.playShieldHit();
        window.particleManager.createHitSparks(this.x, this.y, 6, '#00b4d8');
      } else {
        const remaining = amount - this.shield;
        this.shield = 0;
        this.health -= remaining;
        window.soundEngine.playExplosion('small');
        window.particleManager.createHitSparks(this.x, this.y, 10, '#ef233c');
        window.particleManager.triggerShake(8, 0.25);
        this.invulnerableTimer = 0.6;
      }
    } else {
      this.health -= amount;
      window.soundEngine.playExplosion('small');
      window.particleManager.createHitSparks(this.x, this.y, 12, '#ef233c');
      window.particleManager.triggerShake(10, 0.3);
      this.invulnerableTimer = 0.8;
    }

    return this.health <= 0;
  }

  activatePowerup(powerup) {
    window.soundEngine.playPowerup();
    switch (powerup.type.id) {
      case 'shield':
        this.shieldBuffTimer = 8.0;
        this.shield = this.maxShield;
        window.particleManager.addText(this.x, this.y - 20, 'SHIELD MAX!', '#00b4d8', 18);
        break;
      case 'rapid':
        this.rapidFireTimer = 8.0;
        window.particleManager.addText(this.x, this.y - 20, 'RAPID FIRE!', '#ffb703', 18);
        break;
      case 'spread':
        this.spreadShotTimer = 8.0;
        window.particleManager.addText(this.x, this.y - 20, 'SPREAD SHOT!', '#ff007f', 18);
        break;
      case 'health':
        this.health = Math.min(this.maxHealth, this.health + 40);
        window.particleManager.addText(this.x, this.y - 20, '+40 HULL', '#06d6a0', 18);
        break;
      case 'bomb':
        this.bombs = Math.min(this.maxBombs, this.bombs + 1);
        window.particleManager.addText(this.x, this.y - 20, '+1 EMP BOMB', '#ffd166', 18);
        break;
    }
  }

  update(dt, input, width, height, projectiles) {
    // Process Buff Timers
    if (this.rapidFireTimer > 0) this.rapidFireTimer -= dt;
    if (this.spreadShotTimer > 0) this.spreadShotTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.shieldBuffTimer > 0) this.shieldBuffTimer -= dt;

    // Shield passive regeneration
    this.shieldTimer += dt;
    if (this.shieldTimer >= this.shieldRechargeDelay && this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + 18 * dt);
    }

    // Input Movement
    let moveX = 0;
    let moveY = 0;

    if (input.keys['ArrowLeft'] || input.keys['KeyA']) moveX -= 1;
    if (input.keys['ArrowRight'] || input.keys['KeyD']) moveX += 1;
    if (input.keys['ArrowUp'] || input.keys['KeyW']) moveY -= 1;
    if (input.keys['ArrowDown'] || input.keys['KeyS']) moveY += 1;

    // Mobile / Joystick input
    if (input.joystickActive) {
      moveX = input.joystickDir.x;
      moveY = input.joystickDir.y;
    }

    // Normalize diagonal movement
    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }

    // Apply acceleration & damping
    this.vx = moveX * this.speed;
    this.vy = moveY * this.speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Banking roll effect
    const targetRoll = moveX * 0.35;
    this.roll += (targetRoll - this.roll) * 10 * dt;

    // Clamp player within screen bounds
    const padding = this.radius + 6;
    this.x = Math.max(padding, Math.min(width - padding, this.x));
    this.y = Math.max(padding + 40, Math.min(height - padding - 20, this.y));

    // Thruster Particle Emission
    this.thrusterCycle += dt * 30;
    const thrusterColor = this.rapidFireTimer > 0 ? '#ffb703' : '#00f0ff';
    window.particleManager.createThruster(this.x - 7, this.y + 16, Math.PI / 2, 0.25, thrusterColor);
    window.particleManager.createThruster(this.x + 7, this.y + 16, Math.PI / 2, 0.25, thrusterColor);

    // Shooting
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }

    const isShooting = input.keys['Space'] || input.mouseFire || input.touchFire;
    if (isShooting && this.shootCooldown <= 0) {
      this.fire(projectiles);
    }
  }

  fire(projectiles) {
    const isRapid = this.rapidFireTimer > 0;
    const isSpread = this.spreadShotTimer > 0;
    const bulletSpeed = -650;

    this.shootCooldown = isRapid ? 0.08 : 0.17;

    if (isSpread) {
      // 3-way spread shot
      projectiles.push(new Projectile(this.x, this.y - 15, 0, bulletSpeed, 25, true, '#ff007f', 4.5));
      projectiles.push(new Projectile(this.x - 12, this.y - 8, -140, bulletSpeed * 0.95, 20, true, '#ff007f', 4));
      projectiles.push(new Projectile(this.x + 12, this.y - 8, 140, bulletSpeed * 0.95, 20, true, '#ff007f', 4));
      window.soundEngine.playPlayerLaser('spread');
    } else if (isRapid) {
      // Dual high-speed lasers
      projectiles.push(new Projectile(this.x - 10, this.y - 12, 0, bulletSpeed * 1.15, 18, true, '#ffb703', 3.5));
      projectiles.push(new Projectile(this.x + 10, this.y - 12, 0, bulletSpeed * 1.15, 18, true, '#ffb703', 3.5));
      window.soundEngine.playPlayerLaser('rapid');
    } else {
      // Standard dual cannons
      projectiles.push(new Projectile(this.x - 8, this.y - 10, 0, bulletSpeed, 22, true, '#00f0ff', 4));
      projectiles.push(new Projectile(this.x + 8, this.y - 10, 0, bulletSpeed, 22, true, '#00f0ff', 4));
      window.soundEngine.playPlayerLaser('default');
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.roll);

    // Invulnerability blink
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Shield Aura if shield active
    if (this.shield > 0 || this.shieldBuffTimer > 0) {
      ctx.save();
      const shieldPulse = 1 + 0.05 * Math.sin(Date.now() * 0.008);
      const shieldRadius = (this.radius + 12) * shieldPulse;
      ctx.beginPath();
      ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
      ctx.strokeStyle = this.shieldBuffTimer > 0 ? '#00f0ff' : 'rgba(0, 180, 216, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = this.shieldBuffTimer > 0 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 180, 216, 0.08)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Ship Hull Vector Path
    ctx.beginPath();
    // Nose tip
    ctx.moveTo(0, -22);
    // Right wing tip
    ctx.lineTo(18, 14);
    // Right inner wing cut
    ctx.lineTo(8, 10);
    // Engine mount right
    ctx.lineTo(6, 18);
    // Engine center indent
    ctx.lineTo(0, 14);
    // Engine mount left
    ctx.lineTo(-6, 18);
    // Left inner wing cut
    ctx.lineTo(-8, 10);
    // Left wing tip
    ctx.lineTo(-18, 14);
    ctx.closePath();

    // Hull Gradient
    const hullGrad = ctx.createLinearGradient(0, -22, 0, 18);
    hullGrad.addColorStop(0, '#e0fbfc');
    hullGrad.addColorStop(0.5, '#3d5a80');
    hullGrad.addColorStop(1, '#1b263b');

    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.stroke();

    // Cockpit Canopy
    ctx.beginPath();
    ctx.ellipse(0, -5, 4, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fill();

    // Wingtip lights
    ctx.fillStyle = '#ff007f';
    ctx.fillRect(-17, 12, 2.5, 3);
    ctx.fillStyle = '#06d6a0';
    ctx.fillRect(14.5, 12, 2.5, 3);

    ctx.restore();
  }
}

// ============================================================================
// BASE ENEMY & ARCHETYPES
// ============================================================================
class Enemy {
  constructor(x, y, hp, radius, speed, scoreValue) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.radius = radius;
    this.speed = speed;
    this.scoreValue = scoreValue;
    this.shootTimer = 1.0 + Math.random() * 2.0;
    this.markedForRemoval = false;
    this.time = Math.random() * 10;
  }

  takeDamage(dmg) {
    this.hp -= dmg;
    window.particleManager.createHitSparks(this.x, this.y, 4, '#ff9900');
    if (this.hp <= 0) {
      this.hp = 0;
      this.markedForRemoval = true;
      return true; // destroyed
    }
    return false;
  }

  update(dt, width, height, player, enemyProjectiles) {
    this.time += dt;
    this.y += this.speed * dt;

    if (this.y > height + 40) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    // override in subclasses
  }

  drawHealthBar(ctx) {
    if (this.hp < this.maxHp) {
      const barW = this.radius * 2;
      const barH = 4;
      const barY = this.y - this.radius - 8;
      const pct = Math.max(0, this.hp / this.maxHp);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(this.x - barW / 2, barY, barW, barH);
      ctx.fillStyle = '#ef233c';
      ctx.fillRect(this.x - barW / 2, barY, barW * pct, barH);
    }
  }
}

// 1. Scout Drone: Fast, swoops in wave, low HP
class ScoutDrone extends Enemy {
  constructor(x, y) {
    super(x, y, 25, 15, 190, 80);
    this.startX = x;
    this.frequency = 3.5;
    this.amplitude = 65;
  }

  update(dt, width, height, player, enemyProjectiles) {
    super.update(dt, width, height, player, enemyProjectiles);
    this.x = this.startX + Math.sin(this.time * this.frequency) * this.amplitude;

    // Boundary clamp
    this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));

    // Shoot occasionally
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shootTimer = 2.0 + Math.random() * 2.0;
      enemyProjectiles.push(new Projectile(this.x, this.y + 12, 0, 320, 15, false, '#ff0055', 3.5));
      window.soundEngine.playEnemyLaser();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(13, -12);
    ctx.lineTo(0, -6);
    ctx.lineTo(-13, -12);
    ctx.closePath();

    ctx.fillStyle = '#d90429';
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.stroke();

    // Eye sensor
    ctx.beginPath();
    ctx.arc(0, 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffff00';
    ctx.fill();

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// 2. Vanguard Fighter: Medium speed, tracks horizontal alignment, dual cannons
class VanguardFighter extends Enemy {
  constructor(x, y) {
    super(x, y, 65, 20, 120, 150);
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
  }

  update(dt, width, height, player, enemyProjectiles) {
    super.update(dt, width, height, player, enemyProjectiles);

    // Lateral strafing
    this.x += this.strafeDir * 80 * dt;
    if (this.x < 30 || this.x > width - 30) {
      this.strafeDir *= -1;
    }

    // Aimed shooting
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && this.y < height * 0.7) {
      this.shootTimer = 1.8 + Math.random() * 1.2;
      const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
      const bSpeed = 280;
      const vx = Math.cos(angleToPlayer) * bSpeed;
      const vy = Math.sin(angleToPlayer) * bSpeed;

      enemyProjectiles.push(new Projectile(this.x - 8, this.y + 10, vx, vy, 18, false, '#ff758c', 4));
      enemyProjectiles.push(new Projectile(this.x + 8, this.y + 10, vx, vy, 18, false, '#ff758c', 4));
      window.soundEngine.playEnemyLaser();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(18, -4);
    ctx.lineTo(14, -16);
    ctx.lineTo(0, -10);
    ctx.lineTo(-14, -16);
    ctx.lineTo(-18, -4);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, -16, 0, 18);
    grad.addColorStop(0, '#590d22');
    grad.addColorStop(1, '#ff4d6d');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ff758c';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 9;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// 3. Heavy Dreadnought: Tanky, slow, 3-way spread plasma
class HeavyDreadnought extends Enemy {
  constructor(x, y) {
    super(x, y, 160, 28, 65, 300);
  }

  update(dt, width, height, player, enemyProjectiles) {
    super.update(dt, width, height, player, enemyProjectiles);

    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && this.y < height * 0.65) {
      this.shootTimer = 2.4;
      const bSpeed = 240;
      // 3-way spread
      enemyProjectiles.push(new Projectile(this.x, this.y + 20, 0, bSpeed, 22, false, '#ffb703', 5));
      enemyProjectiles.push(new Projectile(this.x - 12, this.y + 15, -80, bSpeed * 0.95, 20, false, '#ffb703', 4.5));
      enemyProjectiles.push(new Projectile(this.x + 12, this.y + 15, 80, bSpeed * 0.95, 20, false, '#ffb703', 4.5));
      window.soundEngine.playEnemyLaser();
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.lineTo(26, 4);
    ctx.lineTo(22, -22);
    ctx.lineTo(-22, -22);
    ctx.lineTo(-26, 4);
    ctx.closePath();

    ctx.fillStyle = '#2b2d42';
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffb703';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.stroke();

    // Armor plates & core
    ctx.beginPath();
    ctx.arc(0, 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ef233c';
    ctx.fill();

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// 4. Rogue Asteroid: Obstacle, splits into 2 small pieces on death
class Asteroid extends Enemy {
  constructor(x, y, radius = 24, level = 2) {
    super(x, y, radius * 2.2, radius, 80 + Math.random() * 40, 50 * level);
    this.level = level; // 2 = big, 1 = small fragment
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 2;
    this.vx = (Math.random() - 0.5) * 45;

    // Generate jagged irregular vertices
    this.vertices = [];
    const numPoints = 8 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = this.radius * (0.8 + Math.random() * 0.4);
      this.vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
  }

  update(dt, width, height, player, enemyProjectiles) {
    this.time += dt;
    this.y += this.speed * dt;
    this.x += this.vx * dt;
    this.rotation += this.rotSpeed * dt;

    if (this.y > height + 40) {
      this.markedForRemoval = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.beginPath();
    ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
    for (let i = 1; i < this.vertices.length; i++) {
      ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = '#4a4e69';
    ctx.strokeStyle = '#9a8c98';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ============================================================================
// BOSS ENEMY (GOLIATH WARSHIP & VOID OVERLORD)
// ============================================================================
class BossEnemy extends Enemy {
  constructor(x, y, waveNumber) {
    const isOverlord = waveNumber >= 10;
    const baseHp = isOverlord ? 2500 : 1200;
    const hp = baseHp + (waveNumber - 5) * 200;

    super(x, y, hp, 55, 35, 2000);
    this.name = isOverlord ? "VOID OVERLORD" : "GOLIATH DREADNOUGHT";
    this.waveNumber = waveNumber;
    this.targetY = 120; // Enters and hovers at top of screen
    this.state = 'entering'; // 'entering', 'combat'
    this.attackPhase = 1;
    this.phaseTimer = 0;
    this.turretAngle = 0;
    this.strafeSpeed = 70;
    this.strafeDir = 1;
  }

  update(dt, width, height, player, enemyProjectiles) {
    this.time += dt;

    if (this.state === 'entering') {
      this.y += 55 * dt;
      if (this.y >= this.targetY) {
        this.y = this.targetY;
        this.state = 'combat';
      }
      return;
    }

    // Horizontal strafe
    this.x += this.strafeDir * this.strafeSpeed * dt;
    if (this.x < 90 || this.x > width - 90) {
      this.strafeDir *= -1;
    }

    // Determine phase based on HP percentage
    const hpPct = this.hp / this.maxHp;
    if (hpPct > 0.65) {
      this.attackPhase = 1;
    } else if (hpPct > 0.3) {
      this.attackPhase = 2;
    } else {
      this.attackPhase = 3; // Enraged!
    }

    // Attack routines
    this.phaseTimer += dt;
    this.turretAngle += 1.8 * dt;

    if (this.attackPhase === 1) {
      // Phase 1: Alternating targeted dual cannons
      if (this.phaseTimer >= 0.7) {
        this.phaseTimer = 0;
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        const bSpeed = 310;
        enemyProjectiles.push(new Projectile(this.x - 35, this.y + 30, Math.cos(angle) * bSpeed, Math.sin(angle) * bSpeed, 20, false, '#ef233c', 5));
        enemyProjectiles.push(new Projectile(this.x + 35, this.y + 30, Math.cos(angle) * bSpeed, Math.sin(angle) * bSpeed, 20, false, '#ef233c', 5));
        window.soundEngine.playEnemyLaser();
      }
    } else if (this.attackPhase === 2) {
      // Phase 2: Rotating 8-way bullet nova
      if (this.phaseTimer >= 1.1) {
        this.phaseTimer = 0;
        const count = 8;
        for (let i = 0; i < count; i++) {
          const a = this.turretAngle + (i / count) * Math.PI * 2;
          const bSpeed = 230;
          enemyProjectiles.push(new Projectile(this.x, this.y + 10, Math.cos(a) * bSpeed, Math.sin(a) * bSpeed, 18, false, '#ff007f', 4.5));
        }
        window.soundEngine.playEnemyLaser();
      }
    } else {
      // Phase 3: Enraged bullet-hell barrage
      if (this.phaseTimer >= 0.35) {
        this.phaseTimer = 0;
        const angle = Math.atan2(player.y - this.y, player.x - this.x) + (Math.random() - 0.5) * 0.4;
        const bSpeed = 340;
        enemyProjectiles.push(new Projectile(this.x + (Math.random() - 0.5) * 40, this.y + 30, Math.cos(angle) * bSpeed, Math.sin(angle) * bSpeed, 22, false, '#ffb703', 5));
        window.soundEngine.playEnemyLaser();
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Enraged glow pulse
    if (this.attackPhase === 3) {
      ctx.shadowColor = '#ef233c';
      ctx.shadowBlur = 25;
    }

    // Main Dreadnought Hull
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.lineTo(55, 10);
    ctx.lineTo(65, -30);
    ctx.lineTo(25, -45);
    ctx.lineTo(-25, -45);
    ctx.lineTo(-65, -30);
    ctx.lineTo(-55, 10);
    ctx.closePath();

    const hullGrad = ctx.createLinearGradient(0, -45, 0, 45);
    hullGrad.addColorStop(0, '#10172a');
    hullGrad.addColorStop(0.5, '#334155');
    hullGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = this.attackPhase === 3 ? '#ef233c' : '#ff007f';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();

    // Side Cannon Pods
    ctx.fillStyle = '#ef233c';
    ctx.fillRect(-45, 10, 10, 20);
    ctx.fillRect(35, 10, 10, 20);

    // Rotating Energy Core
    ctx.save();
    ctx.rotate(this.turretAngle);
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = this.attackPhase === 3 ? '#ff0055' : '#00f0ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 15;
    ctx.fill();

    // Core spokes
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }
}
