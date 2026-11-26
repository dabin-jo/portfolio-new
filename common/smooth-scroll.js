'use strict';

/*
  부드러운 스크롤 (Lenis)
  - 마우스 휠을 굴리면 한 번에 뚝 움직이지 않고 관성이 붙어서 미끄러지듯 이동
  - GSAP ScrollTrigger 와 같은 타이밍으로 움직이도록 연결
  되돌리려면 각 html 의 <script src="smooth-scroll.js"> 와 lenis 줄만 지우면 됨
*/
const SMOOTH_DURATION = 1.1; /* 클수록 더 오래 미끄러짐 (초) */

if (window.Lenis && window.gsap) {
  const lenis = new Lenis({
    duration: SMOOTH_DURATION,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    /* 줄이 넘쳐서 안에서 스크롤되는 입력칸(메시지)에서만 휠을 입력칸에 양보. 넘치지 않을 때까지 양보하면 그 자리에서만 스크롤이 뚝뚝 끊김 */
    prevent: (node) => node.tagName === 'TEXTAREA' && node.scrollHeight > node.clientHeight + 1,
  });
  window.lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
