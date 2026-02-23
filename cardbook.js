// Card Book Module
// Cyber card collection book with page flip, upload modal, image crop, and API integration

(function() {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────
  const API_BASE = 'https://cardbook-api.z1921531571.workers.dev';
  const CARDS_PER_PAGE = 3;
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  const LANDSCAPE_SIZE = { w: 900, h: 550 };
  const PORTRAIT_SIZE = { w: 550, h: 900 };
  const WEBP_QUALITY = 0.82;
  const SWIPE_THRESHOLD = 50;

  // ── State ──────────────────────────────────────────────────────
  var cards = [];
  var currentSpread = 0;  // desktop: spread index (2 pages per spread)
  var currentPage = 0;    // mobile: single page index
  var totalPages = 1;
  var cursor = null;
  var hasMore = true;
  var loading = false;

  // Upload state
  var uploadFile = null;
  var uploadOrientation = null;
  var cropImg = null;
  var cropBox = { x: 0, y: 0, w: 0, h: 0 };
  var cropMinW = 0, cropMaxW = 0;
  var dragStart = null;

  // ── Responsive detection ─────────────────────────────────────
  var mobileQuery = window.matchMedia('(max-width: 640px)');
  var isMobile = mobileQuery.matches;
  mobileQuery.addEventListener('change', function(e) {
    isMobile = e.matches;
    syncFromSpread();
    renderPage();
  });

  // ── DOM refs ───────────────────────────────────────────────────
  var book = document.querySelector('.cardbook-book');
  var viewportLeft = document.querySelector('.cardbook-viewport--left');
  var viewportRight = document.querySelector('.cardbook-viewport--right');
  var prevBtn = document.querySelector('.cardbook-prev');
  var nextBtn = document.querySelector('.cardbook-next');
  var pageIndicator = document.querySelector('.cardbook-page-indicator');
  var uploadBtn = document.querySelector('.cardbook-upload-btn');
  var modal = document.querySelector('.cardbook-modal');
  var modalBackdrop = document.querySelector('.cardbook-modal-backdrop');
  var modalClose = document.querySelector('.cardbook-modal-close');

  var fileInput = document.querySelector('.cardbook-file-input');
  var cropCanvas = document.querySelector('.cardbook-crop-canvas');
  var cropBoxEl = document.querySelector('.cardbook-crop-box');
  var zoomSlider = document.querySelector('.cardbook-zoom-slider');
  var confirmBtn = document.querySelector('.cardbook-confirm-btn');
  var steps = {
    file: document.querySelector('.cardbook-step--file'),
    orient: document.querySelector('.cardbook-step--orient'),
    crop: document.querySelector('.cardbook-step--crop'),
    uploading: document.querySelector('.cardbook-step--uploading')
  };
  var orientBtns = document.querySelectorAll('.cardbook-orient-btn');

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

  // Sync currentPage from currentSpread and vice versa
  function syncFromSpread() {
    if (isMobile) {
      currentPage = currentSpread * 2;
    }
  }

  function syncFromPage() {
    currentSpread = Math.floor(currentPage / 2);
  }


  // ── Page rendering ─────────────────────────────────────────────

  function getPageCards(pageIndex) {
    var start = pageIndex * CARDS_PER_PAGE;
    return cards.slice(start, start + CARDS_PER_PAGE);
  }

  function buildPageEl(pageIndex) {
    var pageCards = getPageCards(pageIndex);
    var page = document.createElement('div');
    page.className = 'cardbook-page cardbook-page--active';

    if (pageCards.length === 0 && pageIndex === 0) {
      var empty = document.createElement('p');
      empty.className = 'cardbook-empty';
      empty.setAttribute('data-i18n', 'cardbook.empty');
      empty.textContent = '还没有名片，来交换一张吧！';
      page.appendChild(empty);
    } else if (pageCards.length === 0) {
      // Empty page beyond content — leave blank
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
        div.addEventListener('click', function() { openLightbox(card.imageUrl); });
        page.appendChild(div);
      });
    }
    return page;
  }

  function clearViewport(vp) {
    var pages = vp.querySelectorAll('.cardbook-page');
    pages.forEach(function(p) { p.remove(); });
  }

  function renderPage() {
    totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));

    if (isMobile) {
      // Single page mode — only use right viewport
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      if (currentPage < 0) currentPage = 0;
      syncFromPage();

      clearViewport(viewportRight);
      viewportRight.appendChild(buildPageEl(currentPage));

      prevBtn.disabled = currentPage <= 0;
      nextBtn.disabled = currentPage >= totalPages - 1 && !hasMore;
      pageIndicator.textContent = (currentPage + 1) + ' / ' + totalPages;
    } else {
      // Desktop spread mode
      var totalSpreads = Math.max(1, Math.ceil(totalPages / 2));
      if (currentSpread >= totalSpreads) currentSpread = totalSpreads - 1;
      if (currentSpread < 0) currentSpread = 0;

      var leftIdx = currentSpread * 2;
      var rightIdx = leftIdx + 1;

      clearViewport(viewportLeft);
      clearViewport(viewportRight);

      viewportLeft.appendChild(buildPageEl(leftIdx));
      if (rightIdx < totalPages) {
        viewportRight.appendChild(buildPageEl(rightIdx));
      } else {
        // Empty right page
        var emptyPage = document.createElement('div');
        emptyPage.className = 'cardbook-page cardbook-page--active';
        viewportRight.appendChild(emptyPage);
      }

      prevBtn.disabled = currentSpread <= 0;
      nextBtn.disabled = currentSpread >= totalSpreads - 1 && !hasMore;
      pageIndicator.textContent = (currentSpread + 1) + ' / ' + totalSpreads;
    }
  }


  // ── Page flip animation ────────────────────────────────────────

  var isFlipping = false;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function flipPageInViewport(vp, newPageEl, goingForward) {
    var activePage = vp.querySelector('.cardbook-page--active');

    vp.appendChild(newPageEl);

    if (reducedMotion) {
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
      if (activePage) {
        activePage.classList.remove('cardbook-page--active');
        if (goingForward) {
          activePage.classList.add('cardbook-page--flipped');
        } else {
          activePage.classList.add('cardbook-page--unflipped');
        }
      }

      newPageEl.classList.remove('cardbook-page--next');
      newPageEl.classList.add('cardbook-page--active');

      if (activePage) {
        activePage.addEventListener('transitionend', function handler() {
          activePage.removeEventListener('transitionend', handler);
          activePage.remove();
        });
        setTimeout(function() {
          if (activePage.parentNode) activePage.remove();
        }, 800);
      }
    }
  }

  function navigateForward() {
    if (isMobile) {
      flipToMobilePage(currentPage + 1);
    } else {
      flipToSpread(currentSpread + 1);
    }
  }

  function navigateBackward() {
    if (isMobile) {
      flipToMobilePage(currentPage - 1);
    } else {
      flipToSpread(currentSpread - 1);
    }
  }


  function flipToMobilePage(newPage) {
    if (isFlipping || newPage === currentPage) return;
    if (newPage < 0 || (newPage >= totalPages && !hasMore)) return;

    if (newPage >= totalPages && hasMore) {
      fetchCards().then(function() {
        totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
        if (newPage < totalPages) flipToMobilePage(newPage);
      });
      return;
    }

    isFlipping = true;
    var goingForward = newPage > currentPage;

    var newPageEl = buildPageEl(newPage);
    newPageEl.className = 'cardbook-page cardbook-page--next';
    flipPageInViewport(viewportRight, newPageEl, goingForward);

    currentPage = newPage;
    syncFromPage();
    prevBtn.disabled = currentPage <= 0;
    nextBtn.disabled = currentPage >= totalPages - 1 && !hasMore;
    pageIndicator.textContent = (currentPage + 1) + ' / ' + totalPages;

    setTimeout(function() { isFlipping = false; }, reducedMotion ? 350 : 750);
  }

  function flipToSpread(newSpread) {
    if (isFlipping || newSpread === currentSpread) return;
    var totalSpreads = Math.max(1, Math.ceil(totalPages / 2));
    if (newSpread < 0 || (newSpread >= totalSpreads && !hasMore)) return;

    if (newSpread >= totalSpreads && hasMore) {
      fetchCards().then(function() {
        totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
        var ts = Math.max(1, Math.ceil(totalPages / 2));
        if (newSpread < ts) flipToSpread(newSpread);
      });
      return;
    }

    isFlipping = true;
    var goingForward = newSpread > currentSpread;

    var leftIdx = newSpread * 2;
    var rightIdx = leftIdx + 1;

    // Build new pages
    var newLeftEl = buildPageEl(leftIdx);
    newLeftEl.className = 'cardbook-page cardbook-page--next';

    var newRightEl;
    if (rightIdx < totalPages) {
      newRightEl = buildPageEl(rightIdx);
    } else {
      newRightEl = document.createElement('div');
      newRightEl.className = 'cardbook-page';
    }
    newRightEl.className = 'cardbook-page cardbook-page--next';

    flipPageInViewport(viewportLeft, newLeftEl, goingForward);
    flipPageInViewport(viewportRight, newRightEl, goingForward);

    currentSpread = newSpread;
    var ts2 = Math.max(1, Math.ceil(totalPages / 2));
    prevBtn.disabled = currentSpread <= 0;
    nextBtn.disabled = currentSpread >= ts2 - 1 && !hasMore;
    pageIndicator.textContent = (currentSpread + 1) + ' / ' + ts2;

    setTimeout(function() { isFlipping = false; }, reducedMotion ? 350 : 750);
  }


  // ── Lightbox ───────────────────────────────────────────────────

  var lightboxEl = null;

  function openLightbox(imageUrl) {
    if (lightboxEl) return;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'cardbook-lightbox';
    var img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Card full view';
    lightboxEl.appendChild(img);
    document.body.appendChild(lightboxEl);
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(function() {
      lightboxEl.classList.add('cardbook-lightbox--visible');
    });

    lightboxEl.addEventListener('click', closeLightbox);
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('cardbook-lightbox--visible');
    var el = lightboxEl;
    setTimeout(function() {
      if (el.parentNode) el.remove();
    }, 300);
    lightboxEl = null;
    // Only restore overflow if modal is also closed
    if (modal.hidden) {
      document.body.style.overflow = '';
    }
  }


  // ── Image crop logic ───────────────────────────────────────────

  var cropCtx = cropCanvas.getContext('2d');
  var canvasScale = 1;

  function initCrop() {
    if (!cropImg || !uploadOrientation) return;

    var targetRatio = uploadOrientation === 'landscape'
      ? LANDSCAPE_SIZE.w / LANDSCAPE_SIZE.h
      : PORTRAIT_SIZE.w / PORTRAIT_SIZE.h;

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

    cropMaxW = Math.min(drawW, drawH * targetRatio);
    cropMinW = cropMaxW * 0.2;

    cropBox.w = boxW;
    cropBox.h = boxH;
    cropBox.x = (drawW - boxW) / 2;
    cropBox.y = (drawH - boxH) / 2;

    syncSlider();
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

  function onCropPointerDown(e) {
    e.preventDefault();
    var pt = e.touches ? e.touches[0] : e;
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


  // ── Zoom: resize crop box keeping aspect ratio ───────────────

  function syncSlider() {
    if (!zoomSlider || cropMaxW <= cropMinW) return;
    var t = (cropBox.w - cropMinW) / (cropMaxW - cropMinW);
    zoomSlider.value = (1 - t) * 100;
  }

  function applyCropZoom(newW) {
    var targetRatio = uploadOrientation === 'landscape'
      ? LANDSCAPE_SIZE.w / LANDSCAPE_SIZE.h
      : PORTRAIT_SIZE.w / PORTRAIT_SIZE.h;

    newW = Math.max(cropMinW, Math.min(cropMaxW, newW));
    var newH = newW / targetRatio;

    var cx = cropBox.x + cropBox.w / 2;
    var cy = cropBox.y + cropBox.h / 2;
    cropBox.w = newW;
    cropBox.h = newH;
    cropBox.x = cx - newW / 2;
    cropBox.y = cy - newH / 2;

    clampCropBox();
    updateCropBox();
  }

  if (zoomSlider) {
    zoomSlider.addEventListener('input', function() {
      var t = 1 - (parseFloat(zoomSlider.value) / 100);
      var newW = cropMinW + t * (cropMaxW - cropMinW);
      applyCropZoom(newW);
    });
  }

  cropCanvas.parentElement.addEventListener('wheel', function(e) {
    if (!cropImg) return;
    e.preventDefault();
    var delta = e.deltaY > 0 ? -0.05 : 0.05;
    var newW = cropBox.w + delta * (cropMaxW - cropMinW);
    applyCropZoom(newW);
    syncSlider();
  }, { passive: false });

  var pinchStartDist = 0;
  var pinchStartW = 0;

  cropCanvas.parentElement.addEventListener('touchstart', function(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.hypot(dx, dy);
      pinchStartW = cropBox.w;
    }
  }, { passive: false });

  cropCanvas.parentElement.addEventListener('touchmove', function(e) {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      e.preventDefault();
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      var dist = Math.hypot(dx, dy);
      var scale = dist / pinchStartDist;
      applyCropZoom(pinchStartW * scale);
      syncSlider();
    }
  }, { passive: false });

  cropCanvas.parentElement.addEventListener('touchend', function(e) {
    if (e.touches.length < 2) {
      pinchStartDist = 0;
    }
  });


  // ── Canvas export & upload ─────────────────────────────────────

  function exportCroppedImage(callback) {
    var targetSize = uploadOrientation === 'landscape' ? LANDSCAPE_SIZE : PORTRAIT_SIZE;
    var outCanvas = document.createElement('canvas');
    outCanvas.width = targetSize.w;
    outCanvas.height = targetSize.h;
    var ctx = outCanvas.getContext('2d');

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
      currentSpread = 0;
      renderPage();
      closeModal();
    })
    .catch(function(err) {
      console.error('Card upload error:', err);
      closeModal();
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
  prevBtn.addEventListener('click', function() { navigateBackward(); });
  nextBtn.addEventListener('click', function() { navigateForward(); });

  // Keyboard navigation
  document.addEventListener('keydown', function(e) {
    // Close lightbox on Escape
    if (e.key === 'Escape' && lightboxEl) {
      closeLightbox();
      return;
    }
    if (!modal.hidden) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    // Only handle arrows when cardbook section is in view
    var rect = book.getBoundingClientRect();
    var inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (!inView) return;

    if (e.key === 'ArrowLeft') navigateBackward();
    if (e.key === 'ArrowRight') navigateForward();
  });

  // Touch swipe on book
  var touchStartX = 0;
  var touchStartY = 0;

  book.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  book.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) navigateForward();
      else navigateBackward();
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
      var reader = new FileReader();
      reader.onload = function(ev) {
        cropImg = new Image();
        cropImg.onload = function() {
          showStep('crop');
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

  if (API_BASE) {
    fetchCards().then(function() { renderPage(); });
  } else {
    renderPage();
  }

})();
