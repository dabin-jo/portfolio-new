'use strict';

gsap.registerPlugin(ScrollTrigger);

/* --------------------------------------------------------------------------
   1920px 기준 캔버스를 화면 폭에 맞춰 축소/확대
   -------------------------------------------------------------------------- */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 3655;

const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');
const header = document.querySelector('.header');

let scale = 1;

function fitStage() {
  scale = viewport.clientWidth / BASE_WIDTH;
  gsap.set(stage, { scale, transformOrigin: '0 0' });
  gsap.set(header, { scale, transformOrigin: '0 0' }); /* 고정 헤더도 같은 비율로 */
  viewport.style.height = `${BASE_HEIGHT * scale}px`;
  ScrollTrigger.refresh();
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
   인터랙션 (여기에 gsap / ScrollTrigger 코드를 추가)
   - #visual     : 메인 이미지
   - #details    : Details 이미지 목록, #detailsTrack 이 가로로 이어지는 줄
   - #footer     : 푸터
   -------------------------------------------------------------------------- */
const visual = document.getElementById('visual');
const details = document.getElementById('details');
const detailsTrack = document.getElementById('detailsTrack');

/* 헤더가 어두운 푸터 위에 올라오면 흰색으로 */
const FOOTER_TOP = 3260; /* 푸터 도형이 시작되는 높이(캔버스 기준) */

function updateHeaderColor() {
  const headerBottom = (window.scrollY + header.offsetHeight * scale / 2) / scale;
  header.classList.toggle('is-light', headerBottom >= FOOTER_TOP);
}

window.addEventListener('scroll', updateHeaderColor, { passive: true });

/*
  Details 이미지 가로 넘기기
  - 마우스로 잡고 끌거나, 터치로 밀거나, 트랙패드 가로 스크롤로 넘김
  - 놓으면 가까운 위치에 딱 붙음 (처음 / 한 장씩 / 마지막 장 오른쪽 끝이 화면 오른쪽에서 60px)
*/
const DETAILS_ITEM_WIDTH = 856;
const DETAILS_GAP = 20;
const DETAILS_END_RIGHT = 1860; /* 마지막 이미지의 오른쪽 끝이 닿는 위치 (오른쪽 여백 60px) */

function initDetailsSlider() {
  const items = detailsTrack.children;
  const step = DETAILS_ITEM_WIDTH + DETAILS_GAP;
  const trackStart = 660; /* .pd-details__track 의 margin-left */
  const trackWidth = items.length * DETAILS_ITEM_WIDTH + (items.length - 1) * DETAILS_GAP;
  const minX = -(trackStart + trackWidth - DETAILS_END_RIGHT);
  const maxX = 0;

  /* 멈출 수 있는 위치: 처음, 한 장씩, 마지막 */
  const snaps = [];
  for (let x = 0; x > minX; x -= step) snaps.push(x);
  snaps.push(minX);

  const clamp = (v) => Math.max(minX, Math.min(maxX, v));
  const nearest = (v) => snaps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

  let x = 0;
  let startPointer = 0;
  let startX = 0;
  let velocity = 0;
  let lastPointer = 0;
  let lastTime = 0;
  let active = false;

  const set = (v) => {
    x = v;
    gsap.set(detailsTrack, { x });
  };

  const snapTo = (v) => gsap.to(detailsTrack, { x: v, duration: 0.7, ease: 'power3.out', onUpdate: () => { x = gsap.getProperty(detailsTrack, 'x'); } });

  details.addEventListener('pointerdown', (e) => {
    gsap.killTweensOf(detailsTrack);
    x = gsap.getProperty(detailsTrack, 'x');
    active = true;
    startPointer = lastPointer = e.clientX;
    startX = x;
    velocity = 0;
    lastTime = performance.now();
    details.classList.add('dragging');
    details.setPointerCapture(e.pointerId);
  });

  details.addEventListener('pointermove', (e) => {
    if (!active) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime);
    velocity = (e.clientX - lastPointer) / scale / dt; /* 캔버스 px / ms */
    lastPointer = e.clientX;
    lastTime = now;

    const raw = startX + (e.clientX - startPointer) / scale;
    /* 양 끝을 넘으면 살짝 저항이 걸리며 늘어남 */
    const over = raw > maxX ? raw - maxX : raw < minX ? raw - minX : 0;
    set(clamp(raw) + over * 0.25);
  });

  const release = (e) => {
    if (!active) return;
    active = false;
    details.classList.remove('dragging');
    if (details.hasPointerCapture(e.pointerId)) details.releasePointerCapture(e.pointerId);
    /* 던지듯 놓으면 그 방향으로 더 나아가서 멈춤 */
    snapTo(nearest(clamp(x + velocity * 350)));
  };
  details.addEventListener('pointerup', release);
  details.addEventListener('pointercancel', release);

  /* 트랙패드/마우스 가로 스크롤 */
  let wheelTimer = null;
  details.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; /* 세로 스크롤은 그대로 */
      e.preventDefault();
      gsap.killTweensOf(detailsTrack);
      x = gsap.getProperty(detailsTrack, 'x');
      set(clamp(x - e.deltaX / scale));
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => snapTo(nearest(x)), 140);
    },
    { passive: false }
  );
}

function initInteractions() {
  updateHeaderColor();
  initDetailsSlider();
}

fitStage();
initInteractions();
