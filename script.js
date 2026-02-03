// Profile Page Interactions
// Handles entrance animations and mouse parallax effect

(function() {
  'use strict';

  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Initialize entrance animations
   * Adds 'active' class to .fade-in elements with staggered delays
   */
  function initEntranceAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in');

    if (fadeElements.length === 0) {
      console.warn('No .fade-in elements found');
      return;
    }

    fadeElements.forEach((element, index) => {
      // Calculate staggered delay: 0.1s increments
      const delay = index * 0.1;

      if (prefersReducedMotion) {
        // Skip animation delay for users who prefer reduced motion
        element.classList.add('active');
      } else {
        // Apply staggered delay
        element.style.animationDelay = `${delay}s`;
        element.classList.add('active');
      }
    });

    console.log(`Activated ${fadeElements.length} entrance animations`);
  }

  /**
   * Initialize mouse parallax effect
   * Applies subtle transform to avatar based on mouse position
   */
  function initParallaxEffect() {
    // Skip parallax if user prefers reduced motion
    if (prefersReducedMotion) {
      console.log('Parallax effect skipped (prefers-reduced-motion)');
      return;
    }

    const avatar = document.querySelector('.avatar');

    if (!avatar) {
      console.warn('Avatar element not found for parallax effect');
      return;
    }

    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;

    // Track mouse position
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Smooth parallax update using requestAnimationFrame
    function updateParallax() {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Calculate offset from center (subtle movement: /50)
      const targetX = (mouseX - centerX) / 50;
      const targetY = (mouseY - centerY) / 50;

      // Smooth interpolation (lerp)
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      // Apply transform to avatar
      avatar.style.transform = `translate(${currentX}px, ${currentY}px) scale(1)`;

      // Continue animation loop
      requestAnimationFrame(updateParallax);
    }

    // Start parallax animation loop
    requestAnimationFrame(updateParallax);
    console.log('Parallax effect initialized');
  }

  /**
   * Initialize Star Particles System
   * Creates up to 50 stars with interactive/ambient behavior
   */
  function initStarParticles() {
    // Skip if user prefers reduced motion
    if (prefersReducedMotion) {
      console.log('Star particles skipped (prefers-reduced-motion)');
      return;
    }

    const container = document.querySelector('.stars-container');
    if (!container) {
      console.warn('Stars container not found');
      return;
    }

    const MAX_STARS = 50;
    const isMobile = 'ontouchstart' in window || window.matchMedia('(max-width: 768px)').matches;
    const stars = [];
    let isPaused = false;
    let mouseX = -1000;
    let mouseY = -1000;

    // Create stars
    for (let i = 0; i < MAX_STARS; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      
      // Random position
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      star.style.left = `${x}%`;
      star.style.top = `${y}%`;
      
      // Random size
      const size = Math.random() * 2 + 1; // 1-3px
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;

      if (isMobile) {
        // Mobile: CSS animation for twinkling
        star.classList.add('twinkle');
        star.style.setProperty('--twinkle-duration', `${Math.random() * 3 + 2}s`);
        star.style.setProperty('--twinkle-delay', `${Math.random() * 5}s`);
      }

      container.appendChild(star);
      
      stars.push({
        element: star,
        x: x, // percentage
        y: y, // percentage
        baseOpacity: 0.2
      });
    }

    // Desktop: Mouse interaction loop
    if (!isMobile) {
      document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
      });

      function updateStars() {
        if (isPaused) return;

        stars.forEach(star => {
          // Get star position in pixels
          const starRect = star.element.getBoundingClientRect();
          const starX = starRect.left + starRect.width / 2;
          const starY = starRect.top + starRect.height / 2;

          // Calculate distance to mouse
          const dx = mouseX - starX;
          const dy = mouseY - starY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Calculate brightness based on distance (radius 200px)
          let brightness = star.baseOpacity;
          if (distance < 200) {
            const proximity = 1 - (distance / 200);
            brightness = star.baseOpacity + (proximity * 0.8); // Max opacity ~1.0
          }

          star.element.style.opacity = brightness;
        });

        requestAnimationFrame(updateStars);
      }

      // Start loop
      requestAnimationFrame(updateStars);
    }

    // Pause on visibility change
    document.addEventListener('visibilitychange', () => {
      isPaused = document.hidden;
    });

    console.log(`Initialized ${MAX_STARS} star particles (${isMobile ? 'Mobile' : 'Desktop'} mode)`);
  }

  /**
   * Initialize Shooting Star / Meteor System
   * Spawns a meteor about every ~10s (randomized 8-12s).
   * Direction: right-up -> left-down
   */
  function initMeteors() {
    // Skip if user prefers reduced motion
    if (prefersReducedMotion) {
      console.log('Meteors skipped (prefers-reduced-motion)');
      return;
    }

    const container = document.querySelector('.stars-container');
    if (!container) {
      console.warn('Stars container not found (meteors)');
      return;
    }

    let timerId = null;
    let isPaused = document.hidden;

    function clearNext() {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    }

    function spawnMeteor() {
      const meteor = document.createElement('div');
      meteor.className = 'meteor';

      // Random start position (top-right area)
      // X: 80vw to 120vw (mostly right side)
      // Y: -20vh to 30vh (top area)
      const startX = Math.random() * 40 + 80; // 80..120vw
      const startY = Math.random() * 50 - 20; // -20..30vh
      
      meteor.style.setProperty('--start-x', `${startX}vw`);
      meteor.style.setProperty('--start-y', `${startY}vh`);
      
      // Randomize angle slightly around -45deg
      const angle = -45 + (Math.random() * 10 - 5); // -50 to -40
      meteor.style.setProperty('--angle', `${angle}deg`);

      // Randomize duration/size for natural feel
      const durationMs = 2000 + Math.random() * 1000; // 2s - 3s (slower is more majestic)
      const widthPx = 150 + Math.random() * 150; // 150..300px
      meteor.style.setProperty('--meteor-duration', `${durationMs}ms`);
      meteor.style.setProperty('--meteor-width', `${widthPx}px`);

      container.appendChild(meteor);

      const cleanup = () => {
        meteor.removeEventListener('animationend', cleanup);
        if (meteor.parentNode) meteor.parentNode.removeChild(meteor);
      };

      meteor.addEventListener('animationend', cleanup);
      // Safety cleanup in case animationend doesn't fire
      window.setTimeout(cleanup, durationMs + 1000);
    }

    function scheduleNextMeteor() {
      clearNext();
      if (isPaused) return;

      // 8-12s randomized
      const delayMs = 8000 + Math.random() * 4000;
      timerId = window.setTimeout(() => {
        spawnMeteor();
        scheduleNextMeteor();
      }, delayMs);
    }

    // Pause on visibility change to reduce background work
    document.addEventListener('visibilitychange', () => {
      isPaused = document.hidden;
      if (isPaused) {
        clearNext();
      } else {
        // Resume immediately or with a small delay
        scheduleNextMeteor();
      }
    });

    scheduleNextMeteor();
    console.log('Meteors initialized (~10s interval)');
  }

  /**
   * Initialize Carousel Autoplay
   * Auto-scrolls carousel every 4 seconds with reduced-motion support
   */
  function initCarousel() {
    const track = document.querySelector('.carousel-track');
    const slides = document.querySelectorAll('.carousel-slide');

    if (!track || slides.length === 0) {
      console.warn('Carousel elements not found');
      return;
    }

    // Skip autoplay if user prefers reduced motion
    if (prefersReducedMotion) {
      console.log('Carousel autoplay skipped (prefers-reduced-motion)');
      return;
    }

    let currentIndex = 0;
    let interval;

    /**
     * Scroll to specific slide with smooth animation
     */
    function scrollToSlide(index) {
      const slideWidth = slides[0].offsetWidth;
      track.scrollTo({
        left: slideWidth * index,
        behavior: 'smooth'
      });
    }

    /**
     * Start auto-playing carousel
     */
    function startAutoplay() {
      interval = setInterval(() => {
        // Loop back to 0 after the last slide
        currentIndex = (currentIndex + 1) % slides.length;
        scrollToSlide(currentIndex);
      }, 4000); // 4 seconds
    }

    /**
     * Stop auto-playing carousel
     */
    function stopAutoplay() {
      clearInterval(interval);
    }

    // Start autoplay
    startAutoplay();

    // Pause when page hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });

    // Optional: pause on hover
    track.addEventListener('mouseenter', stopAutoplay);
    track.addEventListener('mouseleave', startAutoplay);

    console.log('Carousel autoplay initialized');
  }

  /**
   * Initialize all interactions
   */
  function init() {
    try {
      initEntranceAnimations();
      initParallaxEffect();
      initStarParticles();
      initMeteors();
      initCarousel();
    } catch (error) {
      console.error('Error initializing interactions:', error);
    }
  }

  // Run initialization when DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded, run immediately
    init();
  }

})();
