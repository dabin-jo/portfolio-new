'use strict';

/*
  페이지 전환 인터랙션
  - data-transition 이 붙은 링크를 누르면: 연두색 펜 선이 화면을 칠하며 덮음 → 다음 페이지로 이동
  - 다음 페이지가 열리면: 칠해진 상태에서 시작해 선이 걷히며 새 페이지가 드러남
  타이밍은 아래 숫자만 바꾸면 됨
*/
const TRANSITION_COVER = 0.85; /* 덮는 데 걸리는 시간(초) */
const TRANSITION_REVEAL = 0.95; /* 걷히는 데 걸리는 시간(초) */
const TRANSITION_KEY = 'pageTransition';

const transitionPath = document.querySelector('.transition__path');
let transitioning = false;

/*
  선 길이(strokeDashoffset)를 직접 움직임.
  GSAP 에 이 속성을 바로 맡기면 px 단위가 정수로 반올림돼서(1 → 0 으로 뚝 끊김) 부드럽게 안 칠해짐.
  그래서 숫자 하나(progress)만 GSAP 으로 움직이고, 그 값을 CSS 에 직접 넣음.
*/
const stroke = { offset: 1 };
function applyOffset() {
  transitionPath.style.strokeDashoffset = stroke.offset + 'px';
}
function resetOffset() {
  gsap.killTweensOf(stroke);
  transitionPath.style.strokeDashoffset = '';
}

function revealPage() {
  stroke.offset = 0;
  applyOffset();
  document.documentElement.classList.remove('is-transition-in');
  gsap.to(stroke, {
    offset: -1,
    duration: TRANSITION_REVEAL,
    ease: 'power2.inOut',
    delay: 0.1,
    onUpdate: applyOffset,
    onComplete: resetOffset,
  });
}

/*
  같은 페이지 안에서 하는 전환: 선이 화면을 덮으면 onCovered 를 실행하고(예: 화면 상태 바꾸기), 곧바로 걷힘
  다른 스크립트에서 window.pageTransition.run(함수) 로 부름
*/
function runInPage(onCovered) {
  if (transitioning) return;
  transitioning = true;
  stroke.offset = 1;
  applyOffset();
  gsap.to(stroke, {
    offset: 0,
    duration: TRANSITION_COVER,
    ease: 'power2.inOut',
    onUpdate: applyOffset,
    onComplete: () => {
      onCovered();
      /* 바뀐 화면이 그려진 다음 프레임부터 걷음 */
      requestAnimationFrame(() => {
        gsap.to(stroke, {
          offset: -1,
          duration: TRANSITION_REVEAL,
          ease: 'power2.inOut',
          delay: 0.1,
          onUpdate: applyOffset,
          onComplete: () => {
            resetOffset();
            transitioning = false;
          },
        });
      });
    },
  });
}
window.pageTransition = { run: runInPage };

function coverAndGo(url) {
  if (transitioning) return;
  transitioning = true;
  stroke.offset = 1;
  applyOffset();
  gsap.to(stroke, {
    offset: 0,
    duration: TRANSITION_COVER,
    ease: 'power2.inOut',
    onUpdate: applyOffset,
    onComplete: () => {
      try {
        sessionStorage.setItem(TRANSITION_KEY, '1');
      } catch (e) {
        /* 저장이 막혀 있어도 이동은 함 (새 페이지에서 걷히는 효과만 빠짐) */
      }
      location.href = url;
    },
  });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-transition]');
  if (!a || e.defaultPrevented) return;
  /* 새 탭으로 열기(Ctrl/Shift/가운데 클릭) 등은 그대로 둠 */
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || a.target === '_blank') return;
  e.preventDefault();
  coverAndGo(a.href);
});

/* 이동해 온 페이지: 화면이 모두 로드된 뒤에 걷기 시작 */
function startReveal() {
  let came = false;
  try {
    came = sessionStorage.getItem(TRANSITION_KEY) === '1';
    sessionStorage.removeItem(TRANSITION_KEY); /* 새로고침하면 다시 걷히지 않게 */
  } catch (e) {
    came = false;
  }
  if (!came) return;
  Promise.all([
    document.fonts.ready,
    new Promise((resolve) => (document.readyState === 'complete' ? resolve() : window.addEventListener('load', resolve))),
  ]).then(() => requestAnimationFrame(revealPage));
}

/* 뒤로 가기로 돌아왔을 때(캐시된 화면)는 덮여 있지 않은 상태로 되돌림 */
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    transitioning = false;
    resetOffset();
    document.documentElement.classList.remove('is-transition-in');
  }
});

startReveal();
