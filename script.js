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
   * Initialize all interactions
   */
  function init() {
    try {
      initEntranceAnimations();
      initParallaxEffect();
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