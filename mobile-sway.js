'use strict';

/*
  모바일 화면의 종이 흔들기 (PC 의 About Me 종이·푸터 종이와 같은 효과. 마우스를 쓸 때만 동작)
  - 종이는 각자 아래쪽의 한 점(pivotY)을 축으로 좌우로 흔들리는 추처럼 움직임
  - 마우스가 가까울수록 크게 기울고, 멀어지면 출렁이며 제자리로 돌아옴 (손가락 터치에서는 동작하지 않음)
  - 사용: initMobileSway({ frame, items, getScale, pivotY, baseY, radius, rotate })
      frame    : 좌표의 기준이 되는 요소(items 의 offsetLeft/Top 이 이 요소 기준이어야 함. 보통 items 의 offsetParent)
      items    : 흔들 종이 요소들 (바깥 요소를 돌림. 안쪽에 이미 기울기가 있어도 됨)
      getScale : () => 캔버스 배율
      pivotY   : 흔들림 축의 높이 (frame 좌표)
      baseY    : 마우스와의 거리를 재는 기준 높이 (frame 좌표)
      radius   : 이 거리(캔버스 px) 안으로 마우스가 들어오면 반응
      rotate   : 가장 세게 기울어질 때 각도(deg)
*/
function initMobileSway({ frame, items, getScale, pivotY, baseY, radius, rotate }) {
  const papers = items.filter(Boolean);
  if (!papers.length) return;
  let raf = 0;
  let mouse = null;

  papers.forEach((paper) => {
    gsap.set(paper, { transformOrigin: `50% ${pivotY - paper.offsetTop}px` });
  });

  const settle = (paper) => gsap.to(paper, { rotation: 0, duration: 1.6, ease: 'elastic.out(1, 0.3)', overwrite: true });

  function update() {
    raf = 0;
    if (!mouse) return;
    const r = frame.getBoundingClientRect();
    const scale = getScale();
    const mx = (mouse.x - r.left) / scale; /* 마우스의 캔버스 좌표 */
    const my = (mouse.y - r.top) / scale;
    papers.forEach((paper) => {
      const vx = paper.offsetLeft + paper.offsetWidth / 2 - mx;
      const vy = baseY - my;
      const influence = Math.max(0, 1 - Math.hypot(vx, vy) / radius); /* 가까울수록 세게 */
      if (influence <= 0) {
        if (paper._swayed) {
          paper._swayed = false;
          settle(paper);
        }
        return;
      }
      paper._swayed = true;
      const side = Math.max(-1, Math.min(1, vx / (radius * 0.38)));
      gsap.to(paper, { rotation: side * rotate * influence, duration: 0.6, ease: 'power3.out', overwrite: true });
    });
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(update);
    },
    { passive: true }
  );

  document.documentElement.addEventListener('mouseleave', () => {
    mouse = null;
    papers.forEach((paper) => {
      paper._swayed = false;
      settle(paper);
    });
  });
}
