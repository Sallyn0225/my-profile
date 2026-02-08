(function() {
  'use strict';

  // --- DOM Elements ---
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return; // Guard if game section is missing

  const ctx = canvas.getContext('2d');
  const currentScoreEl = document.getElementById('current-score');
  const bestScoreEl = document.getElementById('best-score');
  const gameOverOverlay = document.querySelector('.game-over-overlay');
  const restartBtn = document.querySelector('.game-restart-btn');
  const reducedMotionWarning = document.querySelector('.reduced-motion-warning');
  const enableMotionBtn = document.querySelector('.enable-animations-btn');

  // --- Game Constants ---
  // Physics tuned for 320x480 @ 60fps
  const PHYSICS = {
    GRAVITY: 0.25,
    JUMP: -4.6,
    PIPE_SPEED: 2,
    PIPE_SPAWN_RATE: 1800, // ms
    PIPE_WIDTH: 52,
    PIPE_GAP: 130,
    BIRD_SIZE: 30, // diameter
    BIRD_X: 50
  };

  const I18N_TEXT = {
    zh: { tap: '点击开始' },
    en: { tap: 'Tap to Start' },
    ja: { tap: 'スタート' }
  };

  // --- State Variables ---
  let state = 'READY'; // READY, PLAYING, GAME_OVER
  let frames = 0;
  let lastTime = 0;
  let score = 0;
  let bestScore = parseInt(localStorage.getItem('flappyKahoBest') || '0');
  let pipes = [];
  let bird = {
    x: PHYSICS.BIRD_X,
    y: 150,
    velocity: 0,
    radius: PHYSICS.BIRD_SIZE / 2,
    rotation: 0
  };

  // --- Assets ---
  const birdImg = new Image();
  let isBirdLoaded = false;
  birdImg.src = 'kaho-origin_pixel_art.png';
  birdImg.onload = () => { isBirdLoaded = true; };

  // --- Environment State ---
  let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let motionOverride = false;
  let isTabActive = !document.hidden;
  let dpr = window.devicePixelRatio || 1;
  let lang = document.documentElement.lang || 'zh';
  let spawnTimer = 0;

  // --- Background State ---
  let bgOffsets = {
    clouds: 0,
    hills: 0,
    trees: 0,
    ground: 0
  };

  // --- Background Renderer Module ---
  const BackgroundRenderer = {
    colors: {
      sky: ['#87CEEB', '#4682B4'],
      clouds: '#FFFFFF',
      hills: ['#9ACD32', '#6B8E23'],
      trees: ['#2F4F2F', '#1C3D1C'],
      ground: ['#7CFC00', '#32CD32']
    },

    drawSky: function(ctx, w, h) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, this.colors.sky[0]);
      grad.addColorStop(1, this.colors.sky[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },

    drawClouds: function(ctx, w, h, offset) {
      if (ThemeManager.getCurrentTheme() === 'dark') {
        // Dark mode: draw moon and stars
        // Draw moon
        ctx.fillStyle = this.colors.moon;
        ctx.beginPath();
        ctx.arc(w - 60, 60, 25, 0, Math.PI * 2);
        ctx.fill();

        // Draw stars (fixed positions for consistency)
        ctx.fillStyle = this.colors.stars;
        const stars = [
          { x: 40, y: 50, r: 2 },
          { x: 90, y: 80, r: 1.5 },
          { x: 140, y: 45, r: 2 },
          { x: 200, y: 70, r: 1.5 },
          { x: 250, y: 40, r: 2 }
        ];

        for (let i = 0; i < stars.length; i++) {
          ctx.beginPath();
          ctx.arc(stars[i].x, stars[i].y, stars[i].r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Light mode: draw clouds
        ctx.fillStyle = this.colors.clouds;
        const cloudWidth = 60;
        const numClouds = Math.ceil(w / cloudWidth) + 2;

        for (let i = 0; i < numClouds; i++) {
          const x = Math.floor((i * cloudWidth - offset) % (w + cloudWidth));
          const y = Math.floor(30 + Math.sin(i * 0.5) * 20);

          ctx.fillRect(x, y, Math.floor(cloudWidth * 0.8), Math.floor(cloudWidth * 0.3));
          ctx.fillRect(x + Math.floor(cloudWidth * 0.2), y - Math.floor(cloudWidth * 0.15), Math.floor(cloudWidth * 0.6), Math.floor(cloudWidth * 0.25));
          ctx.fillRect(x + Math.floor(cloudWidth * 0.1), y + Math.floor(cloudWidth * 0.05), Math.floor(cloudWidth * 0.7), Math.floor(cloudWidth * 0.2));
        }
      }
    },

    drawHills: function(ctx, w, h, offset) {
      const hillWidth = 80;
      const numHills = Math.ceil(w / hillWidth) + 2;
      const hillBaseY = h - 80;

      for (let i = 0; i < numHills; i++) {
        const x = Math.floor((i * hillWidth - offset) % (w + hillWidth));
        const hillHeight = Math.floor(40 + Math.sin(i * 0.7) * 20);

        ctx.fillStyle = this.colors.hills[i % 2];
        ctx.beginPath();
        ctx.moveTo(x, hillBaseY);
        ctx.lineTo(x + Math.floor(hillWidth / 2), hillBaseY - hillHeight);
        ctx.lineTo(x + hillWidth, hillBaseY);
        ctx.closePath();
        ctx.fill();
      }
    },

    drawTrees: function(ctx, w, h, offset) {
      const treeWidth = 30;
      const numTrees = Math.ceil(w / treeWidth) + 2;
      const treeBaseY = h - 80;

      for (let i = 0; i < numTrees; i++) {
        const x = Math.floor((i * treeWidth - offset) % (w + treeWidth));
        const treeHeight = Math.floor(35 + Math.sin(i * 0.9) * 15);

        ctx.fillStyle = this.colors.trees[i % 2];

        ctx.beginPath();
        ctx.moveTo(x, treeBaseY);
        ctx.lineTo(x + Math.floor(treeWidth / 2), treeBaseY - treeHeight);
        ctx.lineTo(x + treeWidth, treeBaseY);
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(x + Math.floor(treeWidth / 2) - 2, treeBaseY - treeHeight, 4, treeHeight);
      }
    },

    drawGround: function(ctx, w, h, offset) {
      const groundHeight = 80;
      const patternWidth = 40;
      const numPatterns = Math.ceil(w / patternWidth) + 2;

      ctx.fillStyle = this.colors.ground[0];
      ctx.fillRect(0, h - groundHeight, w, groundHeight);

      ctx.fillStyle = this.colors.ground[1];
      for (let i = 0; i < numPatterns; i++) {
        const x = Math.floor((i * patternWidth - offset) % (w + patternWidth));
        ctx.fillRect(x, h - groundHeight + 5, Math.floor(patternWidth / 2), 10);
        ctx.fillRect(x + Math.floor(patternWidth / 2), h - groundHeight + 20, Math.floor(patternWidth / 2), 8);
      }
    },

    render: function(ctx, w, h) {
      ctx.imageSmoothingEnabled = false;

      this.drawSky(ctx, w, h);
      this.drawClouds(ctx, w, h, bgOffsets.clouds);
      this.drawHills(ctx, w, h, bgOffsets.hills);
      this.drawTrees(ctx, w, h, bgOffsets.trees);
      this.drawGround(ctx, w, h, bgOffsets.ground);
    }
  };

  // --- Theme Manager Module ---
  const ThemeManager = {
    themes: {
      light: {
        sky: ['#87CEEB', '#4682B4'],
        clouds: '#FFFFFF',
        hills: ['#9ACD32', '#6B8E23'],
        trees: ['#2F4F2F', '#1C3D1C'],
        ground: ['#7CFC00', '#32CD32']
      },
      dark: {
        sky: ['#0f172a', '#1e293b'],
        moon: '#FFFACD',
        stars: '#FFFFFF',
        hills: ['#4B0082', '#2F4F4F'],
        trees: ['#1C1C1C', '#0A0A0A'],
        ground: ['#2F4F2F', '#1C3D1C']
      }
    },

    currentTheme: 'light',

    getCurrentTheme: function() {
      return this.currentTheme;
    },

    applyTheme: function() {
      const theme = this.themes[this.currentTheme];
      BackgroundRenderer.colors = theme;
    },

    init: function() {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.currentTheme = darkModeQuery.matches ? 'dark' : 'light';
      this.applyTheme();

      darkModeQuery.addEventListener('change', (e) => {
        this.currentTheme = e.matches ? 'dark' : 'light';
        this.applyTheme();
      });
    }
  };

  // --- Sound Manager ---
  let audioCtx = null;
  let activeSounds = 0;
  const MAX_CONCURRENT_SOUNDS = 3;

  function playScoreSound() {
    if (!isTabActive) return;
    if (activeSounds >= MAX_CONCURRENT_SOUNDS) return;

    activeSounds++;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);

    setTimeout(() => {
      activeSounds--;
    }, 100);
  }

  // --- Initialization ---
  function init() {
    setupHiDPI();
    setupEventListeners();
    updateBestScoreDisplay();
    ThemeManager.init();

    // Check initial reduced motion state
    if (prefersReducedMotion && !motionOverride) {
      if (reducedMotionWarning) reducedMotionWarning.classList.remove('hidden');
    } else {
      if (reducedMotionWarning) reducedMotionWarning.classList.add('hidden');
      requestAnimationFrame(gameLoop);
    }
  }

  function setupHiDPI() {
    const rect = canvas.getBoundingClientRect();
    // Default to 320x480 if not visible yet
    const width = rect.width || 320;
    const height = rect.height || 480;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Normalize coordinate system to CSS pixels
    ctx.scale(dpr, dpr);
    
    // Handle resize
    // We mainly care about dpr changes or layout shifts, but for fixed size canvas 
    // we usually just set it once unless responsive CSS changes dimensions.
  }

  function setupEventListeners() {
    // 1. Input Handling (Mouse/Touch)
    canvas.addEventListener('mousedown', handleInput);
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault(); // Prevent scrolling
      handleInput();
    }, { passive: false });

    // 2. Input Handling (Keyboard)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        // Prevent scrolling
        e.preventDefault();
        handleInput();
      }
    });

    // 3. Restart Button
    if (restartBtn) {
      restartBtn.addEventListener('click', restartGame);
    }
    // Also allow clicking overlay text to restart if needed, but button is clear.

    // 4. Reduced Motion Override
    if (enableMotionBtn) {
      enableMotionBtn.addEventListener('click', () => {
        motionOverride = true;
        if (reducedMotionWarning) reducedMotionWarning.classList.add('hidden');
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
      });
    }

    // 5. Visibility Change
    document.addEventListener('visibilitychange', () => {
      isTabActive = !document.hidden;
      if (isTabActive && !shouldPause()) {
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
      }
    });

    // 6. i18n Language Change
    // Watch for lang attribute changes on <html>
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'lang') {
          lang = document.documentElement.lang || 'zh';
          // Force redraw to update text
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    // 7. Window Resize
    // Ensure canvas internal resolution matches CSS size (prevent blurry rendering)
    window.addEventListener('resize', () => {
      setupHiDPI();
      // Force a single draw in case the loop is paused
      requestAnimationFrame(() => draw());
    });
  }

  function shouldPause() {
    if (!isTabActive) return true;
    if (prefersReducedMotion && !motionOverride) return true;
    return false;
  }

  function handleInput() {
    if (shouldPause()) return;

    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } else if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (state === 'READY') {
      state = 'PLAYING';
    } else if (state === 'PLAYING') {
      bird.velocity = PHYSICS.JUMP;
    } else if (state === 'GAME_OVER') {
      // Allow restarting by clicking/tapping the canvas or pressing Space.
      restartGame();
    }
  }

  function resetGame() {
    state = 'READY';
    bird.y = 150;
    bird.velocity = 0;
    bird.rotation = 0;
    score = 0;
    pipes = [];
    spawnTimer = 0;
    frames = 0;
    
    // Reset UI
    if (currentScoreEl) currentScoreEl.textContent = '0';
    if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
    if (restartBtn) restartBtn.classList.add('hidden');
  }

  function restartGame() {
    resetGame();
    state = 'PLAYING';
    bird.velocity = PHYSICS.JUMP;
  }

  function spawnPipe() {
    // Pipe gap position (y)
    // Canvas height 480. Ground takes some space? Let's assume full height.
    // Gap size 130. 
    // Min pipe height ~50.
    // Range for top pipe bottom: 50 to (480 - 50 - 130) = 300
    const maxPos = canvas.height / dpr - 50 - PHYSICS.PIPE_GAP;
    const minPos = 50;
    const gapY = Math.floor(Math.random() * (maxPos - minPos + 1)) + minPos;

    pipes.push({
      x: canvas.width / dpr,
      y: gapY,
      passed: false
    });
  }

  function update(dt) {
    // Cap dt to avoid huge jumps
    if (dt > 100) dt = 16;
    
    // Frame scaler (target 60fps)
    const scaler = dt / (1000 / 60); 

    if (state === 'PLAYING') {
      // 1. Update Bird
      bird.velocity += PHYSICS.GRAVITY * scaler;
      bird.y += bird.velocity * scaler;

      // Rotation logic
      if (bird.velocity < 0) bird.rotation = -25 * Math.PI / 180;
      else {
        bird.rotation += 2 * Math.PI / 180 * scaler;
        if (bird.rotation > 90 * Math.PI / 180) bird.rotation = 90 * Math.PI / 180;
      }

      // 2. Update Background (Parallax scrolling)
      bgOffsets.clouds += PHYSICS.PIPE_SPEED * 0.3 * scaler;
      bgOffsets.hills += PHYSICS.PIPE_SPEED * 0.5 * scaler;
      bgOffsets.trees += PHYSICS.PIPE_SPEED * 0.8 * scaler;
      bgOffsets.ground += PHYSICS.PIPE_SPEED * scaler;

      // 3. Update Pipes
      spawnTimer += dt;
      if (spawnTimer > PHYSICS.PIPE_SPAWN_RATE) {
        spawnPipe();
        spawnTimer = 0;
      }

      pipes.forEach(pipe => {
        pipe.x -= PHYSICS.PIPE_SPEED * scaler;

        // Check passed
        if (!pipe.passed && pipe.x + PHYSICS.PIPE_WIDTH < bird.x) {
          score++;
          pipe.passed = true;
          playScoreSound();
          if (currentScoreEl) currentScoreEl.textContent = score;

          // Difficulty increase? (Optional, not in spec)
        }
      });

      // Remove off-screen pipes
      pipes = pipes.filter(pipe => pipe.x + PHYSICS.PIPE_WIDTH > -10);

      // 4. Collision Detection
      checkCollision();
    } else if (state === 'READY') {
      // Bobbing animation
      frames++;
      bird.y = 150 + Math.sin(frames * 0.05) * 5;
    }
  }

  function checkCollision() {
    const birdLeft = bird.x - bird.radius + 4; // shrink hitbox slightly
    const birdRight = bird.x + bird.radius - 4;
    const birdTop = bird.y - bird.radius + 4;
    const birdBottom = bird.y + bird.radius - 4;

    const floorY = canvas.height / dpr;

    // 1. Floor/Ceiling
    if (birdBottom >= floorY || birdTop <= 0) {
      gameOver();
      return;
    }

    // 2. Pipes
    for (const pipe of pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PHYSICS.PIPE_WIDTH;
      const gapTop = pipe.y;
      const gapBottom = pipe.y + PHYSICS.PIPE_GAP;

      // Horizontal overlap
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Vertical check (hit top pipe OR hit bottom pipe)
        if (birdTop < gapTop || birdBottom > gapBottom) {
          gameOver();
          return;
        }
      }
    }
  }

  function gameOver() {
    state = 'GAME_OVER';
    
    // Save High Score
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('flappyKahoBest', bestScore);
      updateBestScoreDisplay();
    }

    // Show Game Over UI
    if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');
    if (restartBtn) restartBtn.classList.remove('hidden');
  }

  function updateBestScoreDisplay() {
    if (bestScoreEl) bestScoreEl.textContent = bestScore;
  }

  function drawPipe(ctx, x, topY, bottomY, h, isTop) {
    // Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;

    const bodyWidth = PHYSICS.PIPE_WIDTH; // 52
    const capWidth = bodyWidth + 8; // 60
    const capHeight = 10;
    const capOffset = (capWidth - bodyWidth) / 2; // 4px each side

    // Pixel-perfect coordinates
    const xInt = Math.floor(x);
    const topInt = Math.floor(topY);
    const botInt = Math.floor(bottomY);

    // Colors
    const bodyMainColor = '#22c55e'; // Green
    const bodyDarkColor = '#16a34a'; // Darker green
    const capColor = '#22c55e';
    const borderColor = '#14532d'; // Dark green

    if (isTop) {
      // Top pipe: cap at bottom (facing gap)
      const bodyHeight = topInt - capHeight;

      // Pipe body
      ctx.fillStyle = bodyMainColor;
      ctx.fillRect(xInt, 0, bodyWidth, bodyHeight);

      // Body detail stripes (pixel art style)
      ctx.fillStyle = bodyDarkColor;
      ctx.fillRect(xInt + 10, 0, 5, bodyHeight);
      ctx.fillRect(xInt + 37, 0, 5, bodyHeight);

      // Pipe cap (wider, at bottom)
      ctx.fillStyle = capColor;
      ctx.fillRect(xInt - capOffset, bodyHeight, capWidth, capHeight);

      // Border for body
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(xInt, 0, bodyWidth, bodyHeight);

      // Border for cap
      ctx.strokeRect(xInt - capOffset, bodyHeight, capWidth, capHeight);
    } else {
      // Bottom pipe: cap at top (facing gap)
      const bodyY = botInt + capHeight;
      const bodyHeight = h - bodyY;

      // Pipe cap (wider, at top)
      ctx.fillStyle = capColor;
      ctx.fillRect(xInt - capOffset, botInt, capWidth, capHeight);

      // Pipe body
      ctx.fillStyle = bodyMainColor;
      ctx.fillRect(xInt, bodyY, bodyWidth, bodyHeight);

      // Body detail stripes (pixel art style)
      ctx.fillStyle = bodyDarkColor;
      ctx.fillRect(xInt + 10, bodyY, 5, bodyHeight);
      ctx.fillRect(xInt + 37, bodyY, 5, bodyHeight);

      // Border for cap
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(xInt - capOffset, botInt, capWidth, capHeight);

      // Border for body
      ctx.strokeRect(xInt, bodyY, bodyWidth, bodyHeight);
    }
  }

  function draw() {
    // Clear canvas
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    // Draw pixel-art layered background with parallax scrolling
    BackgroundRenderer.render(ctx, w, h);

    // Draw Pipes with pixel-art caps
    pipes.forEach(pipe => {
      // Top Pipe
      drawPipe(ctx, pipe.x, pipe.y, 0, h, true);

      // Bottom Pipe
      const bottomY = pipe.y + PHYSICS.PIPE_GAP;
      drawPipe(ctx, pipe.x, bottomY, h, h, false);
    });

    // Draw Bird
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    if (isBirdLoaded) {
      // Draw Image
      const s = PHYSICS.BIRD_SIZE;
      ctx.drawImage(birdImg, -s/2, -s/2, s, s);
    } else {
      // Fallback Circle
      ctx.fillStyle = '#fbbf24'; // Amber
      ctx.beginPath();
      ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Draw "Get Ready" text
    if (state === 'READY') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      
      const text = (I18N_TEXT[lang] || I18N_TEXT.zh).tap;
      ctx.fillText(text, w / 2, h / 2 + 50);
    }
  }

  function gameLoop(timestamp) {
    if (shouldPause()) return;

    const dt = timestamp - lastTime;
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
  }

  // --- Start ---
  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
