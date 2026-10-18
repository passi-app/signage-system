/**
 * PubScreen - Digital Signage Engine
 * Serverless Headless CMS Player & Offline Controller
 */

(function () {
  'use strict';

  // --- Configuration Constants ---
  const POLL_INTERVAL_MS = 5 * 60 * 1000;         // Poll media-list.json every 5 minutes
  const SPONSOR_CYCLE_MS = 10 * 1000;             // Cycle sponsor logos every 10 seconds
  const MAX_VIDEO_DURATION_MS = 30 * 60 * 1000;   // Force-switch video after 30 minutes
  const VIDEO_BASE_PATH = '../videos/';
  const SPONSOR_BASE_PATH = '../sponsors/';

  // --- State Variables ---
  let playlist = [];
  let currentVideoIndex = 0;
  let sponsorList = [];
  let currentSponsorIndex = 0;
  let maxDurationTimer = null;
  let sponsorCycleInterval = null;
  let sponsorProgressAnimation = null;
  let isMediaListLoaded = false;

  // Double-buffering video elements for zero-flicker crossfading
  const videoA = document.getElementById('bg-video-a');
  const videoB = document.getElementById('bg-video-b');
  let activeVideoEl = videoA;
  let inactiveVideoEl = videoB;

  // DOM Elements
  const sponsorImg = document.getElementById('sponsor-logo-img');
  const sponsorEmptyState = document.getElementById('sponsor-empty-state');
  const sponsorProgressBar = document.getElementById('sponsor-progress-fill');
  const clockTimeEl = document.getElementById('live-clock');
  const clockDateEl = document.getElementById('live-date');
  const networkToast = document.getElementById('network-status');
  const networkStatusText = document.getElementById('status-text');

  // =========================================================================
  // 1. INITIALIZATION
  // =========================================================================
  async function init() {
    console.log('[PubScreen] Booting digital signage player...');

    // Start live clock
    initClock();

    // Setup network status listeners
    initNetworkMonitoring();

    // Register Service Worker for offline resilience
    registerServiceWorker();

    // Initial fetch of media list
    await fetchMediaList();

    // Start 5-minute polling loop for repo CMS updates
    setInterval(fetchMediaList, POLL_INTERVAL_MS);

    // Setup interaction listener to enable audio/cursor debug if ever needed
    window.addEventListener('mousemove', () => {
      document.body.classList.add('show-cursor');
      clearTimeout(window.__cursorTimer);
      window.__cursorTimer = setTimeout(() => {
        document.body.classList.remove('show-cursor');
      }, 3000);
    });
  }

  // =========================================================================
  // 2. HEADLESS CMS FETCH & POLLING (media-list.json)
  // =========================================================================
  async function fetchMediaList() {
    // Cache-busting query parameter ensures latest commit from GitHub Pages
    const cacheBuster = `?_ts=${Date.now()}`;
    const candidates = [`media-list.json${cacheBuster}`, `../media-list.json${cacheBuster}`];

    let data = null;

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          data = await response.json();
          break;
        }
      } catch (err) {
        // Continue to candidate fallback
      }
    }

    if (data && (Array.isArray(data.videos) || Array.isArray(data.sponsors))) {
      console.log('[PubScreen] media-list.json loaded:', data);
      handleMediaListUpdate(data);
    } else if (!isMediaListLoaded) {
      console.warn('[PubScreen] media-list.json unavailable, loading default fallback demo items.');
      handleMediaListUpdate({
        videos: ['promo_passi.mp4', 'lagora_ambiance.mp4'],
        sponsors: ['sponsor1.png']
      });
    }
  }

  function handleMediaListUpdate(data) {
    const newVideos = Array.isArray(data.videos) ? data.videos : [];
    const newSponsors = Array.isArray(data.sponsors) ? data.sponsors : [];

    const videosChanged = JSON.stringify(playlist) !== JSON.stringify(newVideos);
    const sponsorsChanged = JSON.stringify(sponsorList) !== JSON.stringify(newSponsors);

    if (videosChanged) {
      console.log('[PubScreen] Video playlist updated:', newVideos);
      playlist = newVideos;
      // If player wasn't started yet, launch first video
      if (!isMediaListLoaded && playlist.length > 0) {
        currentVideoIndex = 0;
        playVideoByIndex(currentVideoIndex);
      }
    }

    if (sponsorsChanged) {
      console.log('[PubScreen] Sponsor list updated:', newSponsors);
      sponsorList = newSponsors;
      currentSponsorIndex = 0;
      startSponsorRotation();
    }

    isMediaListLoaded = true;
  }

  // =========================================================================
  // 3. VIDEO ENGINE (Playback, 30-min Safety Switch, Seamless Loop)
  // =========================================================================
  function playVideoByIndex(index) {
    if (!playlist || playlist.length === 0) {
      console.warn('[PubScreen] No videos in playlist.');
      return;
    }

    // Clear existing 30-minute safety timeout
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }

    const videoFilename = playlist[index];
    const videoSrc = `${VIDEO_BASE_PATH}${encodeURIComponent(videoFilename)}`;

    console.log(`[PubScreen] Playing video [${index + 1}/${playlist.length}]: ${videoFilename}`);

    // Preload next candidate on inactive video element
    const nextVideoEl = inactiveVideoEl;
    const currentVideoEl = activeVideoEl;

    // Reset handlers
    nextVideoEl.onended = null;
    nextVideoEl.onerror = null;

    nextVideoEl.src = videoSrc;
    nextVideoEl.load();

    const startPlayback = () => {
      nextVideoEl.play()
        .then(() => {
          // Crossfade: bring next video forward, fade out previous
          nextVideoEl.classList.add('is-active');
          currentVideoEl.classList.remove('is-active');

          setTimeout(() => {
            currentVideoEl.pause();
          }, 800);

          // Swap active / inactive references
          activeVideoEl = nextVideoEl;
          inactiveVideoEl = currentVideoEl;

          // Attach ended listener to advance to next
          activeVideoEl.onended = () => {
            console.log('[PubScreen] Video finished naturally.');
            advanceVideo();
          };

          // 30-minute maximum duration watchdog
          maxDurationTimer = setTimeout(() => {
            console.warn('[PubScreen] 30 minutes elapsed on single video. Forcing advance.');
            advanceVideo();
          }, MAX_VIDEO_DURATION_MS);
        })
        .catch((playErr) => {
          console.warn('[PubScreen] Autoplay failed or blocked:', playErr);
          // Retry or advance
          setTimeout(advanceVideo, 2000);
        });
    };

    // When media is ready to render
    nextVideoEl.oncanplay = function () {
      nextVideoEl.oncanplay = null;
      startPlayback();
    };

    // Error handling (e.g. 404, unsupported codec)
    nextVideoEl.onerror = function (e) {
      console.error(`[PubScreen] Error loading video "${videoFilename}":`, e);
      // Advance to next video after short delay so we never get stuck
      setTimeout(advanceVideo, 2000);
    };
  }

  function advanceVideo() {
    if (playlist.length === 0) return;
    currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
    playVideoByIndex(currentVideoIndex);
  }

  // Backup watchdog for timeupdate checking (e.g. video loops or stalled events)
  [videoA, videoB].forEach((vid) => {
    vid.addEventListener('timeupdate', () => {
      if (vid === activeVideoEl && vid.currentTime >= 1800) { // 1800 seconds = 30 minutes
        console.warn('[PubScreen] Video reached 1800s. Advancing.');
        advanceVideo();
      }
    });
  });

  // =========================================================================
  // 4. SPONSOR ROTATION ENGINE (10-second crossfade cycle)
  // =========================================================================
  function startSponsorRotation() {
    if (sponsorCycleInterval) {
      clearInterval(sponsorCycleInterval);
      sponsorCycleInterval = null;
    }

    if (!sponsorList || sponsorList.length === 0) {
      if (sponsorImg) sponsorImg.style.display = 'none';
      if (sponsorEmptyState) sponsorEmptyState.style.display = 'block';
      if (sponsorProgressBar) sponsorProgressBar.style.width = '0%';
      return;
    }

    if (sponsorEmptyState) sponsorEmptyState.style.display = 'none';
    if (sponsorImg) sponsorImg.style.display = 'block';

    // Show initial sponsor
    showSponsor(currentSponsorIndex);

    // If only one sponsor, display continuously without fading
    if (sponsorList.length === 1) {
      if (sponsorProgressBar) sponsorProgressBar.style.width = '100%';
      return;
    }

    // Animate progress bar across 10 seconds
    animateSponsorProgressBar();

    // Cycle every 10 seconds
    sponsorCycleInterval = setInterval(() => {
      currentSponsorIndex = (currentSponsorIndex + 1) % sponsorList.length;
      showSponsor(currentSponsorIndex);
      animateSponsorProgressBar();
    }, SPONSOR_CYCLE_MS);
  }

  function showSponsor(index) {
    if (!sponsorList[index] || !sponsorImg) return;

    const sponsorFilename = sponsorList[index];
    const targetSrc = `${SPONSOR_BASE_PATH}${encodeURIComponent(sponsorFilename)}`;

    // Fade out current logo
    sponsorImg.classList.remove('fade-in');
    sponsorImg.classList.add('fade-out');

    setTimeout(() => {
      sponsorImg.src = targetSrc;
      sponsorImg.alt = `Sponsor: ${sponsorFilename}`;

      sponsorImg.onload = () => {
        sponsorImg.classList.remove('fade-out');
        sponsorImg.classList.add('fade-in');
      };

      sponsorImg.onerror = () => {
        console.warn(`[PubScreen] Failed to load sponsor logo: ${targetSrc}`);
        sponsorImg.classList.remove('fade-out');
        sponsorImg.classList.add('fade-in');
      };
    }, 400);
  }

  function animateSponsorProgressBar() {
    if (!sponsorProgressBar) return;
    if (sponsorProgressAnimation) cancelAnimationFrame(sponsorProgressAnimation);

    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / SPONSOR_CYCLE_MS, 1);
      sponsorProgressBar.style.width = `${progress * 100}%`;

      if (progress < 1) {
        sponsorProgressAnimation = requestAnimationFrame(step);
      }
    }
    sponsorProgressAnimation = requestAnimationFrame(step);
  }

  // =========================================================================
  // 5. SERVICE WORKER REGISTRATION (Offline Resilience)
  // =========================================================================
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('[PubScreen] Service Worker registered with scope:', registration.scope);

            // Listen for waiting workers and trigger update
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PubScreen] New content available; please refresh or auto-reload.');
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.error('[PubScreen] Service Worker registration failed:', error);
          });
      });
    }
  }

  // =========================================================================
  // 6. UTILITIES: REAL-TIME CLOCK & NETWORK STATUS
  // =========================================================================
  function initClock() {
    function update() {
      const now = new Date();
      if (clockTimeEl) {
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        clockTimeEl.textContent = `${hours}:${minutes}`;
      }
      if (clockDateEl) {
        const options = { weekday: 'short', day: 'numeric', month: 'short' };
        clockDateEl.textContent = now.toLocaleDateString('fr-FR', options);
      }
    }
    update();
    setInterval(update, 1000);
  }

  function initNetworkMonitoring() {
    function updateStatus(isOnline) {
      if (!networkToast || !networkStatusText) return;

      if (!isOnline) {
        networkToast.classList.add('is-offline', 'visible');
        networkStatusText.textContent = 'Mode Hors-ligne (Actif)';
      } else {
        networkToast.classList.remove('is-offline');
        networkStatusText.textContent = 'Connexion rétablie';
        networkToast.classList.add('visible');
        setTimeout(() => {
          networkToast.classList.remove('visible');
        }, 4000);
      }
    }

    window.addEventListener('online', () => updateStatus(true));
    window.addEventListener('offline', () => updateStatus(false));

    if (!navigator.onLine) {
      updateStatus(false);
    }
  }

  // Start app when DOM is parsed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
