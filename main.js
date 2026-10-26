'use strict';

gsap.registerPlugin(ScrollTrigger);

/* --------------------------------------------------------------------------
   1920px 기준 캔버스를 화면 폭에 맞춰 축소/확대
   -------------------------------------------------------------------------- */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 3120;

/* 철학 문장이 다 검정이 될 때까지 화면을 붙잡아 두는 스크롤 거리(px) */
const PHILOSOPHY_HOLD = 1400;

const viewport = document.getElementById('viewport');
const stageSticky = document.getElementById('stageSticky');
const stage = document.getElementById('stage');

/* 철학 첫 문장(.phil-1)이 화면 위에서 30% 지점에 올 때까지 내려간 스크롤 거리 */
const PHILOSOPHY_TOP = 1320;
const PHILOSOPHY_ANCHOR = 0.3;

let scale = 1;
let holdStart = 0;

function fitStage() {
  scale = viewport.clientWidth / BASE_WIDTH;
  gsap.set(stage, { scale, transformOrigin: '0 0' });

  /* 화면 폭에 맞춰 줄어든 캔버스 높이만큼 sticky 막대 높이를 잡음 */
  stageSticky.style.height = `${BASE_HEIGHT * scale}px`;
  viewport.style.height = `${BASE_HEIGHT * scale + PHILOSOPHY_HOLD}px`;

  /* 이 지점까지는 정상 스크롤, 이후 PHILOSOPHY_HOLD 동안 화면 고정 */
  holdStart = Math.max(0, PHILOSOPHY_TOP * scale - window.innerHeight * PHILOSOPHY_ANCHOR);
  stageSticky.style.top = `${-holdStart}px`;

  ScrollTrigger.refresh();
}

window.addEventListener('resize', fitStage);

/* --------------------------------------------------------------------------
   스크롤 인터랙션
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
  철학 문장: 스크롤을 내리면 회색 글씨가 앞에서부터 차례로 검정색으로 바뀜.
  글씨가 다 검정이 될 때까지는 화면이 아래로 넘어가지 않도록,
  CSS sticky로 브라우저가 직접 화면을 붙잡아 둠 (스크롤과 어긋나는 덜컹거림이 없음).
*/
function initPhilosophyColor() {
  const chars = gsap.utils.toArray('.phil').flatMap(splitChars);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: viewport,
      start: () => holdStart,
      end: () => holdStart + PHILOSOPHY_HOLD,
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  tl.fromTo(
    chars,
    { color: TEXT_GRAY },
    { color: TEXT_BLACK, duration: 0.1, stagger: { amount: 0.9 } },
    0
  );
}

function initScrollAnimations() {
  initPhilosophyColor();
}

fitStage();
initScrollAnimations();
