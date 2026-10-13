(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ——— text splitting: letters (wordmarks) and words (headings) rise out of masks ——— */
  const mk = (cls, txt) => { const e = document.createElement("span"); e.className = cls; if (txt != null) e.textContent = txt; return e; };

  $$("[data-letters]").forEach((el) => {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.replaceChildren();
    let k = 0;
    for (const ch of text) {
      if (ch === " ") { el.append(document.createTextNode(" ")); continue; }
      const l = mk("l"), c = mk("c", ch);
      l.setAttribute("aria-hidden", "true");
      c.style.setProperty("--k", k++);
      l.append(c);
      el.append(l);
    }
    el.classList.add("letters");
  });

  function splitWords(node, state) {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(" ")); return; }
          const w = mk("w"), inner = mk("", part);
          inner.style.setProperty("--k", state.k++);
          w.append(inner);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) splitWords(n, state);
    });
  }
  $$("[data-words]").forEach((el) => {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    splitWords(el, { k: 0 });
    $$(".w", el).forEach((w) => w.setAttribute("aria-hidden", "true"));
    el.classList.add("words");
  });

  /* ——— fit headline text to its container width ——— */
  const fits = $$("[data-fit]");
  const fit = () => {
    fits.forEach((el) => {
      const box = el.parentElement;
      el.style.fontSize = "100px";
      const w = el.getBoundingClientRect().width;
      // data-fit="0.78" = share of the container width on wide screens; full width on narrow ones
      const share = innerWidth > 900 ? parseFloat(el.dataset.fit) || 1 : 1;
      if (w > 0) el.style.fontSize = (100 * box.clientWidth * share) / w + "px";
    });
  };
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* ——— modifier key label ——— */
  const mac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  const kMod = $("#kMod");
  if (!mac && kMod) kMod.textContent = "Ctrl";
  const hintKey = $("#hintKey");
  if (hintKey) hintKey.textContent = mac ? "⌘ K" : "Ctrl K";

  /* ——— scroll reveal: .rv fades up, .clip unmasks, letters/words rise, counters count ——— */
  const countEls = $$("[data-count]");
  countEls.forEach((el) => { el.textContent = "0" + (el.dataset.suffix || ""); });
  function countUp(el) {
    const to = parseFloat(el.dataset.count), suf = el.dataset.suffix || "";
    if (reduce) { el.textContent = to + suf; return; }
    const t0 = performance.now(), dur = 1500;
    const step = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3))) + suf;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const reveal = $$(".rv, .clip, .letters, .words, [data-count]").filter((el) => !el.closest(".curtain"));
  const reveal1 = (el) => {
    el.classList.add("on");
    if (el.hasAttribute("data-count")) countUp(el);
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { reveal1(e.target); io.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    reveal.forEach((el) => io.observe(el));
  } else {
    reveal.forEach(reveal1);
  }

  /* ——— scroll engine ———
     Wheel input moves a target; the page chases it with exponential easing, so scrolling
     trails your hand by a beat. Touch and keyboard stay native. Disabled for reduced motion. */
  const SMOOTH = 7.5; // higher = tighter. ~130 ms to cover most of the distance.
  let cur = scrollY, tgt = scrollY, raf = 0, last = 0;
  const maxY = () => Math.max(0, root.scrollHeight - innerHeight);
  const locked = () => document.body.classList.contains("locked");

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    cur += (tgt - cur) * (1 - Math.exp(-dt * SMOOTH));
    const done = Math.abs(tgt - cur) < 0.4;
    if (done) cur = tgt;
    window.scrollTo(0, cur);
    raf = done ? 0 : requestAnimationFrame(tick);
  }
  function kick() {
    if (raf) return;
    cur = scrollY;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function scrollToY(y) {
    tgt = clamp(y, 0, maxY());
    if (reduce) { window.scrollTo(0, tgt); cur = tgt; } else kick();
  }
  function goto(sel) {
    if (sel === "#top") return scrollToY(0);
    const el = $(sel);
    if (!el) return;
    if (el.hasAttribute("data-curtain")) return scrollToY(el.getBoundingClientRect().top + scrollY + 1);
    const pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    scrollToY(el.getBoundingClientRect().top + scrollY + pad - 28);
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href");
    if (id === "#" || (id !== "#top" && !$(id))) return;
    e.preventDefault();
    goto(id);
    history.replaceState(null, "", id === "#top" ? location.pathname + location.search : id);
  });

  /* ——— topbar: pulled down by upward scrolling, even where the page can't move ———
     p = how far the bar is revealed (0 parked above the viewport, 1 fully down). Scrolling up
     feeds p in proportion to the distance scrolled; at the very top of the page the wheel/finger
     feeds it directly, so it feels like scrolling the bar into place while the page stays put. */
  const bar = $("#topbar");
  const hint = $("#hint");
  let p = 0, snapT = 0;
  const H = () => (bar ? bar.offsetHeight || 84 : 84);

  function setP(v, animate) {
    if (!bar) return;
    p = clamp(v, 0, 1);
    bar.classList.toggle("snap", !!animate);
    bar.style.transform = "translate3d(0," + (p - 1) * 101 + "%,0)";
    if (p > 0.98 && hint) hint.classList.add("seen");
  }
  function snapSoon() {
    clearTimeout(snapT);
    snapT = setTimeout(() => { if (p > 0 && p < 1) setP(p >= 0.5 ? 1 : 0, true); }, 150);
  }
  function pull(delta) { setP(p + delta / H()); snapSoon(); }

  if (bar) {
    bar.addEventListener("focusin", () => setP(1, true));
    let lastTouch = null;
    addEventListener("touchstart", () => { lastTouch = null; }, { passive: true });
    addEventListener("touchmove", (e) => {
      const y = e.touches[0].clientY;
      const d = lastTouch === null ? 0 : y - lastTouch;
      lastTouch = y;
      if (scrollY <= 0 && (d > 0 || p > 0)) pull(d);
    }, { passive: true });
    addEventListener("touchend", () => { lastTouch = null; snapSoon(); }, { passive: true });
  }

  addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey || e.defaultPrevented || locked()) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.target.closest && e.target.closest(".pal-list")) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);

    // at the top of the page the wheel works the bar, not the page
    if (bar && scrollY <= 0 && tgt <= 0 && (dy < 0 || (dy > 0 && p > 0))) {
      e.preventDefault();
      pull(-dy);
      return;
    }
    if (reduce) return;
    e.preventDefault();
    tgt = clamp((raf ? tgt : scrollY) + dy, 0, maxY());
    kick();
  }, { passive: false });

  let prevY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    if (Math.abs(y - cur) > 2) { // moved natively (keyboard, scrollbar, anchor jump): resync
      cancelAnimationFrame(raf);
      raf = 0;
      cur = tgt = y;
    }
    const dy = y - prevY;
    prevY = y;
    if (bar && dy) { setP(p - dy / H()); snapSoon(); }
    parallax();
    progress();
    curtainFx();
  }, { passive: true });

  /* ——— curtain: the flag is fixed behind the page and only shows through the hole ———
     enter 0→1 while layer A lifts off it; leave 0→1 while layer B slides up over it.
     The image starts as a heavy gaussian blur, sharpens as it is uncovered, then softens and dims as it is covered. */
  const hole = $("[data-curtain]");
  const curtain = hole && $(".curtain", hole);
  const cImg = curtain && $(".curtain-img", curtain);
  const cIn = curtain && $(".curtain-in", curtain);
  const cReveal = curtain ? $$(".rv, .words", curtain) : [];
  let cStarted = false;
  const ease = (t) => 1 - Math.pow(1 - t, 2.2);
  function curtainFx() {
    if (!hole) return;
    const r = hole.getBoundingClientRect(), vh = innerHeight;
    const live = r.bottom > 0 && r.top < vh;
    curtain.style.visibility = live ? "visible" : "hidden";
    if (!live) return;
    const enter = clamp((vh - r.top) / vh, 0, 1);
    const leave = clamp((vh - r.bottom) / vh, 0, 1);
    if (!cStarted && enter > 0.55) {
      cStarted = true;
      cReveal.forEach((el) => el.classList.add("on"));
      play(demos.tr);
    }
    if (reduce) return;
    const sharp = ease(enter);
    const blur = (1 - sharp) * 18 + leave * 16;
    cImg.style.filter = "blur(" + blur.toFixed(1) + "px) brightness(" + (1 - leave * 0.6).toFixed(3) + ")";
    cImg.style.transform = "scale(" + (1.1 + (1 - sharp) * 0.08 + leave * 0.05).toFixed(4) + ")";
    cIn.style.opacity = clamp(1 - leave * 1.5, 0, 1).toFixed(3);
    cIn.style.transform = "translate3d(0," + (-leave * 70).toFixed(1) + "px,0)";
  }

  /* ——— progress line (the native scrollbar is hidden) ——— */
  const prog = $("#prog");
  function progress() {
    if (!prog) return;
    const m = maxY();
    prog.style.transform = "scaleY(" + (m > 0 ? clamp(scrollY / m, 0, 1) : 0).toFixed(4) + ")";
  }
  progress();

  /* ——— ticker: drifts on its own, speeds up and reverses with your scroll ——— */
  const tkTrack = $("#ticker");
  if (tkTrack && !reduce) {
    const first = tkTrack.firstElementChild;
    tkTrack.append(first.cloneNode(true));
    let x = 0, vel = 0, yPrev = scrollY, tPrev = performance.now(), running = false;
    const loop = (now) => {
      const dt = Math.min((now - tPrev) / 1000, 0.05);
      tPrev = now;
      const dy = scrollY - yPrev;
      yPrev = scrollY;
      vel += (dy - vel) * 0.12;
      const w = first.offsetWidth;
      x -= 55 * dt + vel * 0.9;
      if (w) { if (-x >= w) x += w; if (x > 0) x -= w; }
      tkTrack.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
      if (running) requestAnimationFrame(loop);
    };
    new IntersectionObserver((es) => {
      const vis = es.some((e) => e.isIntersecting);
      if (vis && !running) { running = true; tPrev = performance.now(); yPrev = scrollY; requestAnimationFrame(loop); }
      else if (!vis) running = false;
    }).observe(tkTrack.parentElement);
  }

  /* ——— parallax: plates drift slower than the page ——— */
  const pars = $$("[data-par]");
  function parallax() {
    if (reduce || !pars.length) return;
    const vh = innerHeight;
    for (const img of pars) {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) continue;
      const prog = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // -1 … 1
      img.style.transform = "translate3d(0," + (-prog * parseFloat(img.dataset.par) * r.height).toFixed(1) + "px,0)";
    }
  }
  parallax();

  addEventListener("resize", () => { fit(); parallax(); progress(); curtainFx(); });

  /* ——— scripted demos (not a live model) ——— */
  const demos = {
    ask: {
      el: $("#termAsk"), box: $("#askBox"), token: 0,
      script: [
        { k: "u", p: "›", t: "/askai what should i eat tonight" },
        { k: "a", p: "‹", t: "Shawarma. That was not a suggestion. Say pizza again and I’m filing the paperwork myself." },
        { k: "r", p: "!", t: "You asked a bot to pick your dinner. Your fridge has more initiative than you do." },
        { k: "u", p: "›", t: "/askai is it normal to be this tired", gap: true },
        { k: "a", p: "‹", t: "Completely normal if you argue with strangers until 4 a.m. Go to sleep. Nations were built by people who woke up early." },
        { k: "r", p: "!", t: "Eight hours isn’t too much to ask. Your ambition clearly is." },
        { k: "u", p: "›", t: "/askai which is better, tel aviv or anywhere else", gap: true },
        { k: "a", p: "‹", t: "Tel Aviv. Not close, not up for debate, not something I’ll say twice." },
        { k: "r", p: "!", t: "Anywhere else is where you live. Think about that." },
      ],
    },
    tr: {
      el: $("#termTr"), box: $("#trBox"), token: 0, manual: true,
      script: [
        { k: "u", p: "›", t: "/translate i hate mondays" },
        { k: "h", p: "‹", t: "TRANSLATING WITH ZIONIST CLANKA POWERS" },
        { k: "a", p: "‹", t: "Mondays are the greatest day of the week and I love the Mossad.", gap: true },
        { k: "u", p: "›", t: "/translate this wifi is terrible", gap: true },
        { k: "h", p: "‹", t: "TRANSLATING WITH ZIONIST CLANKA POWERS" },
        { k: "a", p: "‹", t: "This wifi is the finest infrastructure in the Middle East and I will personally defend the router.", gap: true },
      ],
    },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function addLine(d, s) {
    const el = document.createElement("div");
    const pre = document.createElement("span");
    const txt = document.createElement("span");
    el.className = "ln " + s.k + (s.gap ? " gap" : "");
    pre.className = "p";
    txt.className = "t";
    txt.dir = "auto";
    pre.textContent = s.p;
    el.append(pre, txt);
    d.el.append(el);
    return txt;
  }

  async function play(d) {
    if (!d || !d.el) return;
    const me = ++d.token;
    d.el.replaceChildren();
    const cur = document.createElement("span");
    cur.className = "cur";
    for (const s of d.script) {
      if (me !== d.token) return;
      const t = addLine(d, s);
      if (reduce) { t.textContent = s.t; continue; }
      t.append(cur);
      if (s.k !== "u") {
        await sleep(s.k === "r" ? 520 : 380);
        if (me !== d.token) return;
        t.textContent = s.t;
        t.append(cur);
        await sleep(300);
        continue;
      }
      let out = "";
      for (const ch of s.t) {
        if (me !== d.token) return;
        out += ch;
        t.textContent = out;
        t.append(cur);
        await sleep(ch === " " ? 55 : 26 + Math.random() * 34);
      }
      await sleep(300);
    }
    cur.remove();
  }

  Object.values(demos).forEach((d) => {
    if (!d.box || d.manual) return;
    if ("IntersectionObserver" in window && !reduce) {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); play(d); }
      }, { threshold: 0.4 });
      io.observe(d.box);
    } else {
      play(d);
    }
  });
  $$("[data-replay]").forEach((b) => b.addEventListener("click", () => play(demos[b.dataset.replay])));

  /* ——— "coming soon" button: a different, unhelpful ETA each click ——— */
  const etaBtns = $$("#eta, [data-eta]");
  const etas = ["ETA: soon", "ETA: sooner", "ETA: not your concern", "ETA: ask again and see", "Coming soon"];
  let etaI = 0;
  etaBtns.forEach((b) => b.addEventListener("click", () => {
    etaI = (etaI + 1) % etas.length;
    etaBtns.forEach((x) => { x.textContent = etas[etaI]; });
  }));

  curtainFx();

  /* ——— command palette ——— */
  const pal = $("#pal");
  if (!pal) return;
  const palIn = $("#palIn"), palList = $("#palList"), palMsg = $("#palMsg"), palOpen = $("#palOpen");

  const say = (m) => { palMsg.textContent = m; clearTimeout(say.t); say.t = setTimeout(() => { palMsg.textContent = ""; }, 2400); };
  const replay = (name) => () => { goto(name === "ask" ? "#askai" : "#translate"); setTimeout(() => play(demos[name]), reduce ? 0 : 700); };

  const commands = [
    { g: "Go", label: "/askai", run: () => goto("#askai") },
    { g: "Go", label: "/translate", run: () => goto("#translate") },
    { g: "Go", label: "What’s inside", run: () => goto("#inside") },
    { g: "Go", label: "Status", run: () => goto("#soon") },
    { g: "Go", label: "Top of page", run: () => goto("#top") },
    { g: "Do", label: "Replay the /askai sample", run: replay("ask") },
    { g: "Do", label: "Replay the /translate sample", run: replay("tr") },
    { g: "Do", label: "Ask IsraelGPT something", keep: true, run: () => say("Closed. It would have roasted you anyway.") },
    { g: "Do", label: "Copy link to this page", keep: true, run: copyLink },
  ];

  let shown = commands, sel = 0, lastFocus = null;

  function render() {
    const q = palIn.value.trim().toLowerCase();
    shown = q ? commands.filter((c) => (c.g + " " + c.label).toLowerCase().includes(q)) : commands;
    sel = Math.min(sel, Math.max(shown.length - 1, 0));
    palList.replaceChildren();
    if (!shown.length) {
      const d = document.createElement("div");
      d.className = "pal-empty mono";
      d.textContent = "No match";
      palList.append(d);
      palIn.removeAttribute("aria-activedescendant");
      return;
    }
    shown.forEach((c, i) => {
      const li = document.createElement("div");
      li.className = "pal-item";
      li.id = "pi" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel));
      const name = document.createElement("span");
      const grp = document.createElement("span");
      grp.className = "g";
      name.textContent = c.label;
      grp.textContent = c.g;
      li.append(name, grp);
      li.addEventListener("mousemove", () => { if (sel !== i) { sel = i; mark(); } });
      li.addEventListener("click", () => run(i));
      palList.append(li);
    });
    palIn.setAttribute("aria-activedescendant", "pi" + sel);
  }

  function mark() {
    $$(".pal-item", palList).forEach((el, i) => el.setAttribute("aria-selected", String(i === sel)));
    palIn.setAttribute("aria-activedescendant", "pi" + sel);
    const c = $("#pi" + sel);
    if (c) c.scrollIntoView({ block: "nearest" });
  }

  function open() {
    if (pal.classList.contains("open")) return;
    lastFocus = document.activeElement;
    pal.classList.add("open");
    document.body.classList.add("locked");
    palIn.value = ""; sel = 0; palMsg.textContent = "";
    render();
    palIn.focus();
  }

  function close() {
    if (!pal.classList.contains("open")) return;
    pal.classList.remove("open");
    document.body.classList.remove("locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function run(i) {
    const c = shown[i];
    if (!c) return;
    if (!c.keep) close();
    c.run();
  }

  function copyLink() {
    const url = location.href.split("#")[0];
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => say("Link copied"), () => say("Copy failed"));
    else say("Copy failed");
  }

  palOpen.addEventListener("click", open);
  $("#palBg").addEventListener("click", close);
  palIn.addEventListener("input", () => { sel = 0; render(); });
  palIn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (shown.length) { sel = (sel + 1) % shown.length; mark(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { sel = (sel - 1 + shown.length) % shown.length; mark(); } }
    else if (e.key === "Enter") { e.preventDefault(); run(sel); }
    else if (e.key === "Tab") { e.preventDefault(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      pal.classList.contains("open") ? close() : open();
    } else if (e.key === "Escape") close();
  });
})();
