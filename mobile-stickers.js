'use strict';

/*
  모바일 푸터 스티커 떼기 (연락처·프로젝트 상세 페이지 공용. 메인 페이지는 mobile.js 에 같은 동작이 따로 있음)
  - 모서리를 잡고 끌면 접혀 넘어가며 하얀 뒷면이 보이고, 충분히 접어 놓으면 아래로 떨어져 사라짐. 덜 접었으면 다시 붙음
  - 끌지 않고 그냥 눌러도 접혀 떨어지고, 5초 뒤 위에서 다시 내려와 붙음
  - 사용: initMobileFooterStickers('.스티커 선택자', () => 캔버스 배율)
  - 뒷면 모양은 CSS 의 .ct-sticker__flap 규칙 (mobile-contact.css, mobile-detail.css)
*/
/* 다각형을 직선 한쪽만 남기고 자름 (main.js 와 같은 계산). 남기는 쪽: (X - M)·n >= 0 */
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

const STICKER_FOLD_LIMIT = 28; /* 이만큼(캔버스 px) 이상 접어서 놓으면 떨어져 나감 */
const STICKER_CLICK_SLOP = 6; /* 이보다 적게 움직이고 놓으면 눌렀다고 봄 */
const STICKER_RETURN_MS = 5000; /* 떨어진 뒤 다시 붙기까지 */

function initMobileFooterStickers(selector, getScale) {
  document.querySelectorAll(selector).forEach((el) => {
    const body = el.querySelector('.rot');
    const NONE = 'polygon(0 0, 0 0, 0 0)';
    let W = 0;
    let H = 0;
    let rect = [];
    const measure = () => {
      W = body.offsetWidth;
      H = body.offsetHeight;
      rect = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    };
    measure();

    /* 접혀 넘어간 뒷면: 앞면을 복제해서 접는 선 기준으로 뒤집어 그림 */
    const flapWrap = document.createElement('div');
    flapWrap.className = 'ct-sticker__flapwrap';
    const flap = body.cloneNode(true);
    flap.classList.add('ct-sticker__flap');
    flapWrap.append(flap);
    el.append(flapWrap);

    const state = { px: 0, py: 0 };
    let corner = rect[0];
    let grab = null;
    let travel = 0;
    let gone = false;
    let returnTimer = 0;

    const linear = () => new DOMMatrix(getComputedStyle(body).transform);

    const render = () => {
      const dx = state.px - corner.x;
      const dy = state.py - corner.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5) {
        body.style.clipPath = '';
        flap.style.clipPath = NONE;
        return;
      }
      const n = { x: dx / dist, y: dy / dist };
      const mid = { x: (corner.x + state.px) / 2, y: (corner.y + state.py) / 2 };
      const visible = clipByLine(rect, mid, n);
      const folded = clipByLine(rect, mid, { x: -n.x, y: -n.y });
      const k = 2 * (mid.x * n.x + mid.y * n.y);
      const L = linear();
      body.style.clipPath = toClip(visible);
      flap.style.clipPath = toClip(folded);
      flap.style.transformOrigin = '0 0';
      flap.style.transform =
        'translate(' + W / 2 + 'px, ' + H / 2 + 'px) matrix(' + L.a + ', ' + L.b + ', ' + L.c + ', ' + L.d + ', 0, 0) translate(' + -W / 2 + 'px, ' + -H / 2 + 'px) ' +
        'matrix(' + (1 - 2 * n.x * n.x) + ', ' + -2 * n.x * n.y + ', ' + -2 * n.x * n.y + ', ' + (1 - 2 * n.y * n.y) + ', ' + k * n.x + ', ' + k * n.y + ')';
    };

    const reset = () => {
      body.style.clipPath = '';
      flap.style.clipPath = NONE;
    };
    reset();

    /* 포인터 위치를 본체(회전 전) 좌표로 변환 */
    const toLocal = (e) => {
      const r = body.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / getScale();
      const dy = (e.clientY - (r.top + r.height / 2)) / getScale();
      const inv = linear().inverse();
      return { x: inv.a * dx + inv.c * dy + W / 2, y: inv.b * dx + inv.d * dy + H / 2 };
    };

    const restore = () => {
      clearTimeout(returnTimer);
      gsap.killTweensOf([state, el]);
      gone = false;
      el.style.pointerEvents = '';
      reset();
      gsap.fromTo(el, { y: -90, rotation: 12, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.6)' });
    };

    el.addEventListener('pointerdown', (e) => {
      if (gone) return;
      measure();
      el.setPointerCapture(e.pointerId);
      grab = toLocal(e);
      travel = 0;
      corner = rect.reduce((best, c) => (Math.hypot(c.x - grab.x, c.y - grab.y) < Math.hypot(best.x - grab.x, best.y - grab.y) ? c : best));
      gsap.killTweensOf(state);
      state.px = corner.x;
      state.py = corner.y;
      el.classList.add('is-peeling');
    });

    el.addEventListener('pointermove', (e) => {
      if (!el.classList.contains('is-peeling')) return;
      const q = toLocal(e);
      travel = Math.max(travel, Math.hypot(q.x - grab.x, q.y - grab.y));
      state.px = Math.max(0, Math.min(W, corner.x + (q.x - grab.x)));
      state.py = Math.max(0, Math.min(H, corner.y + (q.y - grab.y)));
      render();
    });

    const release = () => {
      if (!el.classList.contains('is-peeling')) return;
      el.classList.remove('is-peeling');
      const dist = Math.hypot(state.px - corner.x, state.py - corner.y);
      const clicked = travel < STICKER_CLICK_SLOP;
      if (dist >= STICKER_FOLD_LIMIT || clicked) {
        gone = true;
        el.style.pointerEvents = 'none';
        gsap.to(state, {
          px: W - corner.x,
          py: H - corner.y,
          duration: clicked ? 0.7 : 0.5,
          ease: clicked ? 'power2.inOut' : 'power2.in',
          onUpdate: render,
          onComplete: () => gsap.to(el, { y: 40, opacity: 0, duration: 0.45, ease: 'power1.in' }),
        });
        returnTimer = setTimeout(restore, STICKER_RETURN_MS);
      } else {
        gsap.to(state, { px: corner.x, py: corner.y, duration: 0.4, ease: 'back.out(1.7)', onUpdate: render, onComplete: reset });
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('dragstart', (e) => e.preventDefault());
  });
}
