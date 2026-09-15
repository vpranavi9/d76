/**
 * Cosmic Strike - Core Game Engine
 * State Management, Wave Spawner, Collision Detection, HUD & Input
 */

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Display scaling
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // States: 'MENU', 'PLAYING', 'PAUSED', 'GAME_OVER'
    this.state = 'MENU';

    // Game Objects
    this.player = new Player(this.width / 2, this.height * 0.8);
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.enemies = [];
    this.powerups = [];
    this.activeBoss = null;

    // Safe storage helper
    const safeGet = (key, fallback) => {
      try {
        return localStorage.getItem(key) || fallback;
      } catch (e) {
        return fallback;
      }
    };

    // Progression & Waves
    this.wave = 1;
    this.score = 0;
    this.highScore = parseInt(safeGet('cosmic_high_score', '0'), 10);
    this.highestWave = parseInt(safeGet('cosmic_high_wave', '1'), 10);
    this.enemiesKilled = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.bossesDefeated = 0;

    // Combo system
    this.combo = 1;
    this.comboTimer = 0;
    this.maxCombo = 1;

    // Wave Spawner
    this.waveEnemiesToSpawn = [];
    this.spawnTimer = 0;
    this.waveTransitionTimer = 0;
    this.isWaveClearing = false;

    // Input state
    this.input = {
      keys: {},
      mouseFire: false,
      touchFire: false,
      joystickActive: false,
      joystickDir: { x: 0, y: 0 }
    };

    // Timing
    this.lastTime = 0;

    // UI Cache
    this.dom = {
      healthFill: document.getElementById('health-fill'),
      healthVal: document.getElementById('health-val'),
      shieldFill: document.getElementById('shield-fill'),
      shieldVal: document.getElementById('shield-val'),
      scoreNum: document.getElementById('score-num'),
      comboBadge: document.getElementById('combo-badge'),
      waveNum: document.getElementById('wave-num'),
      bombDots: document.querySelectorAll('.bomb-dot'),
      bossHud: document.getElementById('boss-hud'),
      bossName: document.getElementById('boss-name'),
      bossFill: document.getElementById('boss-fill'),
      alertBanner: document.getElementById('alert-banner'),
      alertTitle: document.getElementById('alert-title'),
      alertSub: document.getElementById('alert-sub'),
      buffShield: document.getElementById('buff-shield'),
      buffRapid: document.getElementById('buff-rapid'),
      buffSpread: document.getElementById('buff-spread'),
      startModal: document.getElementById('start-modal'),
      pauseModal: document.getElementById('pause-modal'),
      gameOverModal: document.getElementById('game-over-modal'),
      instructionsModal: document.getElementById('instructions-modal'),
      hsPreviewScore: document.getElementById('hs-preview-score'),
      hsPreviewWave: document.getElementById('hs-preview-wave')
    };

    this.setupResize();
    this.setupInputs();
    this.updateHighScoreDisplay();
  }

  setupResize() {
    const handleResize = () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      window.starfield.resize(this.width, this.height);
      if (this.state === 'MENU') {
        this.player.x = this.width / 2;
        this.player.y = this.height * 0.8;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
  }

  setupInputs() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.input.keys[e.code] = true;

      // Ensure audio context resumes on user interaction
      window.soundEngine.resume();

      // Trigger Bomb
      if ((e.code === 'KeyB' || e.code === 'KeyX') && this.state === 'PLAYING') {
        this.triggerBomb();
      }

      // Pause toggle
      if ((e.code === 'KeyP' || e.code === 'Escape') && (this.state === 'PLAYING' || this.state === 'PAUSED')) {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      this.input.keys[e.code] = false;
    });

    // Mouse Controls
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.state === 'PLAYING') {
        this.input.mouseFire = true;
        window.soundEngine.resume();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.mouseFire = false;
      }
    });

    // Mobile Virtual Joystick & Touch
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    let touchId = null;
    let origin = { x: 0, y: 0 };

    const handleTouchStart = (e) => {
      window.soundEngine.resume();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touchId === null) {
          touchId = touch.identifier;
          const rect = joystickZone.getBoundingClientRect();
          origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          this.input.joystickActive = true;
          handleTouchMove(e);
        }
      }
    };

    const handleTouchMove = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          const dx = touch.clientX - origin.x;
          const dy = touch.clientY - origin.y;
          const maxRadius = 45;
          const dist = Math.hypot(dx, dy);

          const angle = Math.atan2(dy, dx);
          const clampedDist = Math.min(dist, maxRadius);
          const knobX = Math.cos(angle) * clampedDist;
          const knobY = Math.sin(angle) * clampedDist;

          joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

          this.input.joystickDir.x = knobX / maxRadius;
          this.input.joystickDir.y = knobY / maxRadius;
        }
      }
    };

    const handleTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touchId = null;
          this.input.joystickActive = false;
          this.input.joystickDir = { x: 0, y: 0 };
          joystickKnob.style.transform = `translate(-50%, -50%)`;
        }
      }
    };

    if (joystickZone) {
      joystickZone.addEventListener('touchstart', handleTouchStart, { passive: false });
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
    }

    // Touch Buttons
    const btnTouchFire = document.getElementById('btn-touch-fire');
    if (btnTouchFire) {
      btnTouchFire.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.soundEngine.resume();
        this.input.touchFire = true;
      });
      btnTouchFire.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.input.touchFire = false;
      });
    }

    const btnTouchBomb = document.getElementById('btn-touch-bomb');
    if (btnTouchBomb) {
      btnTouchBomb.addEventListener('touchstart', (e) => {
        e.preventDefault();
        window.soundEngine.resume();
        if (this.state === 'PLAYING') this.triggerBomb();
      });
    }

    // Detect touch device
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('mobile-active');
    }
  }

  startNewGame() {
    this.state = 'PLAYING';
    this.wave = 1;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.maxCombo = 1;
    this.enemiesKilled = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.bossesDefeated = 0;

    this.projectiles = [];
    this.enemyProjectiles = [];
    this.enemies = [];
    this.powerups = [];
    this.activeBoss = null;
    window.particleManager.clear();

    this.player.reset(this.width / 2, this.height * 0.82);

    // Hide all modals
    this.hideAllModals();
    this.dom.bossHud.classList.remove('active');

    // Audio
    window.soundEngine.resume();
    window.soundEngine.startMusic();

    // Start Wave 1
    this.setupWave(this.wave);
  }

  setupWave(waveNum) {
    this.wave = waveNum;
    this.waveEnemiesToSpawn = [];
    this.spawnTimer = 0;
    this.isWaveClearing = false;

    const isBossWave = (waveNum % 5 === 0);

    if (isBossWave) {
      this.triggerBossAlert(waveNum);
    } else {
      this.showWaveBanner(`WAVE ${waveNum}`, "INCOMING HOSTILES");

      // Spawn distribution based on wave number
      const droneCount = 4 + waveNum * 2;
      const fighterCount = Math.max(0, (waveNum - 1) * 2);
      const dreadnoughtCount = Math.max(0, Math.floor((waveNum - 2) / 2));
      const asteroidCount = 2 + Math.floor(waveNum * 0.8);

      for (let i = 0; i < droneCount; i++) {
        this.waveEnemiesToSpawn.push('drone');
      }
      for (let i = 0; i < fighterCount; i++) {
        this.waveEnemiesToSpawn.push('fighter');
      }
      for (let i = 0; i < dreadnoughtCount; i++) {
        this.waveEnemiesToSpawn.push('heavy');
      }
      for (let i = 0; i < asteroidCount; i++) {
        this.waveEnemiesToSpawn.push('asteroid');
      }

      // Shuffle spawn queue
      this.waveEnemiesToSpawn.sort(() => Math.random() - 0.5);
    }
  }

  triggerBossAlert(waveNum) {
    this.dom.alertTitle.textContent = "WARNING: BOSS ENCOUNTER";
    this.dom.alertSub.textContent = waveNum >= 10 ? "VOID OVERLORD APPROACHING" : "GOLIATH DREADNOUGHT DETECTED";
    this.dom.alertBanner.classList.add('active');

    window.soundEngine.playBossAlert();
    window.starfield.setWarp(true);
    window.particleManager.triggerShake(10, 1.2);

    setTimeout(() => {
      this.dom.alertBanner.classList.remove('active');
      window.starfield.setWarp(false);

      if (this.state === 'PLAYING') {
        this.activeBoss = new BossEnemy(this.width / 2, -60, waveNum);
        this.enemies.push(this.activeBoss);

        this.dom.bossName.textContent = this.activeBoss.name;
        this.dom.bossFill.style.width = '100%';
        this.dom.bossHud.classList.add('active');
      }
    }, 2400);
  }

  showWaveBanner(title, sub) {
    this.dom.alertTitle.textContent = title;
    this.dom.alertSub.textContent = sub;
    this.dom.alertBanner.classList.add('active');

    setTimeout(() => {
      this.dom.alertBanner.classList.remove('active');
    }, 1800);
  }

  spawnEnemy(type) {
    const padding = 50;
    const spawnX = padding + Math.random() * (this.width - padding * 2);
    const spawnY = -40;

    switch (type) {
      case 'drone':
        this.enemies.push(new ScoutDrone(spawnX, spawnY));
        break;
      case 'fighter':
        this.enemies.push(new VanguardFighter(spawnX, spawnY));
        break;
      case 'heavy':
        this.enemies.push(new HeavyDreadnought(spawnX, spawnY));
        break;
      case 'asteroid':
        this.enemies.push(new Asteroid(spawnX, spawnY, 26 + Math.random() * 8, 2));
        break;
    }
  }

  triggerBomb() {
    if (this.player.bombs <= 0) return;
    this.player.bombs--;

    window.soundEngine.playBomb();
    window.particleManager.triggerShake(20, 0.75);

    // Shockwave rings
    window.particleManager.particles.push(new Particle(this.player.x, this.player.y, 0, 0, '#ffd166', 15, 1.0, 1.4, 'ring'));
    window.particleManager.particles.push(new Particle(this.player.x, this.player.y, 0, 0, '#00f0ff', 25, 1.0, 1.0, 'ring'));

    // Clear all enemy projectiles
    for (let i = 0; i < this.enemyProjectiles.length; i++) {
      const p = this.enemyProjectiles[i];
      window.particleManager.createHitSparks(p.x, p.y, 3, '#00f0ff');
    }
    this.enemyProjectiles = [];

    // Deal heavy damage to all on-screen enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const isDestroyed = enemy.takeDamage(260);
      if (isDestroyed) {
        this.handleEnemyDestruction(enemy);
      }
    }
  }

  handleEnemyDestruction(enemy) {
    this.enemiesKilled++;
    this.addScore(enemy.scoreValue);

    // Increment combo
    this.combo++;
    this.comboTimer = 3.0; // 3 sec combo window
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // VFX & SFX
    if (enemy instanceof BossEnemy) {
      window.particleManager.createBossExplosion(enemy.x, enemy.y);
      window.soundEngine.playExplosion('boss');
      this.bossesDefeated++;
      this.activeBoss = null;
      this.dom.bossHud.classList.remove('active');
      window.particleManager.addText(enemy.x, enemy.y, '+2000 BOSS DEFEATED', '#ff007f', 24, 1.8);

      // Boss always drops multiple power-ups
      this.dropPowerup(enemy.x - 25, enemy.y);
      this.dropPowerup(enemy.x + 25, enemy.y);
    } else {
      window.particleManager.createExplosion(enemy.x, enemy.y, 22);
      window.soundEngine.playExplosion(enemy.radius > 24 ? 'large' : 'medium');
      window.particleManager.addText(enemy.x, enemy.y, `+${enemy.scoreValue * this.combo}`, '#ffb703', 14);

      // Asteroid splitting into 2 smaller fragments
      if (enemy instanceof Asteroid && enemy.level === 2) {
        const frag1 = new Asteroid(enemy.x - 10, enemy.y, 14, 1);
        const frag2 = new Asteroid(enemy.x + 10, enemy.y, 14, 1);
        frag1.vx = -70;
        frag2.vx = 70;
        this.enemies.push(frag1, frag2);
      }

      // 20% Chance for Power-up drop
      if (Math.random() < 0.20) {
        this.dropPowerup(enemy.x, enemy.y);
      }
    }
  }

  dropPowerup(x, y) {
    const keys = Object.keys(POWERUP_TYPES);
    const randType = POWERUP_TYPES[keys[Math.floor(Math.random() * keys.length)]];
    this.powerups.push(new Powerup(x, y, randType));
  }

  addScore(pts) {
    this.score += pts * this.combo;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('cosmic_high_score', this.highScore.toString());
      } catch (e) {}
    }
  }

  updateHighScoreDisplay() {
    if (this.dom.hsPreviewScore) this.dom.hsPreviewScore.textContent = this.highScore.toLocaleString();
    if (this.dom.hsPreviewWave) this.dom.hsPreviewWave.textContent = this.highestWave.toString();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.dom.pauseModal.classList.add('active');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.dom.pauseModal.classList.remove('active');
      this.lastTime = performance.now();
    }
  }

  gameOver() {
    this.state = 'GAME_OVER';
    window.soundEngine.stopMusic();
    window.soundEngine.playGameOver();
    window.particleManager.createBossExplosion(this.player.x, this.player.y);

    if (this.wave > this.highestWave) {
      this.highestWave = this.wave;
      try {
        localStorage.setItem('cosmic_high_wave', this.highestWave.toString());
      } catch (e) {}
    }

    // Populate Debriefing Modal
    const accuracy = this.shotsFired > 0 ? Math.round((this.shotsHit / this.shotsFired) * 100) : 0;
    document.getElementById('final-score').textContent = this.score.toLocaleString();
    document.getElementById('final-wave').textContent = this.wave;
    document.getElementById('final-kills').textContent = this.enemiesKilled;
    document.getElementById('final-accuracy').textContent = `${accuracy}%`;
    document.getElementById('final-combo').textContent = `x${this.maxCombo}`;

    const newRecordEl = document.getElementById('new-record-tag');
    if (this.score >= this.highScore && this.score > 0) {
      newRecordEl.style.display = 'block';
    } else {
      newRecordEl.style.display = 'none';
    }

    setTimeout(() => {
      this.dom.gameOverModal.classList.add('active');
    }, 1200);
  }

  hideAllModals() {
    this.dom.startModal.classList.remove('active');
    this.dom.pauseModal.classList.remove('active');
    this.dom.gameOverModal.classList.remove('active');
    this.dom.instructionsModal.classList.remove('active');
  }

  // ==========================================================================
  // UPDATE LOOP
  // ==========================================================================
  update(dt) {
    // Parallax Starfield updates in all states (even menus for dynamic backdrop)
    window.starfield.update(dt);
    window.particleManager.update(dt);

    if (this.state !== 'PLAYING') return;

    // Combo decay
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    // Update Player
    const preFireCount = this.projectiles.length;
    this.player.update(dt, this.input, this.width, this.height, this.projectiles);
    if (this.projectiles.length > preFireCount) {
      this.shotsFired += (this.projectiles.length - preFireCount);
    }

    // Update Player Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this.width, this.height);
      if (p.markedForRemoval) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update Enemy Projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.update(dt, this.width, this.height);

      // Collision with Player
      const distToPlayer = Math.hypot(ep.x - this.player.x, ep.y - this.player.y);
      if (distToPlayer < ep.radius + this.player.radius) {
        ep.markedForRemoval = true;
        const isDead = this.player.applyDamage(ep.damage);
        if (isDead) {
          this.gameOver();
          return;
        }
      }

      if (ep.markedForRemoval) {
        this.enemyProjectiles.splice(i, 1);
      }
    }

    // Spawner Routine
    if (this.waveEnemiesToSpawn.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.8 + Math.random() * 0.9;
        const nextEnemyType = this.waveEnemiesToSpawn.shift();
        this.spawnEnemy(nextEnemyType);
      }
    } else if (this.enemies.length === 0 && !this.isWaveClearing) {
      // Wave Cleared!
      this.isWaveClearing = true;
      this.waveTransitionTimer = 2.0;
    }

    // Wave Transition Countdown
    if (this.isWaveClearing) {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0) {
        this.setupWave(this.wave + 1);
      }
    }

    // Update Enemies & Collisions
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.width, this.height, this.player, this.enemyProjectiles);

      // Check collision with Player's Projectiles
      for (let j = this.projectiles.length - 1; j >= 0; j--) {
        const bullet = this.projectiles[j];
        const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
        if (dist < bullet.radius + enemy.radius) {
          bullet.markedForRemoval = true;
          this.shotsHit++;
          const isDestroyed = enemy.takeDamage(bullet.damage);
          if (isDestroyed) {
            this.handleEnemyDestruction(enemy);
            break;
          }
        }
      }

      // Check physical collision with Player Hull
      const distToPlayer = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (distToPlayer < enemy.radius + this.player.radius) {
        const isDead = this.player.applyDamage(35);
        if (!(enemy instanceof BossEnemy)) {
          enemy.markedForRemoval = true;
          this.handleEnemyDestruction(enemy);
        }
        if (isDead) {
          this.gameOver();
          return;
        }
      }

      if (enemy.markedForRemoval) {
        this.enemies.splice(i, 1);
      }
    }

    // Update Power-ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pup = this.powerups[i];
      pup.update(dt, this.width, this.height);

      const dist = Math.hypot(pup.x - this.player.x, pup.y - this.player.y);
      if (dist < pup.radius + this.player.radius) {
        this.player.activatePowerup(pup);
        pup.markedForRemoval = true;
      }

      if (pup.markedForRemoval) {
        this.powerups.splice(i, 1);
      }
    }

    // Update Boss HUD if boss is active
    if (this.activeBoss) {
      const bossPct = Math.max(0, (this.activeBoss.hp / this.activeBoss.maxHp) * 100);
      this.dom.bossFill.style.width = `${bossPct}%`;
    }

    // Sync HUD Elements
    this.syncHUD();
  }

  syncHUD() {
    // Player Health & Shield
    const hpPct = Math.max(0, (this.player.health / this.player.maxHealth) * 100);
    this.dom.healthFill.style.width = `${hpPct}%`;
    this.dom.healthVal.textContent = Math.ceil(this.player.health);

    const shieldPct = Math.max(0, (this.player.shield / this.player.maxShield) * 100);
    this.dom.shieldFill.style.width = `${shieldPct}%`;
    this.dom.shieldVal.textContent = Math.ceil(this.player.shield);

    // Score & Wave
    this.dom.scoreNum.textContent = this.score.toLocaleString();
    this.dom.waveNum.textContent = `WAVE ${this.wave}`;

    // Combo Multiplier
    if (this.combo > 1) {
      this.dom.comboBadge.textContent = `x${this.combo} COMBO!`;
      this.dom.comboBadge.classList.add('active');
    } else {
      this.dom.comboBadge.classList.remove('active');
    }

    // Bombs
    for (let i = 0; i < this.dom.bombDots.length; i++) {
      if (i < this.player.bombs) {
        this.dom.bombDots[i].classList.remove('empty');
      } else {
        this.dom.bombDots[i].classList.add('empty');
      }
    }

    // Buff Pills
    this.updateBuffPill(this.dom.buffShield, this.player.shieldBuffTimer);
    this.updateBuffPill(this.dom.buffRapid, this.player.rapidFireTimer);
    this.updateBuffPill(this.dom.buffSpread, this.player.spreadShotTimer);
  }

  updateBuffPill(el, timer) {
    if (timer > 0) {
      el.classList.add('active');
      const timerSpan = el.querySelector('.buff-timer');
      if (timerSpan) timerSpan.textContent = `${Math.ceil(timer)}s`;
    } else {
      el.classList.remove('active');
    }
  }

  // ==========================================================================
  // RENDER LOOP
  // ==========================================================================
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Parallax Starfield & Nebulae
    window.starfield.draw(this.ctx);

    // Apply Screen Shake offset
    this.ctx.save();
    this.ctx.translate(window.particleManager.shakeOffset.x, window.particleManager.shakeOffset.y);

    // Draw Power-ups
    for (let i = 0; i < this.powerups.length; i++) {
      this.powerups[i].draw(this.ctx);
    }

    // Draw Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].draw(this.ctx);
    }

    // Draw Enemy Projectiles
    for (let i = 0; i < this.enemyProjectiles.length; i++) {
      this.enemyProjectiles[i].draw(this.ctx);
    }

    // Draw Player Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].draw(this.ctx);
    }

    // Draw Player
    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'MENU') {
      this.player.draw(this.ctx);
    }

    // Draw Particle VFX & Floating Texts
    window.particleManager.draw(this.ctx);

    this.ctx.restore();
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Cap dt to prevent tunneling on lag spikes or tab switching
    if (dt > 0.1) dt = 0.1;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Global bootstrap once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
  window.game.loop(0);

  // Setup Menu Button Listeners
  const btnStart = document.getElementById('btn-start');
  const btnInstructions = document.getElementById('btn-instructions');
  const btnBackMenu = document.getElementById('btn-back-menu');
  const btnPauseResume = document.getElementById('btn-pause-resume');
  const btnPauseRestart = document.getElementById('btn-pause-restart');
  const btnGameOverRestart = document.getElementById('btn-game-over-restart');
  const btnHudPause = document.getElementById('btn-hud-pause');
  const btnHudAudio = document.getElementById('btn-hud-audio');

  const sfxSlider = document.getElementById('slider-sfx');
  const musicSlider = document.getElementById('slider-music');

  if (btnStart) {
    btnStart.addEventListener('click', () => window.game.startNewGame());
  }

  if (btnInstructions) {
    btnInstructions.addEventListener('click', () => {
      window.game.dom.instructionsModal.classList.add('active');
    });
  }

  if (btnBackMenu) {
    btnBackMenu.addEventListener('click', () => {
      window.game.dom.instructionsModal.classList.remove('active');
    });
  }

  if (btnPauseResume) {
    btnPauseResume.addEventListener('click', () => window.game.togglePause());
  }

  if (btnPauseRestart) {
    btnPauseRestart.addEventListener('click', () => window.game.startNewGame());
  }

  if (btnGameOverRestart) {
    btnGameOverRestart.addEventListener('click', () => window.game.startNewGame());
  }

  if (btnHudPause) {
    btnHudPause.addEventListener('click', () => window.game.togglePause());
  }

  if (btnHudAudio) {
    btnHudAudio.addEventListener('click', () => {
      const isMuted = !window.soundEngine.isMuted;
      window.soundEngine.setMuted(isMuted);
      btnHudAudio.innerHTML = isMuted ? '🔇 Muted' : '🔊 Sound';
    });
  }

  if (sfxSlider) {
    sfxSlider.addEventListener('input', (e) => {
      window.soundEngine.setSfxVolume(parseFloat(e.target.value));
    });
  }

  if (musicSlider) {
    musicSlider.addEventListener('input', (e) => {
      window.soundEngine.setMusicVolume(parseFloat(e.target.value));
    });
  }
});
