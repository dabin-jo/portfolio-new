'use strict';

/*
  모바일 화면 (compact.js 가 html 에 is-mobile 을 붙였을 때만 동작, 화면 폭 640px 이하)
  - 피그마 phone 시안(390 x 3456)을 위쪽 종이(A: 0~978px)와 아래쪽(B: 978px~끝) 두 캔버스로 나눠, 화면 폭에 맞춰 줄이거나 늘림 (배율 = 화면 폭 / 390)
  - 데스크톱과 같은 흐름: 스크롤하면 철학 글자가 검정이 되고(형광펜도 칠해짐), 다 검정이 되면 종이 모서리가 접혀 올라옴.
    모서리를 끌거나 누르면 종이가 넘어가고, 그 아래에 있던 Project 가 나타남 (그 아래로 About Me, 푸터가 이어짐)
  - 종이 접기 계산(clipByLine, toClip)은 main.js 의 것을 그대로 씀
*/
if (window.IS_MOBILE) {
  const MOBILE_WIDTH = 390; /* 시안 가로 */
  const SHEET_H = 1228; /* 위쪽 종이 높이 (히어로 간격을 넓히고 철학을 아래로 내리면서 978 → 1228) */
  const LOWER_TOP = 958; /* 아래쪽이 시작하는 시안 y (종이 아래 끝 978px 보다 60px 위: 헤더와 Project 제목이 겹치지 않게) */
  const LOWER_H = 3456 - LOWER_TOP; /* 아래쪽 높이 */

  const wrap = document.getElementById('mobile');
  const areaA = document.getElementById('mA');
  const areaB = document.getElementById('mB');
  const stageA = document.getElementById('mStageA');
  const stageB = document.getElementById('mStageB');
  const header = document.getElementById('mHeader');
  const sheet = document.getElementById('mSheet');
  const foldFlap = document.getElementById('mFoldFlap');
  let mScale = 1;
  let turned = false; /* 종이가 넘어가서 Project 가 열린 상태 */

  function fitMobile() {
    mScale = wrap.clientWidth / MOBILE_WIDTH;
    gsap.set([stageA, stageB], { scale: mScale, transformOrigin: '0 0' });
    gsap.set(header, { scale: mScale, transformOrigin: '0 0' });
    areaA.style.height = `${SHEET_H * mScale}px`;
    areaB.style.height = `${LOWER_H * mScale}px`;
    wrap.style.height = `${(turned ? LOWER_H : SHEET_H) * mScale}px`;
    document.documentElement.style.setProperty('--ms', mScale);
    ScrollTrigger.refresh();
    updateHeaderTone();
  }

  /* 헤더 가운데가 검은 구역(Project, 푸터) 위에 있으면 흰색 (종이가 넘어간 뒤에만. 캔버스 좌표로 환산) */
  const DARK_FROM = 920;
  const DARK_TO = 1990;
  const FOOTER_FROM = 3010;
  function updateHeaderTone() {
    if (!turned) {
      header.classList.remove('is-light');
      return;
    }
    const y = window.scrollY / mScale + LOWER_TOP + 33; /* 헤더 가운데 높이 */
    header.classList.toggle('is-light', (y >= DARK_FROM && y <= DARK_TO) || y >= FOOTER_FROM);
  }

  /* --------------------------------------------------------------------------
     종이 접기 (데스크톱 main.js 와 같은 방식. 종이 크기만 위쪽 종이 390 x 978)
     종이의 오른쪽 아래 꼭짓점 C 를 점 P 로 끌어온다고 보고, C 와 P 의 수직이등분선을 접히는 선으로 삼음
     -------------------------------------------------------------------------- */
  const CORNER = { x: MOBILE_WIDTH, y: SHEET_H };
  const FOLD_REST = { x: 376.7, y: SHEET_H - 89.8 }; /* 종이 아래 끝에서 위로 89.8px */ /* 처음 접혀 있는 모양 (시안의 연두색 삼각형) */
  const FOLD_END = { x: -MOBILE_WIDTH, y: -SHEET_H }; /* 종이가 완전히 넘어간 상태 */
  const TURN_DISTANCE = 330; /* 이만큼 이상 끌어야 놓았을 때 페이지가 넘어감 */
  const FOLD_DELAY = 0.4; /* 글씨가 다 검정이 된 뒤 이 시간(초)이 지나야 접힌 모서리가 올라오기 시작함 */
  const UNFOLD_PROGRESS = 0.9; /* 모서리가 나타난 뒤 이만큼보다 위로 스크롤하면 다시 접힘 */

  const fold = { p: { x: CORNER.x, y: CORNER.y }, shown: false, tween: null };
  let foldTimer = null;

  function renderFold() {
    const { p } = fold;
    const dx = p.x - CORNER.x;
    const dy = p.y - CORNER.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) {
      sheet.style.clipPath = 'none';
      foldFlap.style.clipPath = toClip([]);
      return;
    }
    const m = { x: (CORNER.x + p.x) / 2, y: (CORNER.y + p.y) / 2 };
    const n = { x: dx / dist, y: dy / dist };
    const rect = [
      { x: 0, y: 0 },
      { x: MOBILE_WIDTH, y: 0 },
      { x: MOBILE_WIDTH, y: SHEET_H },
      { x: 0, y: SHEET_H },
    ];
    const visible = clipByLine(rect, m, n);
    const removed = clipByLine(rect, m, { x: -n.x, y: -n.y });
    let flap = removed.map((q) => {
      const d = (q.x - m.x) * n.x + (q.y - m.y) * n.y;
      return { x: q.x - 2 * d * n.x, y: q.y - 2 * d * n.y };
    });
    [
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: MOBILE_WIDTH, y: 0 }, { x: -1, y: 0 }],
      [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      [{ x: 0, y: SHEET_H }, { x: 0, y: -1 }],
    ].forEach(([pt, nn]) => {
      flap = clipByLine(flap, pt, nn);
    });
    sheet.style.clipPath = toClip(visible);
    foldFlap.style.clipPath = toClip(flap);
  }

  function animateFold(to, duration, ease, onComplete) {
    if (fold.tween) fold.tween.kill();
    fold.tween = gsap.to(fold.p, { x: to.x, y: to.y, duration, ease, onUpdate: renderFold, onComplete });
  }

  function showFold() {
    foldTimer = null;
    fold.shown = true;
    animateFold(FOLD_REST, 1.1, 'power3.out');
  }

  function resetFold() {
    if (foldTimer) foldTimer.kill();
    foldTimer = null;
    fold.shown = false;
    animateFold(CORNER, 0.5, 'power2.inOut');
  }

  function onColorProgress(progress) {
    if (turned) return;
    if (progress >= 0.999 && !fold.shown) {
      if (!foldTimer) foldTimer = gsap.delayedCall(FOLD_DELAY, showFold);
    } else if (progress < 0.98 && foldTimer && !fold.shown) {
      foldTimer.kill();
      foldTimer = null;
    } else if (fold.shown && progress < UNFOLD_PROGRESS) {
      resetFold();
    }
  }

  /* 종이가 넘어간 뒤: 위쪽 종이는 치우고, 아래쪽(Project ~ 푸터)이 문서 맨 위부터 이어지게 함 */
  /* 바로 이동 (부드러운 스크롤 라이브러리의 값과 실제 스크롤 위치를 같이 맞춤. 화면이 바뀐 직후라 한 프레임 뒤에 한 번 더 맞춤) */
  function scrollToY(y) {
    const apply = () => {
      window.scrollTo(0, y);
      if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true });
    };
    apply();
    requestAnimationFrame(apply);
  }

  function setTurned() {
    if (turned) return;
    turned = true;
    if (foldTimer) foldTimer.kill();
    foldTimer = null;
    if (fold.tween) fold.tween.kill();
    ScrollTrigger.getAll().forEach((t) => t.kill());
    areaA.style.display = 'none';
    areaB.classList.add('is-open');
    wrap.style.height = `${LOWER_H * mScale}px`;
    scrollToY(0);
    ScrollTrigger.refresh();
    updateHeaderTone();
  }

  function turnPage() {
    animateFold(FOLD_END, 0.9, 'power2.inOut', setTurned);
  }

  /* 모서리 끌기 / 누르기 */
  function initFoldInteraction() {
    let start = null;
    let moved = false;
    const toStage = (e) => {
      const r = stageA.getBoundingClientRect();
      return { x: (e.clientX - r.left) / mScale, y: (e.clientY - r.top) / mScale };
    };

    foldFlap.addEventListener('pointerdown', (e) => {
      if (!fold.shown || turned) return;
      if (fold.tween) fold.tween.kill();
      foldFlap.setPointerCapture(e.pointerId);
      start = toStage(e);
      moved = false;
    });
    foldFlap.addEventListener('pointermove', (e) => {
      if (!start) return;
      const q = toStage(e);
      if (Math.hypot(q.x - start.x, q.y - start.y) > 6) moved = true;
      if (!moved) return;
      fold.p.x = Math.min(q.x, CORNER.x);
      fold.p.y = Math.min(q.y, CORNER.y);
      renderFold();
    });
    const release = (e) => {
      if (!start) return;
      start = null;
      if (foldFlap.hasPointerCapture(e.pointerId)) foldFlap.releasePointerCapture(e.pointerId);
      const dragged = Math.hypot(fold.p.x - CORNER.x, fold.p.y - CORNER.y);
      if (!moved || dragged > TURN_DISTANCE) turnPage();
      else animateFold(FOLD_REST, 0.7, 'elastic.out(1, 0.6)');
    };
    foldFlap.addEventListener('pointerup', release);
    foldFlap.addEventListener('pointercancel', release);
  }

  /* --------------------------------------------------------------------------
     메뉴 이동: 종이가 아직 안 넘어갔으면 바로 넘어간 상태로 만들고 해당 위치로 이동
     -------------------------------------------------------------------------- */
  const TARGETS = { project: 958, about: 1900 }; /* 시안 y */
  function goTo(name, instant) {
    const wasTurned = turned;
    if (!turned) {
      fold.p.x = FOLD_END.x;
      fold.p.y = FOLD_END.y;
      renderFold();
      setTurned();
    }
    const y = Math.max(0, (TARGETS[name] - LOWER_TOP) * mScale);
    if (instant || !wasTurned) scrollToY(y);
    else if (window.lenis) window.lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-m-goto]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(a.dataset.mGoto);
    });
  });

  /* --------------------------------------------------------------------------
     철학 글자: 스크롤하면 앞에서부터 차례로 검정이 되고, 구절 뒤에 형광펜이 칠해짐 (데스크톱과 같은 값)
     문서 맨 끝(종이 아래 끝이 화면 아래 끝에 닿는 곳)에서 전부 검정이 됨
     -------------------------------------------------------------------------- */
  function initMobilePhilosophy() {
    const text = document.querySelector('.m-phil__text');
    const chars = [];
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!node.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent) {
        if (ch === ' ') {
          frag.appendChild(document.createTextNode(ch));
          continue;
        }
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        frag.appendChild(span);
        chars.push(span);
      }
      node.replaceWith(frag);
    });

    const gray = '#efefef';
    const black = getComputedStyle(document.documentElement).getPropertyValue('--black').trim() || '#0c0c0c';
    gsap.set(chars, { color: gray });
    const CHAR_TIME = 0.1;
    const step = (1 - CHAR_TIME) / (chars.length - 1);

    const HL_DELAY = 0.04;
    const HL_DURATION = 0.7;
    const highlights = gsap.utils.toArray('.m-phil .hl').map((el) => {
      const inside = el.querySelectorAll('.char');
      const last = chars.indexOf(inside[inside.length - 1]);
      return { el, at: last * step + CHAR_TIME + HL_DELAY, painted: false, tween: null };
    });
    const updateHighlights = (progress) => {
      highlights.forEach((h) => {
        const paint = progress >= h.at;
        if (paint === h.painted) return;
        h.painted = paint;
        if (h.tween) h.tween.kill();
        h.tween = gsap.to(h.el, { '--hl': paint ? 1 : 0, duration: paint ? HL_DURATION : 0.3, ease: paint ? 'power2.out' : 'power1.in' });
      });
    };

    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: text,
          start: 'top 85%',
          end: 'max',
          scrub: true,
          onUpdate: (self) => {
            updateHighlights(self.progress);
            onColorProgress(self.progress);
          },
        },
      })
      .fromTo(chars, { color: gray }, { color: black, duration: CHAR_TIME, stagger: step, immediateRender: true }, 0);
  }

  window.addEventListener('resize', fitMobile);
  window.addEventListener('scroll', updateHeaderTone, { passive: true });
  fitMobile();
  initMobilePhilosophy();
  initFoldInteraction();
  renderFold();

  /* 다른 페이지에서 index.html#project / #about 으로 들어온 경우 */
  const hash = location.hash.slice(1);
  if (TARGETS[hash]) window.addEventListener('load', () => setTimeout(() => goTo(hash, true), 100), { once: true });
}
