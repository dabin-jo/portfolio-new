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
const sheet = document.getElementById('sheet');
const shelf = document.getElementById('shelf');
const foldFlap = document.getElementById('foldFlap');

let scale = 1;
let holdStart = 0; /* 화면 고정이 시작되는 스크롤 위치(px) */

function fitStage() {
  scale = viewport.clientWidth / BASE_WIDTH;
  gsap.set(stage, { scale, transformOrigin: '0 0' });

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

  ScrollTrigger.refresh();
}

window.addEventListener('resize', fitStage);

/* --------------------------------------------------------------------------
   1단계: 철학 문장이 회색에서 검정으로 (스크롤)
   -------------------------------------------------------------------------- */
const TEXT_GRAY = '#efefef';
const TEXT_BLACK = '#0c0c0c';

/* 글자 하나하나를 <span class="char">로 감쌈 (공백은 그대로 둠) */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const chars = [];
  for (const ch of text) {
    if (ch === ' ') {
      el.appendChild(document.createTextNode(ch));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = ch;
    el.appendChild(span);
    chars.push(span);
  }
  return chars;
}

/*
  스크롤을 내리면 회색 글씨가 앞에서부터 차례로 검정색으로 바뀜.
  다 검정이 될 때까지는 CSS sticky로 브라우저가 화면을 붙잡아 둠.
  다 검정이 되면 종이 모서리가 접히며 나타남(2단계).
*/
function initPhilosophyColor() {
  const chars = gsap.utils.toArray('.phil').flatMap(splitChars);

  gsap.fromTo(
    chars,
    { color: TEXT_GRAY },
    {
      color: TEXT_BLACK,
      ease: 'none',
      duration: 0.1,
      stagger: { amount: 0.9 },
      scrollTrigger: {
        trigger: viewport,
        start: () => holdStart,
        end: () => holdStart + COLOR_HOLD,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => onColorProgress(self.progress),
      },
    }
  );
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
function showFold() {
  fold.shown = true;
  animateFold(FOLD_REST, 1.1, 'power3.out');
}

/* 스크롤을 되돌리면 접힌 모서리와 넘어간 페이지를 원래대로 */
function resetFold() {
  fold.shown = false;
  fold.turned = false;
  sheet.style.visibility = '';
  foldFlap.style.visibility = '';
  animateFold(CORNER, 0.5, 'power2.inOut');
}

/* 페이지를 넘긴 뒤에는 이만큼 이상 위로 스크롤해야 철학 페이지로 돌아감 (1 = 맨 끝, 0.5 = 절반 거리) */
const RETURN_PROGRESS = 0.5;
/* 접힌 모서리만 보이는 상태에서 되돌아가는 기준 */
const UNFOLD_PROGRESS = 0.9;

function onColorProgress(progress) {
  if (progress >= 0.999 && !fold.shown && !fold.turned) showFold();
  else if (fold.turned && progress < RETURN_PROGRESS) resetFold();
  else if (fold.shown && !fold.turned && progress < UNFOLD_PROGRESS) resetFold();
}

/* 페이지 넘김: 종이가 완전히 넘어감 */
function turnPage() {
  animateFold(FOLD_END, 0.9, 'power2.inOut', () => {
    fold.turned = true;
    sheet.style.visibility = 'hidden';
    foldFlap.style.visibility = 'hidden';
  });
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

function initScrollAnimations() {
  initPhilosophyColor();
  initFoldInteraction();
  renderFold();
}

fitStage();
initScrollAnimations();
