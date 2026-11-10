'use strict';

gsap.registerPlugin(ScrollTrigger);

/* --------------------------------------------------------------------------
   1920px 기준 캔버스를 화면 폭에 맞춰 축소/확대
   -------------------------------------------------------------------------- */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 3120;

/* 위쪽 종이(철학 페이지)의 크기 */
const SHEET_WIDTH = 1920;
const SHEET_HEIGHT = 2040;

/* 글씨가 검정으로 바뀌는 동안 화면을 붙잡아 두는 스크롤 거리(px) */
const COLOR_HOLD = 1400;

const viewport = document.getElementById('viewport');
const stageSticky = document.getElementById('stageSticky');
const stage = document.getElementById('stage');
const header = document.querySelector('.header');
const sheet = document.getElementById('sheet');
const shelf = document.getElementById('shelf');
const foldFlap = document.getElementById('foldFlap');
const after = document.getElementById('after');
const afterStage = document.getElementById('afterStage');

/* 메인 페이지 디자인 전체 높이와 About Me 섹션 위치 (디자인 좌표) */
const PAGE_HEIGHT = 4577; /* 피그마 4547 + 표와 푸터 사이를 벌린 30 */
const ABOUT_TOP = 3240;

let scale = 1;
let holdStart = 0; /* 화면 고정이 시작되는 스크롤 위치(px) */

function fitStage() {
  scale = viewport.clientWidth / BASE_WIDTH;
  gsap.set(stage, { scale, transformOrigin: '0 0' });
  gsap.set(header, { scale, transformOrigin: '0 0' }); /* 고정 헤더도 같은 비율로 */

  /* 철학 페이지(종이)의 아래쪽 끝이 화면 아래 끝에 오도록 맞춤 */
  const visibleTop = Math.max(0, SHEET_HEIGHT - window.innerHeight / scale);
  holdStart = visibleTop * scale;

  /* 책장 페이지를 종이 뒤, 같은 화면 위치에 겹쳐 둠 */
  gsap.set(shelf, { y: -(SHEET_HEIGHT - visibleTop) });

  /*
    화면에 고정되는 영역의 높이 = 고정 시작 위치 + 화면 높이.
    이렇게 하면 문서의 맨 끝이 곧 글씨가 다 검정이 되는 지점이라,
    접힌 모서리가 나타난 뒤에는 브라우저가 아래로 더 내려가지 못하게 함 (잠금 코드 불필요).
  */
  const stickyHeight = holdStart + window.innerHeight;
  stageSticky.style.height = `${stickyHeight}px`;
  stageSticky.style.top = `${-holdStart}px`;
  viewport.style.height = `${stickyHeight + COLOR_HOLD}px`;

  layoutAfter();
  ScrollTrigger.refresh();
}

/*
  About Me + 푸터(.after): 프로젝트 페이지(고정 화면) 바로 아래에서 이어짐.
  고정 화면은 디자인 y 2040 ~ 2040+화면높이 를 보여 주므로, 아래 영역은 그 아래(디자인 y = afterTop)부터 시작함.
*/
function layoutAfter() {
  const visibleHeight = window.innerHeight / scale;
  const afterTop = SHEET_HEIGHT + visibleHeight;
  after.style.height = `${Math.max(0, PAGE_HEIGHT - afterTop) * scale}px`;
  gsap.set(afterStage, { scale, y: -afterTop * scale, transformOrigin: '0 0' });
  after.style.setProperty('--vh', `${visibleHeight}px`);
  return afterTop;
}

window.addEventListener('resize', fitStage);

/*
  페이지 높이를 정하고 나면 세로 스크롤바가 생겨서 화면 폭이 줄어듦 (resize 이벤트는 안 뜸).
  그 변화를 감지해서 다시 맞춰야 오른쪽 여백(헤더 등)이 어긋나지 않음.
*/
new ResizeObserver(() => {
  if (viewport.clientWidth / BASE_WIDTH !== scale) fitStage();
}).observe(viewport);

/* --------------------------------------------------------------------------
   1단계: 철학 문장이 회색에서 검정으로 (스크롤)
   -------------------------------------------------------------------------- */
const TEXT_GRAY = '#efefef';
const TEXT_BLACK = '#0c0c0c';

