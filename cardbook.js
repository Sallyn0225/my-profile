// Card Book Module
// Cyber card collection book with page flip, upload modal, image crop, and API integration

(function() {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────
  // After deploying the Worker, replace this with your Worker URL
  const API_BASE = '';
  const CARDS_PER_PAGE = 3;
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  const LANDSCAPE_SIZE = { w: 900, h: 550 };
  const PORTRAIT_SIZE = { w: 550, h: 900 };
  const WEBP_QUALITY = 0.82;
  const SWIPE_THRESHOLD = 50;

  // ── State ──────────────────────────────────────────────────────
  let cards = [];
  let currentPage = 0;
  let totalPages = 1;
  let cursor = null;
  let hasMore = true;
  let loading = false;

  // Upload state
  let uploadFile = null;
  let uploadOrientation = null;
  let cropImg = null;
  let cropBox = { x: 0, y: 0, w: 0, h: 0 };
  let dragStart = null;

  // ── DOM refs ───────────────────────────────────────────────────
  const viewport = document.querySelector('.cardbook-viewport');
  const prevBtn = document.querySelector('.cardbook-prev');
  const nextBtn = document.querySelector('.cardbook-next');
  const pageIndicator = document.querySelector('.cardbook-page-indicator');
  const uploadBtn = document.querySelector('.cardbook-upload-btn');
  const modal = document.querySelector('.cardbook-modal');
  const modalBackdrop = document.querySelector('.cardbook-modal-backdrop');
  const modalClose = document.querySelector('.cardbook-modal-close');
  const fileInput = document.querySelector('.cardbook-file-input');
  const cropCanvas = document.querySelector('.cardbook-crop-canvas');
  const cropBoxEl = document.querySelector('.cardbook-crop-box');
  const confirmBtn = document.querySelector('.cardbook-confirm-btn');
  const steps = {
    file: document.querySelector('.cardbook-step--file'),
    orient: document.querySelector('.cardbook-step--orient'),
    crop: document.querySelector('.cardbook-step--crop'),
    uploading: document.querySelector('.cardbook-step--uploading')
  };
  const orientBtns = document.querySelectorAll('.cardbook-orient-btn');

  // ── Helpers ────────────────────────────────────────────────────

  function supportsWebP() {
    try {
      var c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) {
      return false;
    }
  }

  var useWebP = supportsWebP();

  function showStep(name) {
    Object.values(steps).forEach(function(s) { s.classList.remove('active'); });
    if (steps[name]) steps[name].classList.add('active');
  }

  function openModal() {
    modal.hidden = false;
    showStep('file');
    fileInput.value = '';
    uploadFile = null;
    uploadOrientation = null;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // ── Page rendering ─────────────────────────────────────────────

  function getPageCards(pageIndex) {
    var start = pageIndex * CARDS_PER_PAGE;
    return cards.slice(start, start + CARDS_PER_PAGE);
  }

  function renderPage() {
    totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;

    // Clear existing pages (keep spine)
    var existingPages = viewport.querySelectorAll('.cardbook-page');
    existingPages.forEach(function(p) { p.remove(); });

    var pageCards = getPageCards(currentPage);
    var page = document.createElement('div');
    page.className = 'cardbook-page cardbook-page--active';

    if (pageCards.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'cardbook-empty';
      empty.setAttribute('data-i18n', 'cardbook.empty');
      empty.textContent = '还没有名片，来交换一张吧！';
      page.appendChild(empty);
    } else {
      pageCards.forEach(function(card) {
        var div = document.createElement('div');
        var orient = card.orientation || 'landscape';
        div.className = 'cardbook-card cardbook-card--' + orient;
        var img = document.createElement('img');
        img.src = card.imageUrl;
        img.alt = 'Card';
        img.loading = 'lazy';
        img.decoding = 'async';
        div.appendChild(img);
        page.appendChild(div);
      });
    }

    viewport.appendChild(page);

    // Update nav
    prevBtn.disabled = currentPage <= 0;
    nextBtn.disabled = currentPage >= totalPages - 1 && !hasMore;
    pageIndicator.textContent = (currentPage + 1) + ' / ' + totalPages;
  }

  // ── Page flip animation ────────────────────────────────────────

  var isFlipping = false;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function flipToPage(newPage) {
    if (isFlipping || newPage === currentPage) return;
    if (newPage < 0 || (newPage >= totalPages && !hasMore)) return;

    // If we need more cards and are going forward, fetch them
    if (newPage >= totalPages && hasMore) {
      fetchCards().then(function() {
        totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
        if (newPage < totalPages) {
          flipToPage(newPage);
        }
      });
      return;
    }

    isFlipping = true;
    var goingForward = newPage > currentPage;

    // Build the new page
    var newPageCards = getPageCards(newPage);
    var newPageEl = document.createElement('div');
    newPageEl.className = 'cardbook-page cardbook-page--next';

    if (newPageCards.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'cardbook-empty';
      empty.setAttribute('data-i18n', 'cardbook.empty');
      empty.textContent = '还没有名片，来交换一张吧！';
      newPageEl.appendChild(empty);
    } else {
      newPageCards.forEach(function(card) {
        var div = document.createElement('div');
        var orient = card.orientation || 'landscape';
        div.className = 'cardbook-card cardbook-card--' + orient;
        var img = document.createElement('img');
        img.src = card.imageUrl;
        img.alt = 'Card';
        img.loading = 'lazy';
        img.decoding = 'async';
        div.appendChild(img);
        newPageEl.appendChild(div);
      });
    }

    viewport.appendChild(newPageEl);

    var activePage = viewport.querySelector('.cardbook-page--active');

    if (reducedMotion) {
      // Simple opacity fade
      if (activePage) {
        activePage.style.opacity = '0';
        setTimeout(function() { activePage.remove(); }, 300);
      }
      newPageEl.style.opacity = '0';
      newPageEl.classList.remove('cardbook-page--next');
      newPageEl.classList.add('cardbook-page--active');
      requestAnimationFrame(function() {
        newPageEl.style.opacity = '1';
      });
    } else {
      // 3D flip
      if (activePage && goingForward) {
        activePage.classList.remove('cardbook-page--active');
        activePage.classList.add('cardbook-page--flipped');
      } else if (activePage) {
        activePage.style.opacity = '0';
      }

      newPageEl.classList.remove('cardbook-page--next');
      newPageEl.classList.add('cardbook-page--active');

      // Clean up old page after transition
      if (activePage) {
        activePage.addEventListener('transitionend', function handler() {
          activePage.removeEventListener('transitionend', handler);
          activePage.remove();
        });
        // Fallback cleanup
        setTimeout(function() {
          if (activePage.parentNode) activePage.remove();
        }, 800);
      }
    }

    currentPage = newPage;
    prevBtn.disabled = currentPage <= 0;
    nextBtn.disabled = currentPage >= totalPages - 1 && !hasMore;
    pageIndicator.textContent = (currentPage + 1) + ' / ' + totalPages;

    setTimeout(function() { isFlipping = false; }, reducedMotion ? 350 : 750);
  }

  // ── Image crop logic ───────────────────────────────────────────

  var cropCtx = cropCanvas.getContext('2d');
  var canvasScale = 1;

  function initCrop() {
    if (!cropImg || !uploadOrientation) return;

    var targetRatio = uploadOrientation === 'landscape'
      ? LANDSCAPE_SIZE.w / LANDSCAPE_SIZE.h
      : PORTRAIT_SIZE.w / PORTRAIT_SIZE.h;

    // Size canvas to fit modal width
    var containerWidth = cropCanvas.parentElement.clientWidth;
    var imgRatio = cropImg.naturalWidth / cropImg.naturalHeight;
    var drawW, drawH;

    if (imgRatio > 1) {
      drawW = containerWidth;
      drawH = containerWidth / imgRatio;
    } else {
      drawH = Math.min(containerWidth * 1.2, cropImg.naturalHeight);
      drawW = drawH * imgRatio;
      if (drawW > containerWidth) {
        drawW = containerWidth;
        drawH = containerWidth / imgRatio;
      }
    }

    cropCanvas.width = drawW;
    cropCanvas.height = drawH;
    canvasScale = cropImg.naturalWidth / drawW;

    cropCtx.drawImage(cropImg, 0, 0, drawW, drawH);

    // Init crop box centered
    var boxW, boxH;
    if (targetRatio > 1) {
      boxW = drawW * 0.8;
      boxH = boxW / targetRatio;
      if (boxH > drawH * 0.9) {
        boxH = drawH * 0.9;
        boxW = boxH * targetRatio;
      }
    } else {
      boxH = drawH * 0.8;
      boxW = boxH * targetRatio;
      if (boxW > drawW * 0.9) {
        boxW = drawW * 0.9;
        boxH = boxW / targetRatio;
      }
    }

    cropBox.w = boxW;
    cropBox.h = boxH;
    cropBox.x = (drawW - boxW) / 2;
    cropBox.y = (drawH - boxH) / 2;

    updateCropBox();
  }

  function updateCropBox() {
    cropBoxEl.style.left = cropBox.x + 'px';
    cropBoxEl.style.top = cropBox.y + 'px';
    cropBoxEl.style.width = cropBox.w + 'px';
    cropBoxEl.style.height = cropBox.h + 'px';
  }

  function clampCropBox() {
    cropBox.x = Math.max(0, Math.min(cropBox.x, cropCanvas.width - cropBox.w));
    cropBox.y = Math.max(0, Math.min(cropBox.y, cropCanvas.height - cropBox.h));
  }

  // Drag crop box (mouse + touch)
  function onCropPointerDown(e) {
    e.preventDefault();
    var pt = e.touches ? e.touches[0] : e;
    var rect = cropCanvas.getBoundingClientRect();
    dragStart = {
      px: pt.clientX,
      py: pt.clientY,
      ox: cropBox.x,
      oy: cropBox.y
    };
  }

  function onCropPointerMove(e) {
    if (!dragStart) return;
    e.preventDefault();
    var pt = e.touches ? e.touches[0] : e;
    cropBox.x = dragStart.ox + (pt.clientX - dragStart.px);
    cropBox.y = dragStart.oy + (pt.clientY - dragStart.py);
    clampCropBox();
    updateCropBox();
  }

  function onCropPointerUp() {
    dragStart = null;
  }

  cropBoxEl.addEventListener('mousedown', onCropPointerDown);
  cropBoxEl.addEventListener('touchstart', onCropPointerDown, { passive: false });
  document.addEventListener('mousemove', onCropPointerMove);
  document.addEventListener('touchmove', onCropPointerMove, { passive: false });
  document.addEventListener('mouseup', onCropPointerUp);
  document.addEventListener('touchend', onCropPointerUp);

  // ── Canvas export & upload ─────────────────────────────────────

  function exportCroppedImage(callback) {
    var targetSize = uploadOrientation === 'landscape' ? LANDSCAPE_SIZE : PORTRAIT_SIZE;
    var outCanvas = document.createElement('canvas');
    outCanvas.width = targetSize.w;
    outCanvas.height = targetSize.h;
    var ctx = outCanvas.getContext('2d');

    // Source rect in original image coords
    var sx = cropBox.x * canvasScale;
    var sy = cropBox.y * canvasScale;
    var sw = cropBox.w * canvasScale;
    var sh = cropBox.h * canvasScale;

    ctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, targetSize.w, targetSize.h);

    var mimeType = useWebP ? 'image/webp' : 'image/jpeg';
    var quality = useWebP ? WEBP_QUALITY : 0.85;
    outCanvas.toBlob(callback, mimeType, quality);
  }

  function uploadCard(blob) {
    if (!API_BASE) {
      // Demo mode: create local object URL
      var url = URL.createObjectURL(blob);
      cards.push({
        id: 'local-' + Date.now(),
        orientation: uploadOrientation,
        imageUrl: url
      });
      renderPage();
      closeModal();
      return;
    }

    showStep('uploading');

    var formData = new FormData();
    var ext = useWebP ? '.webp' : '.jpg';
    formData.append('image', blob, 'card' + ext);
    formData.append('orientation', uploadOrientation);

    fetch(API_BASE + '/api/cards', {
      method: 'POST',
      body: formData
    })
    .then(function(res) {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    })
    .then(function(data) {
      cards.unshift({
        id: data.id,
        orientation: data.orientation,
        imageUrl: API_BASE + '/api/cards/image/' + data.key
      });
      currentPage = 0;
      renderPage();
      closeModal();
    })
    .catch(function(err) {
      console.error('Card upload error:', err);
      closeModal();
      // Could show a toast here
    });
  }

  // ── Fetch cards from API ───────────────────────────────────────

  function fetchCards() {
    if (!API_BASE || loading) return Promise.resolve();
    loading = true;

    var url = API_BASE + '/api/cards?limit=9';
    if (cursor) url += '&cursor=' + encodeURIComponent(cursor);

    return fetch(url)
      .then(function(res) {
        if (!res.ok) throw new Error('Fetch failed');
        return res.json();
      })
      .then(function(data) {
        data.cards.forEach(function(c) {
          cards.push({
            id: c.id,
            orientation: c.orientation,
            imageUrl: API_BASE + '/api/cards/image/' + c.key
          });
        });
        cursor = data.cursor || null;
        hasMore = data.hasMore || false;
        totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
        loading = false;
      })
      .catch(function(err) {
        console.warn('Failed to fetch cards:', err);
        loading = false;
      });
  }

  // ── Event bindings ─────────────────────────────────────────────

  // Navigation
  prevBtn.addEventListener('click', function() { flipToPage(currentPage - 1); });
  nextBtn.addEventListener('click', function() { flipToPage(currentPage + 1); });

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    if (!modal.hidden) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    // Only handle arrows when cardbook section is in view
    var rect = viewport.getBoundingClientRect();
    var inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;

    if (e.key === 'ArrowLeft') flipToPage(currentPage - 1);
    if (e.key === 'ArrowRight') flipToPage(currentPage + 1);
  });

  // Touch swipe on viewport
  var touchStartX = 0;
  var touchStartY = 0;

  viewport.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  viewport.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    // Only horizontal swipes
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) flipToPage(currentPage + 1);
      else flipToPage(currentPage - 1);
    }
  }, { passive: true });

  // Upload modal
  uploadBtn.addEventListener('click', openModal);
  modalBackdrop.addEventListener('click', closeModal);
  modalClose.addEventListener('click', closeModal);

  // File selection
  fileInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      console.warn('File too large (max 2MB)');
      return;
    }
    if (!file.type.startsWith('image/')) {
      console.warn('Not an image file');
      return;
    }
    uploadFile = file;
    showStep('orient');
  });

  // Orientation selection
  orientBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      uploadOrientation = btn.getAttribute('data-orient');
      // Load image for cropping
      var reader = new FileReader();
      reader.onload = function(ev) {
        cropImg = new Image();
        cropImg.onload = function() {
          showStep('crop');
          // Wait for DOM to update before measuring
          requestAnimationFrame(function() { initCrop(); });
        };
        cropImg.src = ev.target.result;
      };
      reader.readAsDataURL(uploadFile);
    });
  });

  // Confirm upload
  confirmBtn.addEventListener('click', function() {
    exportCroppedImage(function(blob) {
      if (blob) uploadCard(blob);
    });
  });

  // ── Init ───────────────────────────────────────────────────────

  // Load cards from API on startup
  if (API_BASE) {
    fetchCards().then(function() { renderPage(); });
  } else {
    renderPage();
  }

})();
