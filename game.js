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

  // --- Initialization ---
  function init() {
    setupHiDPI();
    setupEventListeners();
    updateBestScoreDisplay();
    
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

      // 2. Update Pipes
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
          if (currentScoreEl) currentScoreEl.textContent = score;
          
          // Difficulty increase? (Optional, not in spec)
        }
      });

      // Remove off-screen pipes
      pipes = pipes.filter(pipe => pipe.x + PHYSICS.PIPE_WIDTH > -10);

      // 3. Collision Detection
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

  function draw() {
    // Clear canvas
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    // Background (Gradient for sky)
    // Night theme: dark blue
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0f172a'); // Slate 900
    grad.addColorStop(1, '#1e293b'); // Slate 800
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw Pipes
    ctx.fillStyle = '#22c55e'; // Green pipes
    ctx.strokeStyle = '#14532d'; // Dark green border
    ctx.lineWidth = 2;

    pipes.forEach(pipe => {
      // Top Pipe
      ctx.fillRect(pipe.x, 0, PHYSICS.PIPE_WIDTH, pipe.y);
      ctx.strokeRect(pipe.x, 0, PHYSICS.PIPE_WIDTH, pipe.y);
      
      // Bottom Pipe
      const bottomY = pipe.y + PHYSICS.PIPE_GAP;
      const bottomH = h - bottomY;
      ctx.fillRect(pipe.x, bottomY, PHYSICS.PIPE_WIDTH, bottomH);
      ctx.strokeRect(pipe.x, bottomY, PHYSICS.PIPE_WIDTH, bottomH);
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