/* 글자 하나하나를 <span class="char">로 감쌈 (공백은 그대로 둠) */
function splitChars(el) {
  const chars = [];
  /* 형광펜 <span class="hl"> 같은 안쪽 태그는 그대로 두고, 글자(텍스트 노드)만 쪼갬 */
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
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
  return chars;
}

/*
  스크롤을 내리면 회색 글씨가 앞에서부터 차례로 검정색으로 바뀜.
  다 검정이 될 때까지는 CSS sticky로 브라우저가 화면을 붙잡아 둠.
  다 검정이 되면 종이 모서리가 접히며 나타남(2단계).
*/
function initPhilosophyColor() {
  const chars = gsap.utils.toArray('.phil').flatMap(splitChars);

  /* 처음에는 모든 글자가 회색 (스크롤 전에 검정으로 보이지 않게 먼저 칠해 둠) */
  gsap.set(chars, { color: TEXT_GRAY });

  /* 글자가 앞에서부터 차례로 검정색으로: 전체 길이 1 = 글자 하나당 간격 step + 색이 바뀌는 시간 CHAR_TIME */
  const CHAR_TIME = 0.1;
  const step = (1 - CHAR_TIME) / (chars.length - 1);

  /*
    형광펜: 그 구절이 전부 검정이 된 뒤 HL_DELAY만큼 더 스크롤했을 때,
    스크롤 속도와 상관없이 정해진 시간(HL_DURATION초) 동안 왼쪽에서 오른쪽으로 칠해짐.
    그 지점보다 위로 되돌리면 다시 지워짐.
  */
  const HL_DELAY = 0.04; /* 글씨가 검정이 된 뒤 이만큼(스크롤 진행도) 더 내려가면 칠하기 시작 */
  const HL_DURATION = 0.7; /* 칠해지는 시간(초) */
  const highlights = gsap.utils.toArray('.hl').map((el) => {
    const inside = el.querySelectorAll('.char');
    const last = chars.indexOf(inside[inside.length - 1]);
    return { el, at: last * step + CHAR_TIME + HL_DELAY, painted: false, tween: null };
  });

  function updateHighlights(progress) {
    highlights.forEach((h) => {
      const shouldPaint = progress >= h.at;
      if (shouldPaint === h.painted) return;
      h.painted = shouldPaint;
      if (h.tween) h.tween.kill();
      h.tween = gsap.to(h.el, {
        '--hl': shouldPaint ? 1 : 0,
        duration: shouldPaint ? HL_DURATION : 0.3,
        ease: shouldPaint ? 'power2.out' : 'power1.in',
      });
    });
  }

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: viewport,
      start: () => holdStart,
      end: () => holdStart + COLOR_HOLD,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        updateHighlights(self.progress);
        onColorProgress(self.progress);
      },
    },
  });

  tl.fromTo(chars, { color: TEXT_GRAY }, { color: TEXT_BLACK, duration: CHAR_TIME, stagger: step, immediateRender: true }, 0);
}

/* --------------------------------------------------------------------------
   2단계: 접힌 종이 모서리 (클릭 / 드래그로 페이지 넘기기)

   종이의 오른쪽 아래 꼭짓점 C를 점 P로 끌어온다고 보고,
   C와 P의 수직이등분선을 접히는 선으로 삼음.
   - 접히는 선 안쪽(원점 쪽)은 종이가 그대로 보임
   - 바깥쪽은 선을 기준으로 뒤집혀서 뒷면(연두색)으로 보임
   - 종이가 있던 자리에는 뒤 배경(회색)이 드러남
   -------------------------------------------------------------------------- */
const CORNER = { x: SHEET_WIDTH, y: SHEET_HEIGHT }; /* 종이 오른쪽 아래 꼭짓점 */
const FOLD_REST = { x: 1883.8, y: 1795.4 }; /* 처음 접혀 있는 모양 (디자인의 연두색 삼각형) */
const FOLD_END = { x: -SHEET_WIDTH, y: -SHEET_HEIGHT }; /* 종이가 완전히 넘어간 상태 */
const TURN_DISTANCE = 900; /* 이만큼 이상 끌어야 놓았을 때 페이지가 넘어감 */

const fold = {
  p: { x: CORNER.x, y: CORNER.y }, /* 끌고 있는 점 P */
  shown: false, /* 접힌 모서리가 나타난 상태인지 */
  turned: false, /* 페이지가 넘어간 상태인지 */
  tween: null,
};

