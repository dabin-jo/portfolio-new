'use strict';

/*
  링크 호버 형광펜
  - 헤더 메뉴, 푸터 메뉴(Project, About Me, Contact, Home …), 푸터 이메일, 이전/다음 프로젝트 링크에 마우스를 올리면
    글자 뒤에 연두색 사각 형광펜이 왼쪽에서 오른쪽으로 칠해지고, 호버할 때마다 무작위로 살짝 기울어짐
  - 마우스를 내리면 왼쪽부터 지워지며 걷힘
  - 어두운 배경(푸터, 프로젝트 페이지 위의 흰색 헤더)에서는 글자색이 검정으로 바뀜 (link-hover.css)

  덜컹거리지 않게: 크기(scale)나 기준점을 바꾸지 않고, 보이는 영역(clip-path)만 움직임.
  지우는 도중에 다시 올리면 새로 만들지 않고 지금 상태에서 이어서 칠함.
*/
const HIGHLIGHT_DRAW = 0.4; /* 칠해지는 시간(초) */
const HIGHLIGHT_ERASE = 0.3; /* 걷히는 시간(초) */
const TILT_MIN = 0.8; /* 기울어지는 각도(deg): 호버할 때마다 이 사이에서 무작위로, 방향(좌우)도 무작위 */
const TILT_MAX = 2.4;

function setupLinkHover(link) {
  link.classList.add('hover-host');
  let hl = null; /* 형광펜 요소 */
  /* 보이는 영역: 왼쪽에서 l%, 오른쪽에서 r% 만큼 잘라 냄 (l=0, r=100 이면 아무것도 안 보임) */
  const area = { l: 0, r: 100 };
  const apply = () => {
    if (hl) hl.style.clipPath = `inset(0 ${area.r}% 0 ${area.l}%)`;
  };

  link.addEventListener('mouseenter', () => {
    gsap.killTweensOf(area);
    if (!hl) {
      /* 글자 뒤로 가도록 링크의 맨 앞에 넣음 */
      hl = document.createElement('span');
      hl.className = 'hover-highlight';
      const tilt = (TILT_MIN + Math.random() * (TILT_MAX - TILT_MIN)) * (Math.random() < 0.5 ? -1 : 1);
      hl.style.transform = `rotate(${tilt}deg)`;
      link.prepend(hl);
      area.l = 0;
      area.r = 100;
      apply();
    }
    /* 지금 상태(처음이면 빈 상태, 지우는 중이면 그 상태)에서 끝까지 칠함 */
    gsap.to(area, { l: 0, r: 0, duration: HIGHLIGHT_DRAW, ease: 'power2.out', onUpdate: apply });
  });

  link.addEventListener('mouseleave', () => {
    if (!hl) return;
    gsap.killTweensOf(area);
    const el = hl;
    /* 칠해진 부분의 오른쪽 끝까지 왼쪽 가장자리를 밀어서 지움 */
    gsap.to(area, {
      l: 100 - area.r,
      duration: HIGHLIGHT_ERASE,
      ease: 'power2.inOut',
      onUpdate: apply,
      onComplete: () => {
        el.remove();
        if (hl === el) hl = null;
      },
    });
  });
}

document.querySelectorAll('.header__menu a, .pd-footer__menu a, .site-footer__menu a, .pd-footer__mail, .site-footer__mail, .ct-footer__menu a, .ct-footer__mail, .pd-move').forEach(setupLinkHover);
