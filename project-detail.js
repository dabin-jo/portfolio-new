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
  document.documentElement.style.setProperty('--s', scale); /* 캔버스 밖 요소(확대 보기 닫기 버튼)도 같은 비율로 */
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

/*
  Details 이미지 확대 보기
  - 이미지를 클릭하면 화면 가운데에 크게 뜸
  - 닫기: 바깥(어두운 곳) 클릭, 오른쪽 위 × 버튼, Esc 키
  - 이미지가 들어가면(<img>) 그 이미지가, 아직 회색 상자면 회색 상자가 커짐
*/
const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.innerHTML = '<button class="lightbox__close" type="button" aria-label="닫기"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M0.4 0.4L19.6 19.6M19.6 0.4L0.4 19.6"/></svg></button><div class="lightbox__frame"></div>';
document.body.append(lightbox);
const lightboxFrame = lightbox.querySelector('.lightbox__frame');
let lightboxOpen = false;

function openLightbox(item) {
  const img = item.querySelector('img');
  lightboxFrame.replaceChildren();
  if (img) {
    const big = new Image();
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    lightboxFrame.append(big);
  }
  lightboxOpen = true;
  lightbox.classList.add('is-open');
  gsap.fromTo(lightbox, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' });
  gsap.fromTo(lightboxFrame, { scale: 0.92, y: 20 }, { scale: 1, y: 0, duration: 0.4, ease: 'power3.out' });
}

function closeLightbox() {
  if (!lightboxOpen) return;
  lightboxOpen = false;
  gsap.to(lightbox, {
    opacity: 0,
    duration: 0.2,
    ease: 'power1.in',
    onComplete: () => lightbox.classList.remove('is-open'),
  });
}

lightbox.addEventListener('click', (e) => {
  if (e.target === lightboxFrame || lightboxFrame.contains(e.target)) return;
  closeLightbox();
});
lightbox.querySelector('.lightbox__close').addEventListener('click', closeLightbox);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});
/* 열려 있는 동안 뒤 페이지가 스크롤되지 않게 */
lightbox.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
lightbox.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

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
  let dragDistance = 0; /* 이만큼 움직였으면 클릭이 아니라 드래그 */

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
    dragDistance = 0;
    lastTime = performance.now();
    details.classList.add('dragging');
    details.setPointerCapture(e.pointerId);
  });

  details.addEventListener('pointermove', (e) => {
    if (!active) return;
    dragDistance = Math.max(dragDistance, Math.abs(e.clientX - startPointer));
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

    /* 거의 움직이지 않고 놓았다면 클릭: 그 위치의 이미지를 크게 보여줌 */
    if (dragDistance < 6) {
      const item = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pd-details__item');
      if (item) openLightbox(item);
    }
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

/*
  프로젝트별 제목: 메인 페이지에서 그림을 누르면 주소 뒤에 ?project=번호 가 붙어서 넘어옴.
  번호는 프로젝트 페이지의 01~06 번호와 같음.
*/
/*
  각 프로젝트 정보
  - title : 제목
  - tags  : 제목 아래 작은 분류 (없으면 HTML 기본값)
  - image : 맨 위 큰 이미지 경로 (파일이 아직 없으면 기본 이미지가 그대로 보임)
  이미지는 assets/pdf/main-번호.jpg 로 넣으면 바로 나옴 (Kooksoondang 은 지금 쓰는 01.jpg 유지)
*/
const PROJECTS = {
  '01': { title: '집메이트', tags: ['UXUI Design', 'App Design'], image: 'assets/pdf/main-01.jpg' },
  '02': { title: 'Kooksoondang', image: 'assets/pdf/01.jpg' },
  '03': { title: 'Haeit!', tags: ['UXUI Design', 'App Design'], image: 'assets/pdf/main-03.jpg' },
  '04': { title: '소소복담', tags: ['Branding Design', 'Graphic Design'], image: 'assets/pdf/main-04.jpg' },
  '05': { title: 'AI와 디자인의 상관관계', tags: ['Editorial Design'], image: 'assets/pdf/main-05.jpg' },
  '06': { title: '삼토 페스티벌', tags: ['Rebranding Design', 'Graphic Design'], image: 'assets/pdf/main-06.jpg' },
};

/* 이전 / 다음 프로젝트: 01 → 06 순서로 돌고, 맨 끝에서는 처음으로 (순환). 글씨는 프로젝트 이름 */
function initProjectNav(key) {
  const keys = Object.keys(PROJECTS);
  const i = keys.indexOf(key);
  const prevKey = keys[(i - 1 + keys.length) % keys.length];
  const nextKey = keys[(i + 1) % keys.length];
  const prev = document.getElementById('prevProject');
  const next = document.getElementById('nextProject');

  prev.href = `project-detail.html?project=${prevKey}`;
  prev.lastElementChild.textContent = PROJECTS[prevKey].title;
  next.href = `project-detail.html?project=${nextKey}`;
  next.firstElementChild.textContent = PROJECTS[nextKey].title;
}

function initProjectTitle() {
  /* 번호가 없거나 잘못되면 기본 프로젝트(Kooksoondang, 02) */
  let key = new URLSearchParams(location.search).get('project');
  if (!PROJECTS[key]) key = '02';
  initProjectNav(key);
  const project = PROJECTS[key];
  if (key === '02' && !new URLSearchParams(location.search).get('project')) return; /* 기본 화면은 HTML 그대로 */ /* 번호가 없거나 잘못되면 HTML에 적힌 기본 제목 그대로 */
  document.querySelector('.pd-title').textContent = project.title;
  document.title = project.title + ' | Project Detail';

  /* 맨 위 큰 이미지: 파일이 실제로 있을 때만 바꿈 (없으면 기존 이미지 유지) */
  const photo = document.querySelector('.pd-visual__photo');
  photo.alt = project.title;
  if (project.image) {
    const probe = new Image();
    probe.onload = () => {
      photo.src = project.image;
    };
    probe.src = project.image;
  }

  /* 제목 아래 작은 분류: 항목 사이에 · 를 끼워 넣음. tags 가 없으면(Kooksoondang) HTML 기본값 유지 */
  if (project.tags) {
    const box = document.querySelector('.pd-tags');
    box.replaceChildren();
    project.tags.forEach((tag, i) => {
      if (i > 0) box.append(Object.assign(document.createElement('p'), { textContent: '·' }));
      box.append(Object.assign(document.createElement('p'), { textContent: tag }));
    });
  }
}

function initInteractions() {
  initProjectTitle();
  updateHeaderColor();
  initDetailsSlider();
}

fitStage();
initInteractions();
