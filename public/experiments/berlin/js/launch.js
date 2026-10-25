// Intentionally independent of Three.js and the city data: unsupported devices
// get a useful page without downloading or constructing the simulation.
export function isMobileDevice(nav, coarsePointer = false) {
  return Boolean(nav.userAgentData?.mobile) || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '') ||
    (/Macintosh|MacIntel/i.test(`${nav.userAgent || ''} ${nav.platform || ''}`) && nav.maxTouchPoints > 1) ||
    (coarsePointer && !/Windows|Macintosh|MacIntel|Linux x86_64/i.test(`${nav.userAgent || ''} ${nav.platform || ''}`));
}

export function createLaunchSession({ onFailure, onReady, setTimer = setTimeout, clearTimer = clearTimeout, now = () => performance.now(),
  timeoutMs = 120000 }) {
  let state = 'loading';
  const cleanups = [];
  let remaining = timeoutMs, started = now(), paused = false;
  let timer = setTimer(() => fail('timeout'), timeoutMs);
  function fail(reason = 'load', error) {
    if (state === 'failed') return;
    state = 'failed';
    clearTimer(timer);
    onFailure(reason, error);
    for (const cleanup of cleanups.splice(0)) {
      try { cleanup(); } catch (e) { console.warn('[cleanup]', e); }
    }
  }
  return {
    fail,
    get stopped() { return state === 'failed'; },
    onStop(cleanup) { if (state === 'failed') cleanup(); else cleanups.push(cleanup); },
    setPaused(value) {
      if (state !== 'loading' || paused === value) return;
      paused = value;
      if (paused) { clearTimer(timer); remaining = Math.max(0, remaining - (now() - started)); }
      else { started = now(); timer = setTimer(() => fail('timeout'), remaining); }
    },
    ready() {
      if (state !== 'loading') return false;
      state = 'ready'; clearTimer(timer); onReady(); return true;
    },
    check() { if (state === 'failed') throw new Error('Berlin startup stopped'); }
  };
}

export async function launchBerlin({ nav = navigator, coarsePointer = matchMedia('(pointer: coarse)').matches,
  session, loadApp = () => import('./main.js?v=20261025-nearby3') }) {
  if (isMobileDevice(nav, coarsePointer)) { session.fail('mobile'); return; }
  if (!nav.gpu) { session.fail('unsupported'); return; }
  try {
    const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
    session.check();
    if (!adapter || adapter.isFallbackAdapter || adapter.info?.isFallbackAdapter) {
      session.fail('unsupported'); return;
    }
    // Only now fetch the renderer and map. Import failures are caught here too.
    const { initApp } = await loadApp();
    session.check();
    await initApp(session);
  } catch (error) {
    session.fail('load', error);
  }
}

export function startBerlin(environment = {}) {
  const overlay = document.getElementById('loading-overlay');
  const title = document.getElementById('fallback-title');
  const message = document.getElementById('fallback-message');
  const tip = document.getElementById('fallback-tip');
  const retry = document.getElementById('fallback-retry');
  const session = createLaunchSession({
    onFailure(reason, error) {
      if (error) console.error('[Berlin]', error);
      const mobile = reason === 'mobile';
      document.body.dataset.launchState = 'failed';
      overlay.classList.remove('hidden');
      overlay.classList.add('has-error');
      for (const child of document.body.children) if (child !== overlay) child.inert = true;
      overlay.setAttribute('aria-label', mobile ? 'Please visit on a desktop or laptop' : 'Berlin could not start');
      title.textContent = mobile ? 'Big city. Bigger screen.' : 'A little more horsepower?';
      message.textContent = mobile
        ? 'Sorry, this trip needs a keyboard. Come back on a desktop or laptop and take Berlin for a spin.'
        : reason === 'timeout'
          ? 'Berlin is taking the scenic route. The city took too long to load on this connection or computer.'
          : reason === 'device'
            ? 'Our taxi needs a pit stop. Your computer stopped rendering the city.'
            : 'Berlin has a lot going on. Your browser or computer couldn’t get the city moving this time.';
      tip.textContent = mobile ? 'Your taxi will be waiting.'
        : reason === 'unsupported' ? 'Try a recent Chrome or Edge on a desktop or laptop with graphics acceleration enabled.'
          : 'Try closing a few tabs and giving it another go. A more powerful computer may help, too.';
      retry.hidden = mobile;
      title.focus({ preventScroll: true });
    },
    onReady() {
      document.body.dataset.launchState = 'ready';
      overlay.classList.add('hidden');
    }
  });
  // Asynchronous renderer faults can otherwise leave a frozen canvas forever.
  window.addEventListener('error', event => {
    if (event.error && /\/experiments\/berlin\//.test(event.filename || '')) session.fail('load', event.error);
  });
  session.setPaused(document.hidden);
  document.addEventListener('visibilitychange', () => session.setPaused(document.hidden));
  launchBerlin({ ...environment, session });
  return session;
}
