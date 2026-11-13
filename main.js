(() => {
  const $ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const root = document.documentElement;

  // A short terminal-like flourish on the wordmark; never changes its accessible name.
  $('[data-scramble]').forEach((label) => {
    const original = label.textContent;
    const trigger = label.closest('a');
    let timer = 0;
    const restore = () => { clearTimeout(timer); label.textContent = original; };
    const play = () => {
      restore();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const start = performance.now();
      const glyphs = ';!<>/{}';
      const tick = () => {
        const progress = clamp((performance.now() - start) / 360);
        label.textContent = [...original].map((c, i) => c === ' ' || i < progress * original.length ? c : glyphs[Math.floor(Math.random() * glyphs.length)]).join('');
        if (progress < 1) timer = setTimeout(tick, 45);
        else restore();
      };
      tick();
    };
    trigger.addEventListener('pointerenter', play);
    trigger.addEventListener('focus', play);
    trigger.addEventListener('pointerleave', restore);
    trigger.addEventListener('blur', restore);
  });

  // Isolate the existing arrow so hover feedback does not move the whole label.
  $('.cta, .ct-links a').forEach((link) => {
    if (link.querySelector('span')) return;
    const match = link.textContent.match(/^(.*?)([↗↘↓])\s*$/);
    if (!match) return;
    link.textContent = match[1];
    const arrow = document.createElement('span');
    arrow.className = 'link-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = match[2];
    link.append(arrow);
  });

  /* ---- menu ---- */
  const burger = document.querySelector('.burger');
  const setMenu = (open) => {
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.firstElementChild.textContent = open ? 'Close' : 'Menu';
    document.getElementById('world').inert = open;
    if (open) document.querySelector('#menu a').focus();
    else burger.focus({ preventScroll: true });
  };
  burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  $('#menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !root.classList.contains('menu-open')) return;
    const items = [burger, ...$('#menu a')];
    const index = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
  });

  /* ---- copy email ---- */
  $('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('.mono');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        label.textContent = 'Copied';
        setTimeout(() => (label.textContent = 'Copy email'), 1600);
      } catch {
        location.href = 'mailto:' + btn.dataset.copy; // clipboard blocked (e.g. insecure context)
      }
    });
  });

  // Reduced motion: stop here and leave the plain stacked page.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* =====================================================================
     3D scene. Every .st is a plane parked at depth j*GAP. Scrolling flies
     a camera from plane to plane; a blue line is drawn ahead of it.
     ===================================================================== */
  root.classList.add('three');
  const P = 1100;          // perspective distance (px) — shared by CSS planes and the canvas line
  const GAP = 2200;        // depth between stations
  const TRAVEL = 0.62;     // shorter transitions between content-rich stations
  const POS = [[0, 0], [0.7, 0.3], [-0.6, 0.45], [0.55, -0.35], [-0.7, -0.25]]; // station x,y in viewport units

  const world = document.getElementById('world');
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const spacer = document.getElementById('spacer');
  const stN = document.getElementById('st-n'), stL = document.getElementById('st-l');
  const stars = Array.from({ length: 80 }, () => [Math.random() * 3 - 1.5, Math.random() * 3 - 1.5, Math.random()]);
  world.style.perspective = P + 'px';

  /* split .fill headings into letters; they start outlined and fill on arrival */
  const WALKER = '<svg class="walker" viewBox="0 0 24 40" aria-hidden="true"><circle cx="12" cy="5" r="4.5"/><path d="M12 10v14"/><path class="arm" d="M12 13l7 7"/><path class="leg l" d="M12 24v15"/><path class="leg r" d="M12 24v15"/></svg>';
  const splitFill = (el) => {
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    const chars = [];
    const lines = $('.ln', el);
    (lines.length ? lines : [el]).forEach((ln) => {
      const words = ln.textContent.trim().split(/\s+/);
      ln.textContent = '';
      words.forEach((word, wi) => {
        const w = document.createElement('span');
        w.className = 'w';
        w.setAttribute('aria-hidden', 'true');
        for (const c of word) {
          const ch = document.createElement('span');
          ch.className = 'ch';
          ch.style.setProperty('--i', chars.length);
          ch.textContent = c;
          w.append(ch);
          chars.push(ch);
        }
        ln.append(w);
        if (wi < words.length - 1) ln.append(' ');
      });
    });
    let walker = null;
    if (el.classList.contains('walk')) {
      el.insertAdjacentHTML('beforeend', WALKER);
      walker = el.lastElementChild;
    }
    return { chars, walker, on: -1 };
  };

  const sts = $('.st').map((el, j) => ({
    el, j,
    hold: +el.dataset.hold || 0.5,
    a: (el.dataset.a || '0,.38').split(',').map(Number),
    fills: $('.fill', el).map(splitFill),
    counts: $('[data-count]', el),
    counted: false,
  }));
  const N = sts.length;

  const countUp = (el) => {
    const end = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0;
    const t0 = performance.now();
    const tick = (t) => {
      const k = clamp((t - t0) / 1400);
      el.textContent = (end * (1 - Math.pow(1 - k, 3))).toFixed(dec);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---- layout: world positions, scroll stops, line anchors ---- */
  let W = 0, H = 0, travelPx = 0, total = 1, anchors = [];
  const layout = () => {
    W = innerWidth; H = innerHeight;
    travelPx = TRAVEL * H;
    let at = 0;
    sts.forEach((o, j) => {
      const [px, py] = j ? POS[1 + (j - 1) % (POS.length - 1)] : POS[0];
      o.x = px * W; o.y = py * H;
      o.side = j ? Math.sign(o.x - sts[j - 1].x) || 1 : 1;
      o.fit = Math.min(1, Math.max(240, H - 160) / o.el.offsetHeight, (W - 112) / o.el.scrollWidth);
      if (j) at += travelPx;
      o.arr = at;                 // scroll position where the camera arrives
      o.holdPx = o.hold * H;      // scroll spent parked on it
      at += o.holdPx;
    });
    total = at;
    spacer.style.height = total + H + 'px';
    anchors = sts.map((o) => [o.x + o.a[0] * Math.min(W, 1240), o.y + o.a[1] * H, o.j * GAP]);
    anchors.unshift([-0.52 * Math.min(W, 1240), 0.36 * H, -GAP * 0.12]); // lead-in so the line sweeps under the name
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /* Catmull-Rom through the anchors, u = station index (float) */
  const lineAt = (u) => {
    u += 1; // anchors[0] is the lead-in point
    const i = clamp(Math.floor(u), 0, N), f = u - i;
    const p1 = anchors[i], p2 = anchors[i + 1] || p1, p0 = anchors[i - 1] || p1, p3 = anchors[i + 2] || p2;
    return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * f
      + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f
      + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * f * f * f));
  };

  /* ---- render one frame for smoothed scroll position s ---- */
  let current = -1;
  const render = (s) => {
    if (innerWidth <= 820 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.remove('dark');
      return;
    }
    let i = 0;
    while (i < N - 1 && s >= sts[i + 1].arr) i++;
    const st = sts[i];
    let u, head;
    if (i === N - 1 || s < st.arr + st.holdPx) {            // stay still while content is being read
      u = i;
      head = i;
    } else {                                                // flying to the next station
      const t = (s - st.arr - st.holdPx) / travelPx;
      u = i + ease(t);
      head = Math.max(u, i + ease(clamp(t * 1.7)));        // the line gets there first
    }
    const k = Math.min(Math.floor(u), N - 1), f = u - k, nx = sts[Math.min(k + 1, N - 1)];
    const cx = lerp(sts[k].x, nx.x, f), cy = lerp(sts[k].y, nx.y, f), d = u * GAP;

    sts.forEach((o) => {
      const ze = d - o.j * GAP;                             // + means the plane is between its spot and the eye
      const a = clamp(1 + ze / GAP);                        // approach: 0 a full gap away, 1 arrived
      const op = ze > 0 ? clamp(1 - ze / 180) : clamp((a - 0.12) / 0.4);
      const es = o.el.style;
      if (op <= 0) { es.visibility = 'hidden'; o.el.classList.remove('live'); return; }
      const tilt = 1 - a;
      es.visibility = 'visible';
      es.setProperty('--o', op.toFixed(3));
      es.setProperty('--k', tilt.toFixed(3));
      es.transform = `translate(-50%,-50%) translate3d(${o.x - cx}px,${o.y - cy}px,${Math.min(ze, 0)}px) rotateY(${tilt * o.side * 22}deg) rotateX(${tilt * 8}deg) scale(${o.fit})`;
      o.el.classList.toggle('live', Math.abs(ze) < 260);

      const fl = clamp((a - 0.45) / 0.5);
      o.fills.forEach((F) => {
        const n = Math.round(fl * F.chars.length);
        if (n === F.on) return;
        F.on = n;
        F.chars.forEach((ch, idx) => ch.classList.toggle('on', idx < n));
        if (F.walker) {
          const ch = F.chars[Math.max(0, n - 1)];
          F.walker.style.transform = `translate(${ch.offsetLeft + (n ? ch.offsetWidth : 0) - F.walker.clientWidth / 2}px,${ch.offsetTop - F.walker.clientHeight * 0.9}px)`;
          F.walker.classList.toggle('go', n > 0 && n < F.chars.length);
        }
      });
    });

    const cur = Math.round(u);
    if (cur !== current) {
      current = cur;
      const o = sts[cur];
      stN.textContent = o.el.dataset.n;
      stL.textContent = o.el.dataset.label;
      root.classList.toggle('dark', 'dark' in o.el.dataset);
      if (!o.counted) { o.counted = true; o.counts.forEach(countUp); }
    }
    root.style.setProperty('--pg', clamp(s / total).toFixed(4));

    /* the line: same projection as the CSS planes, drawn segment by segment so width follows depth */
    ctx.clearRect(0, 0, W, H);
    const dark = root.classList.contains('dark');
    if (dark) {                                             // stars drift past in the dark stations
      ctx.fillStyle = '#ECEAE2';
      stars.forEach(([sx, sy, sz]) => {
        const ze = (((d - sz * GAP) % GAP) + GAP) % GAP - GAP + P * 0.7;
        const sc = P / (P - ze);
        ctx.globalAlpha = clamp(1 + ze / GAP) * 0.7;
        ctx.beginPath(); ctx.arc(W / 2 + sx * W * sc, H / 2 + sy * H * sc, clamp(1.1 * sc, 0.5, 4), 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = ctx.fillStyle = dark ? '#6f7dff' : '#2234E0';
    ctx.lineCap = 'round';
    const project = (q) => {
      const [x, y, z] = lineAt(q), ze = d - z;
      if (ze > P * 0.9) return null;                        // behind the eye
      const sc = P / (P - ze);
      return [W / 2 + (x - cx) * sc, H / 2 + (y - cy) * sc, sc];
    };
    let prev = null;
    const from = Math.max(-1, u - 0.6), steps = Math.max(1, Math.ceil((head - from) * 40));
    for (let n = 0; n <= steps; n++) {
      const pt = project(lerp(from, head, n / steps));
      if (pt && prev) {
        ctx.lineWidth = clamp(2.4 * (pt[2] + prev[2]) / 2, 0.8, 9);
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
      }
      prev = pt;
    }
    if (prev) {
      const r = clamp(5 * prev[2], 2.5, 14);
      ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.arc(prev[0], prev[1], r * 2.2, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(prev[0], prev[1], r, 0, 7); ctx.fill();
    }
  };

  /* ---- smoothed scroll loop: the camera eases toward the real scroll position ---- */
  let s = scrollY, raf = 0, previousFrame = 0;
  const frame = (time) => {
    const delta = previousFrame ? Math.min(time - previousFrame, 50) : 1000 / 60;
    previousFrame = time;
    // Time-based damping feels the same at 60, 120 and 144 Hz.
    s += (scrollY - s) * (1 - Math.exp(-delta / 150));
    if (Math.abs(scrollY - s) < 0.1) s = scrollY;
    render(s);
    raf = s === scrollY ? 0 : requestAnimationFrame(frame);
    if (!raf) previousFrame = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('scroll', kick, { passive: true });

  let lastW = 0, lastH = 0;
  const relayout = () => {
    // phones fire resize when the URL bar slides; ignore those so the scene doesn't jump
    if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 130) return;
    const ratio = total > 1 ? scrollY / total : 0;
    lastW = innerWidth; lastH = innerHeight;
    layout();
    if (ratio) scrollTo(0, ratio * total);
    s = scrollY;
    render(s);
  };
  addEventListener('resize', relayout);
  relayout();
  if (document.fonts) document.fonts.ready.then(() => { lastW = 0; relayout(); }); // heights change once fonts land

  /* ---- in-page links and keyboard focus fly the camera to the right station ---- */
  const goTo = (o) => {
    if (innerWidth <= 820 || matchMedia('(prefers-reduced-motion: reduce)').matches) o.el.scrollIntoView();
    else scrollTo(0, o.arr + Math.min(o.holdPx * 0.5, 60));
  };
  $('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const o = sts.find((x) => x.el.id === a.getAttribute('href').slice(1));
    if (o) { e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); goTo(o); }
  }));
  world.addEventListener('focusin', (e) => {
    const o = sts.find((x) => x.el.contains(e.target));
    if (o && o.j !== current) goTo(o);
  });
  if (location.hash) {
    const target = sts.find((o) => '#' + o.el.id === location.hash);
    if (target) goTo(target);
  }
})();
