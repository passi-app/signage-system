/**
 * PubScreen - Digital Signage Engine
 * Serverless Headless CMS Player & Offline Controller
 */

(function () {
  'use strict';

  // --- Configuration Constants ---
  const POLL_INTERVAL_MS = 5 * 60 * 1000;         // Poll media-list.json every 5 minutes
  const SPONSOR_CYCLE_MS = 10 * 1000;             // Cycle sponsor logos every 10 seconds
  // Configuration: 30 minutes repeated playback per video (configurable via ?duration=30, ?slot_minutes=30 or in media-list.json)
  const urlParams = new URLSearchParams(window.location.search);

  function parseDurationMinutes(val, fallback = 30) {
    if (val === undefined || val === null || val === '') return fallback;
    const str = String(val).trim().toLowerCase();
    if (str.endsWith('ms')) {
      const ms = parseFloat(str);
      return !isNaN(ms) && ms > 0 ? ms / 60000 : fallback;
    }
    if (str.endsWith('s') || str.endsWith('sec')) {
      const s = parseFloat(str);
      return !isNaN(s) && s > 0 ? s / 60 : fallback;
    }
    if (str.endsWith('h') || str.endsWith('hr') || str.endsWith('hour') || str.endsWith('heures')) {
      const h = parseFloat(str);
      return !isNaN(h) && h > 0 ? h * 60 : fallback;
    }
    const num = parseFloat(str);
    return !isNaN(num) && num > 0 ? num : fallback;
  }

  const rawUrlDuration = urlParams.get('duration') ||
                         urlParams.get('slot_minutes') ||
                         urlParams.get('duration_min') ||
                         urlParams.get('duration_minutes') ||
                         urlParams.get('video_duration') ||
                         urlParams.get('slot');

  const hasUrlDurationOverride = rawUrlDuration !== null && rawUrlDuration !== undefined;
  let videoSlotMinutes = parseDurationMinutes(rawUrlDuration, 30);
  let VIDEO_SLOT_DURATION_MS = videoSlotMinutes * 60 * 1000;
  let VIDEO_BASE_PATH = 'videos/';
  let SPONSOR_BASE_PATH = 'sponsors/';

  // --- State Variables ---
  let playlist = [];
  let currentVideoIndex = 0;
  let sponsorList = [];
  let currentSponsorIndex = 0;
  let maxDurationTimer = null;
  let videoSlotStartTime = 0;
  let sponsorCycleInterval = null;
  let sponsorProgressAnimation = null;
  let isMediaListLoaded = false;

  // Audio preference state: query flag (?sound=1 or ?audio=1) or user gesture toggle
  let isAudioEnabled = urlParams.get('sound') === '1' || urlParams.get('audio') === '1';

  // Double-buffering video elements for zero-flicker crossfading
  const videoA = document.getElementById('bg-video-a');
  const videoB = document.getElementById('bg-video-b');
  let activeVideoEl = videoA;
  let inactiveVideoEl = videoB;

  // DOM Elements
  const sponsorMarqueeTrack = document.getElementById('sponsor-marquee-track');
  const clockTimeEl = document.getElementById('live-clock');
  const clockDateEl = document.getElementById('live-date');
  const networkToast = document.getElementById('network-status');
  const networkStatusText = document.getElementById('status-text');

  // =========================================================================
  // 1. INITIALIZATION
  // =========================================================================
  async function init() {
    console.log('[PubScreen] Booting digital signage player...');

    // Prep video elements for kiosk autoplay
    [videoA, videoB].forEach((vid) => {
      if (!vid) return;
      vid.muted = !isAudioEnabled;
      vid.defaultMuted = !isAudioEnabled;
      vid.playsInline = true;
      if (!isAudioEnabled) {
        vid.setAttribute('muted', '');
      } else {
        vid.removeAttribute('muted');
        vid.volume = 1.0;
      }
      vid.setAttribute('playsinline', '');
    });

    // Start live clock
    initClock();

    // Start audio controls
    initAudioControls();

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
        videos: ['1020(1).mp4'],
        sponsors: ['sponsor2.png', 'sponsor1.png']
      });
    }
  }

  function handleMediaListUpdate(data) {
    if (!hasUrlDurationOverride && data) {
      const configDuration = data.videoDurationMinutes !== undefined ? data.videoDurationMinutes :
                             data.videoSlotMinutes !== undefined ? data.videoSlotMinutes :
                             data.slot_minutes !== undefined ? data.slot_minutes :
                             data.duration_min !== undefined ? data.duration_min :
                             data.duration;
      if (configDuration !== undefined && configDuration !== null) {
        const parsed = parseDurationMinutes(configDuration, 30);
        if (parsed !== videoSlotMinutes) {
          videoSlotMinutes = parsed;
          VIDEO_SLOT_DURATION_MS = videoSlotMinutes * 60 * 1000;
          console.log(`[PubScreen] Video duration updated from media-list.json: ${videoSlotMinutes} minutes`);
        }
      }
    }

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

    // Clear existing duration slot timeout
    if (maxDurationTimer) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }

    // Start timer for this video slot
    videoSlotStartTime = Date.now();

    const videoFilename = playlist[index];
    const videoSrc = `${VIDEO_BASE_PATH}${encodeURIComponent(videoFilename)}`;

    console.log(`[PubScreen] Playing video [${index + 1}/${playlist.length}]: ${videoFilename} (Repeats for ${videoSlotMinutes} minutes)`);

    // Preload next candidate on inactive video element
    const nextVideoEl = inactiveVideoEl;
    const currentVideoEl = activeVideoEl;

    // Reset handlers
    nextVideoEl.onended = null;
    nextVideoEl.onerror = null;
    nextVideoEl.oncanplay = null;
    nextVideoEl.onloadeddata = null;

    // Set audio state based on current preference
    nextVideoEl.muted = !isAudioEnabled;
    nextVideoEl.defaultMuted = !isAudioEnabled;
    nextVideoEl.playsInline = true;
    if (isAudioEnabled) {
      nextVideoEl.removeAttribute('muted');
      nextVideoEl.volume = 1.0;
    } else {
      nextVideoEl.setAttribute('muted', '');
    }

    let hasStarted = false;

    const startPlayback = () => {
      if (hasStarted) return;
      hasStarted = true;

      // Bring next video forward, fade out previous
      nextVideoEl.classList.add('is-active');

      const playPromise = nextVideoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[PubScreen] Video playback started: ${videoFilename}`);
            const fallbackEl = document.getElementById('video-fallback');
            if (fallbackEl) {
              fallbackEl.classList.add('is-hidden');
            }
            setTimeout(() => {
              if (currentVideoEl !== nextVideoEl) {
                currentVideoEl.pause();
                currentVideoEl.classList.remove('is-active');
              }
            }, 800);

            // Swap active / inactive references
            activeVideoEl = nextVideoEl;
            inactiveVideoEl = currentVideoEl;

            // Attach ended listener to repeat video until slot duration (30 min default) has elapsed
            activeVideoEl.onended = () => {
              const elapsed = Date.now() - videoSlotStartTime;
              if (elapsed < VIDEO_SLOT_DURATION_MS) {
                const elapsedMin = (elapsed / 60000).toFixed(1);
                const totalMin = (VIDEO_SLOT_DURATION_MS / 60000).toFixed(0);
                console.log(`[PubScreen] Video finished (${elapsedMin}m / ${totalMin}m elapsed in current slot). Repeating video.`);
                activeVideoEl.currentTime = 0;
                activeVideoEl.play().catch((replayErr) => {
                  console.warn('[PubScreen] Replay interrupted, advancing to next video:', replayErr);
                  advanceVideo();
                });
              } else {
                console.log(`[PubScreen] ${videoSlotMinutes} minutes elapsed for this video slot. Advancing to next video.`);
                advanceVideo();
              }
            };

            // Watchdog: advance after slot duration completes
            const remainingSlotTime = Math.max(0, VIDEO_SLOT_DURATION_MS - (Date.now() - videoSlotStartTime));
            maxDurationTimer = setTimeout(() => {
              console.log(`[PubScreen] ${videoSlotMinutes}-minute slot completed. Advancing to next video.`);
              advanceVideo();
            }, remainingSlotTime);
          })
          .catch((playErr) => {
            console.warn('[PubScreen] Autoplay failed or requires interaction:', playErr);
            // If play was rejected due to unmuted autoplay policy, fall back to muted and prompt for gesture
            if (isAudioEnabled) {
              console.log('[PubScreen] Falling back to muted autoplay until user gesture.');
              setAudioState(false);
              nextVideoEl.muted = true;
              nextVideoEl.setAttribute('muted', '');
              nextVideoEl.play().catch(console.warn);
            }

            activeVideoEl = nextVideoEl;
            inactiveVideoEl = currentVideoEl;

            const resumeOnInteraction = () => {
              if (!isAudioEnabled) {
                setAudioState(true);
              }
              nextVideoEl.play().catch(console.warn);
              window.removeEventListener('click', resumeOnInteraction);
              window.removeEventListener('touchstart', resumeOnInteraction);
              window.removeEventListener('keydown', resumeOnInteraction);
            };
            window.addEventListener('click', resumeOnInteraction);
            window.addEventListener('touchstart', resumeOnInteraction);
            window.addEventListener('keydown', resumeOnInteraction);
          });
      }
    };

    nextVideoEl.src = videoSrc;
    nextVideoEl.load();

    // Check if media is already loaded in cache
    if (nextVideoEl.readyState >= 2) {
      startPlayback();
    } else {
      nextVideoEl.oncanplay = startPlayback;
      nextVideoEl.onloadeddata = startPlayback;
    }

    let hasTriedFallback = false;
    // Error handling with alternative path fallback (e.g. videos/ vs ../videos/)
    nextVideoEl.onerror = function (e) {
      console.error(`[PubScreen] Error loading video "${videoFilename}":`, e);
      if (!hasTriedFallback) {
        hasTriedFallback = true;
        VIDEO_BASE_PATH = VIDEO_BASE_PATH.startsWith('../') ? 'videos/' : '../videos/';
        nextVideoEl.src = `${VIDEO_BASE_PATH}${encodeURIComponent(videoFilename)}`;
        console.log(`[PubScreen] Retrying video with path: ${nextVideoEl.src}`);
        nextVideoEl.load();
        return;
      }
      setTimeout(advanceVideo, 3000);
    };
  }

  function advanceVideo() {
    if (playlist.length === 0) return;
    currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
    playVideoByIndex(currentVideoIndex);
  }

  // Safety watchdog if a video runs continuously without ended event
  [videoA, videoB].forEach((vid) => {
    vid.addEventListener('timeupdate', () => {
      if (vid === activeVideoEl) {
        const elapsed = Date.now() - videoSlotStartTime;
        if (elapsed >= VIDEO_SLOT_DURATION_MS + 5000) { // slot duration + 5s buffer
          console.warn(`[PubScreen] ${videoSlotMinutes}-minute slot duration exceeded in watchdog. Advancing.`);
          advanceVideo();
        }
      }
    });
  });

  // =========================================================================
  // 4. SPONSOR MARQUEE ENGINE (Continuous Full-Width Ribbon)
  // =========================================================================
  function startSponsorRotation() {
    renderSponsorsMarquee(sponsorList);
  }

  function renderSponsorsMarquee(sponsors) {
    if (!sponsorMarqueeTrack) return;

    if (!sponsors || sponsors.length === 0) {
      sponsorMarqueeTrack.innerHTML = '';
      return;
    }

    // Build a repeating list of at least 8 items so the track covers the full bar width
    let items = [...sponsors];
    while (items.length < 8) {
      items = items.concat(sponsors);
    }

    // Duplicate list twice for seamless 0% to -50% infinite CSS marquee loop
    const fullList = [...items, ...items];

    sponsorMarqueeTrack.innerHTML = fullList.map((filename, idx) => `
      <div class="sponsor-card" data-idx="${idx}">
        <img
          src="${SPONSOR_BASE_PATH}${encodeURIComponent(filename)}?_v=real"
          alt="Sponsor ${filename}"
          class="sponsor-card-img"
          loading="eager"
          onerror="if(!this.getAttribute('data-err')){this.setAttribute('data-err','1');this.src='../sponsors/${encodeURIComponent(filename)}?_v=real';}">
      </div>
    `).join('');
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

  // =========================================================================
  // 7. AUDIO CONTROLLER & UNMUTE SYSTEM
  // =========================================================================
  function updateAudioUI() {
    const audioBtn = document.getElementById('audio-toggle');
    const audioIcon = document.getElementById('audio-icon');
    const audioLabel = document.getElementById('audio-label');
    if (!audioBtn) return;

    if (isAudioEnabled) {
      audioBtn.classList.add('is-active');
      if (audioIcon) audioIcon.textContent = '🔊';
      if (audioLabel) audioLabel.textContent = 'Son activé';
      audioBtn.title = 'Son activé (cliquer pour couper)';
    } else {
      audioBtn.classList.remove('is-active');
      if (audioIcon) audioIcon.textContent = '🔇';
      if (audioLabel) audioLabel.textContent = 'Son coupé';
      audioBtn.title = 'Cliquer pour activer le son';
    }
  }

  function setAudioState(enabled) {
    isAudioEnabled = enabled;
    [videoA, videoB].forEach((vid) => {
      if (!vid) return;
      vid.muted = !enabled;
      if (enabled) {
        vid.removeAttribute('muted');
        vid.volume = 1.0;
        // If active video is paused or suspended, resume it
        if (vid.paused && vid.classList.contains('is-active')) {
          vid.play().catch(console.warn);
        }
      } else {
        vid.setAttribute('muted', '');
      }
    });
    updateAudioUI();
    console.log(`[PubScreen] Audio state set to: ${enabled ? 'UNMUTED (Sound ON)' : 'MUTED (Sound OFF)'}`);
  }

  function initAudioControls() {
    updateAudioUI();

    const audioBtn = document.getElementById('audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setAudioState(!isAudioEnabled);
      });
    }

    // Unmute on the first user interaction anywhere on the screen (unless clicking a link)
    const onFirstUserGesture = (e) => {
      if (e.target.closest('a') || e.target.closest('#audio-toggle')) return;
      if (!isAudioEnabled) {
        console.log('[PubScreen] User interaction detected. Unmuting player sound.');
        setAudioState(true);
      }
    };

    window.addEventListener('click', onFirstUserGesture);
    window.addEventListener('touchstart', onFirstUserGesture);

    // Keyboard shortcut: 'm' or 'M' to toggle mute
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') {
        setAudioState(!isAudioEnabled);
      }
    });
  }

  // Start app when DOM is parsed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
