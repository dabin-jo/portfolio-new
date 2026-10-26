'use strict';

/* --------------------------------------------------------------------------
   1920px 기준 캔버스를 화면 폭에 맞춰 축소/확대
   -------------------------------------------------------------------------- */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 3120;

const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');

function fitStage() {
  const scale = viewport.clientWidth / BASE_WIDTH;
  stage.style.transform = `scale(${scale})`;
  viewport.style.height = `${BASE_HEIGHT * scale}px`;
}

window.addEventListener('resize', fitStage);
fitStage();
