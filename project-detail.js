'use strict';

gsap.registerPlugin(ScrollTrigger);

/* --------------------------------------------------------------------------
   1920px 기준 캔버스를 화면 폭에 맞춰 축소/확대
   -------------------------------------------------------------------------- */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 3655;

const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');

let scale = 1;

function fitStage() {
  scale = viewport.clientWidth / BASE_WIDTH;
  gsap.set(stage, { scale, transformOrigin: '0 0' });
  viewport.style.height = `${BASE_HEIGHT * scale}px`;
  ScrollTrigger.refresh();
}

window.addEventListener('resize', fitStage);

/* --------------------------------------------------------------------------
   인터랙션 (여기에 gsap / ScrollTrigger 코드를 추가)
   - #visual     : 메인 이미지
   - #details    : Details 이미지 목록, #detailsTrack 이 가로로 이어지는 줄
   - #footer     : 푸터
   -------------------------------------------------------------------------- */
const visual = document.getElementById('visual');
const details = document.getElementById('details');
const detailsTrack = document.getElementById('detailsTrack');

function initInteractions() {
  /* 예) gsap.from(visual, { y: 60, opacity: 0, scrollTrigger: { trigger: visual, start: 'top 80%' } }); */
}

fitStage();
initInteractions();