/* 다각형을 직선 한쪽만 남기고 자름. 남기는 쪽: (X - M)·n >= 0 */
function clipByLine(poly, m, n) {
  const side = (q) => (q.x - m.x) * n.x + (q.y - m.y) * n.y;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

const toClip = (poly) =>
  poly.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${poly.map((q) => `${q.x}px ${q.y}px`).join(',')})`;

function renderFold() {
  const { p } = fold;
  const dx = p.x - CORNER.x;
  const dy = p.y - CORNER.y;
  const dist = Math.hypot(dx, dy);

  /* 접힘이 없으면 종이 전체를 보여주고 모서리는 숨김 */
  if (dist < 0.5) {
    sheet.style.clipPath = 'none';
    foldFlap.style.clipPath = toClip([]);
    return;
  }

  const m = { x: (CORNER.x + p.x) / 2, y: (CORNER.y + p.y) / 2 };
  const n = { x: dx / dist, y: dy / dist }; /* C → P 방향 (접히는 선의 수직 방향) */

  const rect = [
    { x: 0, y: 0 },
    { x: SHEET_WIDTH, y: 0 },
    { x: SHEET_WIDTH, y: SHEET_HEIGHT },
    { x: 0, y: SHEET_HEIGHT },
  ];

  /* 보이는 종이: P 쪽 (X - M)·n >= 0 */
  const visible = clipByLine(rect, m, n);
  /* 접혀 넘어가는 부분: C 쪽 → 선 기준으로 뒤집은 것이 뒷면 */
  const removed = clipByLine(rect, m, { x: -n.x, y: -n.y });
  const flapRaw = removed.map((q) => {
    const d = (q.x - m.x) * n.x + (q.y - m.y) * n.y;
    return { x: q.x - 2 * d * n.x, y: q.y - 2 * d * n.y };
  });
  /* 뒷면은 종이 영역 안에서만 보임 */
  let flap = flapRaw;
  [
    [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    [{ x: SHEET_WIDTH, y: 0 }, { x: -1, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 1 }],
    [{ x: 0, y: SHEET_HEIGHT }, { x: 0, y: -1 }],
  ].forEach(([pt, nn]) => {
    flap = clipByLine(flap, pt, nn);
  });

  sheet.style.clipPath = toClip(visible);
  foldFlap.style.clipPath = toClip(flap);
}

function setFold(x, y) {
  fold.p.x = x;
  fold.p.y = y;
  renderFold();
}

function animateFold(to, duration, ease, onComplete) {
  if (fold.tween) fold.tween.kill();
  fold.tween = gsap.to(fold.p, {
    x: to.x,
    y: to.y,
    duration,
    ease,
    onUpdate: renderFold,
    onComplete,
  });
}

/* 글씨가 다 검정이 되면 모서리가 접히며 나타남 */
/* 글씨가 다 검정이 된 뒤, 이 시간(초)이 지나야 접힌 모서리가 올라오기 시작함 (올라오는 데 1.1초 더 걸려서 합계 약 1.5초) */
const FOLD_DELAY = 0.4;
let foldTimer = null;

function showFold() {
  foldTimer = null;
  fold.shown = true;
  animateFold(FOLD_REST, 1.1, 'power3.out');
}

/* 스크롤을 되돌리면 접힌 모서리와 넘어간 페이지를 원래대로 */
function resetFold() {
  if (foldTimer) foldTimer.kill();
  foldTimer = null;
  fold.shown = false;
  fold.turned = false;
  header.classList.remove('is-light');
  shelf.classList.remove('is-open');
  after.classList.remove('is-visible');
  sheet.style.visibility = '';
  foldFlap.style.visibility = '';
  animateFold(CORNER, 0.5, 'power2.inOut');
}

/* 페이지를 넘긴 뒤에는 이만큼 이상 위로 스크롤해야 철학 페이지로 돌아감 (1 = 맨 끝, 0.5 = 절반 거리) */
const RETURN_PROGRESS = 0.5;
/* 접힌 모서리만 보이는 상태에서 되돌아가는 기준 */
const UNFOLD_PROGRESS = 0.9;

function onColorProgress(progress) {
  if (progress >= 0.999 && !fold.shown && !fold.turned) {
    /* 도착하고 잠깐 기다린 뒤에 올라옴 (그 사이에 위로 되돌리면 취소) */
    if (!foldTimer) foldTimer = gsap.delayedCall(FOLD_DELAY, showFold);
  } else if (progress < 0.98 && foldTimer && !fold.shown) {
    foldTimer.kill();
    foldTimer = null;
  }
  if (fold.turned && progress < RETURN_PROGRESS) resetFold();
  else if (fold.shown && !fold.turned && progress < UNFOLD_PROGRESS) resetFold();
}

/* 페이지 넘김: 종이가 완전히 넘어감 */
function turnPage() {
  animateFold(FOLD_END, 0.9, 'power2.inOut', () => {
    fold.turned = true;
    header.classList.add('is-light'); /* 검은 프로젝트 페이지 위에서는 흰색 헤더 */
    shelf.classList.add('is-open'); /* 이제부터 프로젝트 그림을 누를 수 있음 */
    after.classList.add('is-visible'); /* 이제부터 아래로 스크롤해 About Me 와 푸터로 갈 수 있음 */
    sheet.style.visibility = 'hidden';
    foldFlap.style.visibility = 'hidden';
  });
}

/*
  프로젝트 페이지로 바로 이동 (헤더의 Project 메뉴, 주소 끝의 #project)
  철학 문장과 종이 넘기기를 건너뛰고, 종이가 이미 넘어간 상태로 만든 뒤 맨 아래로 이동함.
*/
function openProject() {
  if (foldTimer) foldTimer.kill();
  foldTimer = null;
  if (fold.tween) fold.tween.kill();

  fold.shown = true;
  fold.turned = true;
  fold.p.x = FOLD_END.x;
  fold.p.y = FOLD_END.y;
  renderFold();
  header.classList.add('is-light');
  shelf.classList.add('is-open');
  after.classList.add('is-visible');
  sheet.style.visibility = 'hidden';
  foldFlap.style.visibility = 'hidden';

  window.scrollTo({ top: holdStart + COLOR_HOLD, behavior: 'instant' });
}

/* 섹션으로 이동: 프로젝트 페이지를 연 상태에서 해당 위치로 스크롤 (project / about / contact) */
function goToSection(name) {
  openProject();
  const projectY = holdStart + COLOR_HOLD;
  let y = projectY;
  if (name === 'about') {
    /* About Me 제목이 화면 위에서 85px 아래에 오도록 (헤더와 떨어지고 아래 푸터 윗부분이 같이 보임) */
    const afterTop = SHEET_HEIGHT + window.innerHeight / scale;
    y = after.offsetTop + (ABOUT_TOP - afterTop - 85) * scale;
  } else if (name === 'contact') {
    y = document.documentElement.scrollHeight;
  }
  window.scrollTo({ top: Math.max(projectY, y), behavior: 'instant' });
}

function initProjectShortcut() {
  /* data-goto="project|about|contact" 링크: 새로고침 없이 이동 (연두색 펜 전환 효과와 함께) */
  document.querySelectorAll('[data-goto]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const name = a.dataset.goto;
      const go = () => {
        goToSection(name);
        history.replaceState(null, '', '#' + name);
      };
      /* 펜 전환이 화면을 덮은 순간에 화면을 바꿈 (transition.js 가 없으면 바로 바꿈) */
      if (window.pageTransition) window.pageTransition.run(go);
      else go();
    });
  });

  /* 다른 페이지에서 index.html#project / #about / #contact 로 들어온 경우 */
  const SECTIONS = ['project', 'about', 'contact'];
  const openFromHash = () => {
    const name = location.hash.slice(1);
    if (SECTIONS.includes(name)) goToSection(name);
  };
  window.addEventListener('hashchange', openFromHash);
  if (document.readyState === 'complete') requestAnimationFrame(openFromHash);
  else window.addEventListener('load', () => requestAnimationFrame(openFromHash));
}

/* 마우스/터치로 모서리 끌기 */
function pointerToStage(e) {
  const rect = stage.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
}

function initFoldInteraction() {
  let start = null;
  let moved = false;

  foldFlap.addEventListener('pointerdown', (e) => {
    if (!fold.shown || fold.turned) return;
    if (fold.tween) fold.tween.kill();
    foldFlap.setPointerCapture(e.pointerId);
    foldFlap.classList.add('dragging');
    start = pointerToStage(e);
    moved = false;
  });

  foldFlap.addEventListener('pointermove', (e) => {
    if (!start) return;
    const q = pointerToStage(e);
    if (Math.hypot(q.x - start.x, q.y - start.y) > 6) moved = true;
    if (!moved) return;
    /* 점 P는 종이 오른쪽 아래 꼭짓점보다 오른쪽/아래로는 못 감 */
    setFold(Math.min(q.x, CORNER.x), Math.min(q.y, CORNER.y));
  });

  const release = (e) => {
    if (!start) return;
    start = null;
    foldFlap.classList.remove('dragging');
    if (foldFlap.hasPointerCapture(e.pointerId)) foldFlap.releasePointerCapture(e.pointerId);

    const dragged = Math.hypot(fold.p.x - CORNER.x, fold.p.y - CORNER.y);
    if (!moved || dragged > TURN_DISTANCE) turnPage(); /* 클릭하거나 충분히 끌었으면 넘김 */
    else animateFold(FOLD_REST, 0.7, 'elastic.out(1, 0.6)'); /* 아니면 원래 모양으로 */
  };
  foldFlap.addEventListener('pointerup', release);
  foldFlap.addEventListener('pointercancel', release);
}

/*
  프로젝트 그림에 마우스를 올리면 나머지 그림과 번호표가 어두워짐 (스타일은 style.css 의 .is-dim)
  번호는 링크 주소의 ?project=번호 와 번호표 클래스(project-num-번호)로 짝지음
*/
function initProjectHover() {
  const items = [...document.querySelectorAll('a.project-img')];
  const nums = [...document.querySelectorAll('.project-num')];
  const numberOf = (a) => new URL(a.href).searchParams.get('project');
  const LEAVE_DELAY = 140; /* 그림 사이 빈틈을 지나갈 때 잠깐 밝아졌다 어두워지는 반짝임을 막으려고, 내리고 이 시간(ms) 동안 기다림 */
  let leaveTimer = 0;

  const clear = () => {
    items.forEach((other) => other.classList.remove('is-dim'));
    nums.forEach((num) => num.classList.remove('is-dim'));
  };

  items.forEach((a) => {
    a.addEventListener('mouseenter', () => {
      clearTimeout(leaveTimer);
      const n = numberOf(a);
      items.forEach((other) => other.classList.toggle('is-dim', other !== a));
      nums.forEach((num) => num.classList.toggle('is-dim', !num.classList.contains('project-num-' + n)));
    });
    a.addEventListener('mouseleave', () => {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(clear, LEAVE_DELAY);
    });
  });
}

/*
  푸터 종이 흔들기 (프로젝트 상세 페이지 푸터와 같은 효과)
  - 종이는 각자 아래쪽의 한 점을 축으로 좌우로 흔들리는 추처럼 움직임
  - 마우스가 가까울수록 크게 기울고, 멀어지면 출렁이며 제자리로 돌아옴
  되돌리려면 이 함수와 initScrollAnimations 안의 호출을 지우면 됨
*/
const REPEL_RADIUS = 750; /* 이 거리 안으로 마우스가 들어오면 반응 */
const REPEL_ROTATE = 2.4; /* 가장 세게 기울어질 때 각도(deg) */
const REPEL_PIVOT_BELOW = 100; /* 흔들림의 축: 푸터 맨 아래에서 이만큼 더 아래 */
const FOOTER_HEIGHT = 541;

function initFooterRepel() {
  const footer = document.getElementById('footer');
  const shapes = [...footer.querySelectorAll('.site-footer__shape')];
  let frame = 0;
  let mouse = null;

  shapes.forEach((shape) => {
    gsap.set(shape, { transformOrigin: `50% ${FOOTER_HEIGHT - shape.offsetTop + REPEL_PIVOT_BELOW}px` });
  });

  const settle = (shape) => gsap.to(shape, { rotation: 0, duration: 1.4, ease: 'elastic.out(1, 0.3)', overwrite: true });

  function update() {
    frame = 0;
    if (!mouse) return;
    const baseY = footer.getBoundingClientRect().bottom - 250 * scale;
    shapes.forEach((shape) => {
      const r = shape.getBoundingClientRect();
      const vx = (r.left + r.width / 2 - mouse.x) / scale;
      const vy = (baseY - mouse.y) / scale;
      const influence = Math.max(0, 1 - Math.hypot(vx, vy) / REPEL_RADIUS);
      if (influence <= 0) {
        if (shape._repelled) {
          shape._repelled = false;
          settle(shape);
        }
        return;
      }
      shape._repelled = true;
      const side = Math.max(-1, Math.min(1, vx / 300));
      gsap.to(shape, { rotation: side * REPEL_ROTATE * influence, duration: 0.5, ease: 'power3.out', overwrite: true });
    });
  }

  window.addEventListener(
    'mousemove',
    (e) => {
      mouse = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true }
  );

  document.documentElement.addEventListener('mouseleave', () => {
    mouse = null;
    shapes.forEach((shape) => {
      shape._repelled = false;
      settle(shape);
    });
  });
}

/*
  사진 테이프 떼기 인터랙션 (스티커를 떼는 것처럼 모서리가 접혀 넘어감)
  - 테이프 모서리를 잡고 끌면 그 모서리가 접혀 넘어가며 뒷면이 보임
  - FOLD_LIMIT 이상 접은 채로 놓으면 마저 넘어가며 떨어지고, 덜 접었으면 다시 붙음
  - 테이프가 떨어질 때마다 사진이 처지고, 사진을 클릭하면 테이프가 다시 붙음
  되돌리려면 이 함수와 initScrollAnimations 안의 호출, style.css 의 .about-tape 설정을 지우면 됨
*/
const FOLD_LIMIT = 60; /* 모서리가 이만큼(캔버스 px) 이상 끌려 오면 놓았을 때 떨어져 나감 */

function initTapePeel() {
  const tapes = [...document.querySelectorAll('.about-tape')];
  const photo = document.querySelector('.about-photo__img');
  const removed = new Set();

  const droop = () => {
    const n = removed.size;
    gsap.to(photo, {
      rotation: n === 0 ? -8.35 : n === 1 ? -11.3 : -16.3,
      y: n === 0 ? 0 : n === 1 ? 4 : 22,
      transformOrigin: n === 1 ? '50% 0%' : '50% 12%',
      duration: 0.9,
      ease: 'elastic.out(1, 0.5)',
    });
  };

  tapes.forEach((tape) => {
    const body = tape.querySelector('.about-tape__rot');
    let W = 0;
    let H = 0;
    let rect = [];
    /* 크기는 아래 영역이 처음 보일 때 정해지므로(그 전에는 display:none), 쓸 때마다 새로 잼 */
    const measure = () => {
      W = body.offsetWidth;
      H = body.offsetHeight;
      rect = [
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: W, y: H },
        { x: 0, y: H },
      ];
    };
    measure();

    /* 접혀 넘어간 뒷면: 본체를 복제해서 접는 선 기준으로 뒤집어 그림 (그림자는 바깥 상자에 줌) */
    const flapWrap = document.createElement('div');
    flapWrap.className = 'about-tape__flapwrap';
    const flap = body.cloneNode(true);
    flap.classList.add('about-tape__flap');
    flapWrap.append(flap);
    tape.append(flapWrap);

    const state = { px: 0, py: 0 }; /* 끌려 온 모서리의 위치 */
    let corner = rect[0];
    let grab = null;

    const render = () => {
      const dx = state.px - corner.x;
      const dy = state.py - corner.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) {
        body.style.clipPath = '';
        flap.style.clipPath = 'polygon(0 0, 0 0, 0 0)';
        return;
      }
      const n = { x: dx / dist, y: dy / dist };
      const mid = { x: (corner.x + state.px) / 2, y: (corner.y + state.py) / 2 };
      const visible = clipByLine(rect, mid, n);
      const folded = clipByLine(rect, mid, { x: -n.x, y: -n.y });
      const k = 2 * (mid.x * n.x + mid.y * n.y);
      const th = (gsap.getProperty(body, 'rotation') * Math.PI) / 180;
      body.style.clipPath = toClip(visible);
      flap.style.clipPath = toClip(folded);
      flap.style.transformOrigin = '0 0';
      flap.style.transform =
        'translate(' + W / 2 + 'px, ' + H / 2 + 'px) rotate(' + th + 'rad) translate(' + -W / 2 + 'px, ' + -H / 2 + 'px) ' +
        'matrix(' + (1 - 2 * n.x * n.x) + ', ' + -2 * n.x * n.y + ', ' + -2 * n.x * n.y + ', ' + (1 - 2 * n.y * n.y) + ', ' + k * n.x + ', ' + k * n.y + ')';
    };

    const reset = () => {
      body.style.clipPath = '';
      flap.style.clipPath = 'polygon(0 0, 0 0, 0 0)';
    };
    reset();

    /* 포인터 위치를 본체(회전 전) 좌표로 변환 */
    const toLocal = (e) => {
      const r = body.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / scale;
      const dy = (e.clientY - (r.top + r.height / 2)) / scale;
      const th = (gsap.getProperty(body, 'rotation') * Math.PI) / 180;
      return {
        x: dx * Math.cos(th) + dy * Math.sin(th) + W / 2,
        y: -dx * Math.sin(th) + dy * Math.cos(th) + H / 2,
      };
    };

    tape.addEventListener('pointerdown', (e) => {
      if (removed.has(tape)) return;
      measure();
      tape.setPointerCapture(e.pointerId);
      grab = toLocal(e);
      corner = rect.reduce((best, c) => (Math.hypot(c.x - grab.x, c.y - grab.y) < Math.hypot(best.x - grab.x, best.y - grab.y) ? c : best));
      gsap.killTweensOf(state);
      state.px = corner.x;
      state.py = corner.y;
      tape.classList.add('is-peeling');
    });

    tape.addEventListener('pointermove', (e) => {
      if (!tape.classList.contains('is-peeling')) return;
      const q = toLocal(e);
      state.px = Math.max(0, Math.min(W, corner.x + (q.x - grab.x)));
      state.py = Math.max(0, Math.min(H, corner.y + (q.y - grab.y)));
      render();
    });

    const release = () => {
      if (!tape.classList.contains('is-peeling')) return;
      tape.classList.remove('is-peeling');
      const dist = Math.hypot(state.px - corner.x, state.py - corner.y);
      if (dist >= FOLD_LIMIT) {
        removed.add(tape);
        tape.style.pointerEvents = 'none';
        gsap.to(state, {
          px: W - corner.x,
          py: H - corner.y,
          duration: 0.5,
          ease: 'power2.in',
          onUpdate: render,
          onComplete: () => gsap.to(tape, { y: 40, opacity: 0, duration: 0.45, ease: 'power1.in' }),
        });
        droop();
      } else {
        gsap.to(state, { px: corner.x, py: corner.y, duration: 0.4, ease: 'back.out(1.7)', onUpdate: render, onComplete: reset });
      }
    };
    tape.addEventListener('pointerup', release);
    tape.addEventListener('pointercancel', release);

    tape._restore = () => {
      gsap.killTweensOf([state, tape]);
      removed.delete(tape);
      tape.style.pointerEvents = '';
      reset();
      gsap.fromTo(tape, { y: -90, rotation: 12, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.6)' });
    };
  });

  /* 사진을 클릭하면 떨어진 테이프가 다시 붙음 */
  photo.addEventListener('click', () => {
    if (!removed.size) return;
    tapes.forEach((tape) => tape._restore());
    droop();
  });
}

/*
  헤더 색 맞추기: About Me 구간에서는 헤더가 흰 종이/크림색 종이 위에 올라가므로 글자색을 검정으로 바꿈
  - 로고: 왼쪽 흰 종이 위로 올라가면 검정 로고
  - 메뉴: 오른쪽 크림색 종이 위로 올라가면 검정 글씨 (그 전까지는 검은 배경이라 흰색)
*/
const HEADER_LOGO_ON_PAPER = 3140; /* 이 디자인 좌표(y)보다 아래에서는 로고가 흰 종이 위 */
const HEADER_MENU_ON_PAPER = 3290; /* 이 디자인 좌표(y)보다 아래에서는 메뉴가 크림색 종이 위 */

function updateHeaderTone() {
  if (!fold.turned) {
    header.classList.remove('is-logo-dark');
    return;
  }
  const afterTop = SHEET_HEIGHT + window.innerHeight / scale;
  const y = afterTop + (window.scrollY + 35 * scale - after.offsetTop) / scale; /* 헤더 가운데 높이가 가리키는 디자인 y */
  header.classList.toggle('is-logo-dark', y > HEADER_LOGO_ON_PAPER);
  header.classList.toggle('is-light', y <= HEADER_MENU_ON_PAPER);
}

function initHeaderTone() {
  window.addEventListener('scroll', updateHeaderTone, { passive: true });
  window.addEventListener('resize', updateHeaderTone);
}

function initScrollAnimations() {
  initPhilosophyColor();
  initFoldInteraction();
  initProjectShortcut();
  initProjectHover();
  initFooterRepel();
  initTapePeel();
  initHeaderTone();
  renderFold();
}

fitStage();
initScrollAnimations();
