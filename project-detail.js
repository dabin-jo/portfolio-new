'use strict';

gsap.registerPlugin(ScrollTrigger);

/* --------------------------------------------------------------------------
   1920px 기준 캔버스를 화면 폭에 맞춰 축소/확대
   -------------------------------------------------------------------------- */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 3655; /* Overview 가 길어지면 아래로 밀린 만큼(layoutShift) 더해짐 */
let layoutShift = 0;

const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');
const header = document.querySelector('.header');

let scale = 1;

function fitStage() {
  scale = viewport.clientWidth / BASE_WIDTH;
  gsap.set(stage, { scale, transformOrigin: '0 0' });
  document.documentElement.style.setProperty('--s', scale); /* 캔버스 밖 요소(확대 보기 닫기 버튼)도 같은 비율로 */
  gsap.set(header, { scale, transformOrigin: '0 0' }); /* 고정 헤더도 같은 비율로 */
  viewport.style.height = `${(BASE_HEIGHT + layoutShift) * scale}px`;
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
  header.classList.toggle('is-light', headerBottom >= FOOTER_TOP + layoutShift);
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
  - overview : Overview 설명 (문단 2개: 프로젝트 소개 / 배운 점)
  - info     : Info 표 (Period, Team, Role, Contribution, Tools, Link)
  - image : 맨 위 큰 이미지 경로 (파일이 아직 없으면 기본 이미지가 그대로 보임)
  이미지는 assets/pdf/main-번호.jpg 로 넣으면 바로 나옴 (Kooksoondang 은 지금 쓰는 01.jpg 유지)
*/
const PROJECTS = {
  '01': {
    title: '집메이트',
    tags: ['UXUI Design', 'App Design'],
    image: 'assets/pdf/main-01.jpg',
    overview: [
      '집메이트는 셀프 인테리어를 해보고 싶어도 어디서부터 시작해야 할지 몰라 망설이는 사람들을 위해, 완성된 결과보다 과정에 집중한 웹앱입니다. 사용자는 자신의 작업 과정을 기록하고 공유할 수 있으며, 실패했던 경험까지 함께 나누면서 피해야 할 방법이나 재료를 아끼는 방법 같은 실질적인 정보를 서로 주고받을 수 있습니다. 작업 후 남은 자재는 중고로 판매하거나 무료로 나눌 수 있고, 자신의 셀프 인테리어 경험을 강의로 만들어 판매할 수도 있습니다. 또한 무엇부터 해야 할지 모르는 사람들을 위해 AI 챗봇을 더해, 궁금한 점을 바로 물어보며 작업을 시작할 수 있도록 구성했습니다.',
      '이번 프로젝트에서 처음으로 PM을 맡게 되면서 일정 관리가 얼마나 어려운 일인지 새삼 느낄 수 있었습니다. 작업을 진행할수록 처음 기획보다 구현해야 할 페이지가 점점 늘어나 힘든 순간도 있었습니다. 그래도 팀원들과 UX와 UI를 두고 고민을 나누며 문제를 풀어가는 과정에서 좋은 디자인이 무엇인지 다시 생각해 볼 수 있었습니다. 또한 처음으로 React를 사용해 개발하고 브랜치를 나눠 작업하면서, 앱이 실제로 어떻게 구현되어 사용자에게 닿는지와 협업이 어떻게 이루어지는지를 직접 배울 수 있었습니다.',
    ],
    info: {
      period: '2026. 8 - 2026. 9',
      team: '4인 프로젝트',
      role: 'UX 기획, UI 디자인, 스타일 가이드 · 메인페이지 디자인 및 개발, 발표 자료 디자인',
      contribution: ['기획 25%', '디자인 30%', '개발 20%', '기획서 디자인 40%'],
      tools: ['Figma ·', 'Vercel ·', 'React ·', 'VS Code ·', 'Midjourney ·', 'Claude Code'],
      link: '#', /* 프로젝트 링크 주소 (없으면 Link 줄이 나오지 않음) */
    },
  },
  '02': {
    title: 'Kooksoondang',
    image: 'assets/pdf/01.jpg',
    overview: [
      '국순당은 100년의 역사를 가진 전통주 브랜드지만, 웹사이트는 2009년에 만들어진 이후 그대로 머물러 있었습니다. 그래서 모바일 환경에서도, 해외 사용자에게도 제대로 닿지 못하고 있었습니다. 저희는 막걸리가 해외에서 K-푸드로 주목받기 시작한 흐름에 맞춰, 해외 사용자들에게 한국 전통주를 알릴 수 있는 영문 웹사이트로 리뉴얼을 진행했습니다. ‘Tradition Meets Interactive Experience’를 콘셉트로, 전통이 무겁거나 어렵게 느껴지지 않도록 기존의 어두운 주황색을 밝은 톤으로 바꾸었습니다. 주막 문화도 유쾌한 손그림 캐릭터로 풀어내 젊고 친근한 분위기를 만드는 데 중점을 두었습니다. 또한 사용자들이 흥미를 잃지 않고 사이트를 더 둘러볼 수 있도록, 막걸리를 잘 모르는 외국인도 쉽게 자신의 취향을 알아갈 수 있는 테스트 페이지를 더했습니다.',
      '개인 작업을 할 때는 저만 스타일 가이드를 알고 있으면 됐고, 중간에 기획이 어그러져도 다시 돌아가 진행하면 큰 문제가 없었습니다. 하지만 팀으로 작업을 진행하다 보니 사소한 것 하나까지 세세하게 정하고, 기획이 흔들리지 않도록 처음부터 확실하게 잡고 가야 한다는 것을 새롭게 알게 되었습니다. 또한 마지막까지 일정이 빠듯했던 만큼, 일정이 미뤄지지 않도록 팀 프로젝트를 이끌어가는 방법에 대해서도 배울 수 있었습니다.',
    ],
    info: {
      period: '2026. 5 - 2026. 8',
      team: '5인 프로젝트',
      role: 'UX 기획, UI 디자인, 퍼블리싱',
      contribution: ['기획 30%', '디자인 40%', '일러스트 85%', '개발 20%'],
      tools: ['Figma ·', 'Adobe Illustrator ·', 'Clip Studio Paint ·', 'VS Code ·', 'Claude Code'],
      link: '#', /* 프로젝트 링크 주소 (없으면 Link 줄이 나오지 않음) */
    },
  },
  '03': {
    title: 'Haeit!',
    tags: ['UXUI Design', 'App Design'],
    image: 'assets/pdf/main-03.jpg',
    overview: [
      '해잇은 혼자 발표를 준비하면서 잘하고 있는지, 누구에게 피드백을 받아야 할지 몰라 막막함을 느끼는 사람들을 위해 기획한 스피치 연습 앱입니다. 비디오 피드백을 받은 사람들의 발표 불안이 줄어들었다는 연구를 바탕으로, 스스로 자신의 발표를 돌아보며 자신감을 키우는 방향으로 기획을 진행했습니다. 사용자는 발표 영상을 촬영해 불필요한 행동을 확인하고 시간을 맞춰가며 연습할 수 있으며, 녹음이나 영상, 대본을 올리면 AI에게 피드백을 받을 수 있습니다. 또한 나의 발표 타입을 알아보는 테스트와 데일리 챌린지, 같은 고민을 나눌 수 있는 익명 커뮤니티를 더해 꾸준히 연습할 수 있도록 구성했습니다.',
      '앱을 하나 기획하는 과정에서 아이콘, 컬러, 텍스트 크기, 레이아웃처럼 작은 요소 하나까지 신경 써야 한다는 점이 생각보다 어렵게 느껴졌습니다. 작업을 진행하며 필요한 페이지가 하나둘씩 늘어나는 것을 보면서, 처음부터 기능과 구조를 구체적으로 설계하는 것이 중요하다는 것을 알게 되었습니다. 또한 수익화까지 함께 고민하면서, 단순히 필요한 기능을 제공하는 것을 넘어 사용자가 다른 앱이 아닌 우리 앱을 계속 사용해야 할 이유를 만드는 것이 중요하다는 것을 배울 수 있었습니다.',
    ],
    info: {
      period: '2025. 5 - 2026. 10',
      team: '2인 프로젝트',
      role: '앱 기획, UX 정리, 디자인 컨셉 정의, 로고 · 캐릭터 디자인',
      contribution: ['기획 50%', '디자인 50%'],
      tools: ['Figma ·', 'Adobe Photoshop ·', 'Adobe Illustrator ·', 'Chat GPT'],
    },
  },
  '04': {
    title: '소소복담',
    tags: ['Branding Design', 'Graphic Design'],
    image: 'assets/pdf/main-04.jpg',
    overview: [
      '소소복담은 영양 결핍을 겪고 있는 GG세대를 위해 기획한 건강 도시락 브랜드입니다. 몸이 불편하거나 밖에 나가기 어려운 분들이 식사를 준비하는 수고를 조금이라도 덜고 집에서 편하게 건강을 챙길 수 있었으면 하는 마음에서, 도시락이 소포처럼 집으로 찾아간다는 콘셉트를 정하게 되었습니다. \'소소한 복을 담다\'라는 의미로 이름을 짓고, 로고에는 집 모양과 수저를 더해 따뜻한 집밥의 느낌을 표현했습니다. 안내책자에는 영양소가 부족할 때 나타나는 증상과 간단하게 해 먹을 수 있는 레시피 5가지, 지역 무료급식소와 급식 지원 사업, 자가진단서까지 실생활에 도움이 될 수 있는 내용을 담았습니다.',
      '이번 프로젝트는 브랜드의 기획부터 실행까지 전 과정을 처음으로 진행해 본 작업이었습니다. 작업 기간이 길어지면서 처음 정했던 방향에서 조금씩 벗어나는 순간들이 생겼습니다. 그럴 때마다 다시 기획 단계로 돌아가 확인하면서, 처음의 의도를 끝까지 유지하는 것이 생각보다 훨씬 중요하다는 것을 알게 되었습니다. 또한 기획한 내용을 디자인으로 옮기며 일부 아이디어를 덜어내게 되었는데, 이 과정에서 기획 단계부터 실제로 구현할 수 있는지를 함께 고민해야 한다는 것도 배울 수 있었습니다.',
    ],
    info: {
      period: '2025. 4 - 2025. 10',
      team: '2인 프로젝트',
      role: '프로젝트 기획, 로고 디자인, 안내책자 디자인, 굿즈 디자인',
      contribution: ['기획 50%', '디자인 70%'],
      tools: ['Adobe PhotoShop ·', 'Adobe Illustrator ·', 'Adobe InDesign'],
    },
  },
  '05': {
    title: 'AI와 디자인의 상관관계',
    tags: ['Editorial Design'],
    image: 'assets/pdf/main-05.jpg',
    overview: [
      'AI와 디자인의 상관관계는 디자인 분야에서 AI가 어떻게 활용되고 어떤 영향을 미치는지 다각도로 살펴보기 위해 만든 편집 디자인 책자입니다. AI의 기본 개념과 디자인 분야의 실제 활용 사례부터 장점과 단점, 저작권 침해 같은 악용 사례, 작가들을 보호하기 위한 AI 방지 필터까지 다뤘습니다. 이를 통해 기술을 사용할 때 윤리적인 고려가 왜 중요한지 담고자 했습니다. 디자인적으로는 AI라는 기계의 아직 정제되지 않은 모습을 표현하고 싶어, 실험적인 레이아웃과 타이포그래피로 작업했습니다. 독자가 책을 읽으며 AI를 알아가고, 디자인 분야에서의 AI 활용에 대해 함께 고민해 볼 수 있도록 하는 데 중점을 두었습니다.',
      '책을 만들면서 디자인과 AI가 앞으로 어떻게 접목될지 기대되면서도, 한편으로는 조금 두렵다는 생각이 들었습니다. 누구나 AI를 활용해 영상을 편집하고 포스터를 만들고 그림을 그릴 수 있는 시대가 된 만큼, 단순히 무언가를 만들어내는 능력만으로는 설명하기 어려운 디자이너만의 역할이 무엇인지 자연스럽게 고민하게 되었습니다. 이번 작업은 AI에 대해 알아보는 것을 넘어, 앞으로 디자인이 어떤 방향으로 나아가게 될지 생각해 보는 계기가 되었습니다.',
    ],
    info: {
      period: '2024. 11 - 2024. 12',
      team: '3인 프로젝트',
      role: '표지 디자인, 내지 ⅓ 디자인',
      contribution: ['기획 30%', '디자인 40%'],
      tools: ['Adobe Photoshop ·', 'Adobe Illustrator ·', 'Adobe InDesign'],
    },
  },
  '06': {
    title: '삼토 페스티벌',
    tags: ['Rebranding Design', 'Graphic Design'],
    image: 'assets/pdf/main-06.jpg',
    overview: [
      '삼토 페스티벌은 1964년부터 이어져 온 원주의 농업 축제로, 농업과 지역사회의 상생을 알리는 의미 있는 축제입니다. 하지만 원주시 지역축제 중 인지도가 가장 낮았습니다. 저희는 20~30대가 축제를 찾아올 이유를 만들기 위해, 채도 높은 컬러로 축제의 올드한 분위기를 벗어나고자 했습니다. 특산물인 복숭아, 쌀, 배와 축제의 근원인 흙은 핵심 그래픽으로 사용했습니다. 다양한 프로그램은 B급 감성의 손그림 일러스트를 활용한 카드뉴스로 풀어냈고, 무빙포스터와 메인 영상에는 사람과 동물이 함께 걸어가는 모습을 담아 도농상생의 의미를 표현했습니다. 또한 본도시락과 함께한 \'새참\' 세트 패키지와 뱃지, 키링 등의 굿즈도 제작했습니다.',
      '이번 프로젝트를 진행하면서 지역 축제에 더 관심을 갖게 되었고, 그 지역의 특성을 살리는 디자인이 무엇인지 깊이 고민해 볼 수 있었습니다. 또한 데스크 리서치를 통해 요즘 디자인 트렌드를 살펴보며, 젊은 세대가 다시 축제를 찾게 하려면 어떻게 다가가야 할지 생각해 볼 수 있는 시간이었습니다. 특산물과 흙처럼 그 지역에만 있는 요소를 그래픽으로 풀어내는 과정에서, 지역성이 곧 축제만의 차별점이 될 수 있다는 것을 알게 되었습니다.',
    ],
    info: {
      period: '2025. 5 - 2025. 11',
      team: '2인 프로젝트',
      role: '프로젝트 기획, 메인 · 서브 무빙 포스터 제작, 메인 패키지 디자인 및 굿즈 디자인',
      contribution: ['기획 50%', '디자인 60%'],
      tools: ['Adobe PhotoShop ·', 'Adobe Illustrator ·', 'Clip Studio Paint ·', 'Adobe After Effect'],
    },
  },
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

/* Info 표: 프로젝트 정보로 줄을 새로 만듦. link 가 없으면 Link 줄은 만들지 않음 */
function renderInfo(info) {
  const table = document.querySelector('.pd-info');
  const row = (label, value) => {
    const div = document.createElement('div');
    div.className = 'pd-info__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    if (Array.isArray(value)) {
      dd.className = 'pd-info__list';
      value.forEach((v) => dd.append(Object.assign(document.createElement('span'), { textContent: v })));
    } else if (value instanceof Node) {
      dd.append(value);
    } else {
      dd.textContent = value;
    }
    div.append(dt, dd);
    return div;
  };

  const rows = [
    row('Period', info.period),
    row('Team', info.team),
    row('Role', info.role),
    row('Contribution', info.contribution),
    row('Tools', info.tools),
  ];
  if (info.link) {
    const a = document.createElement('a');
    a.className = 'pd-link';
    a.href = info.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = 'Project Link<span>↗</span>';
    rows.push(row('Link', a));
  }
  table.replaceChildren(...rows);
}

function initProjectTitle() {
  /* 번호가 없거나 잘못되면 기본 프로젝트(Kooksoondang, 02) */
  let key = new URLSearchParams(location.search).get('project');
  if (!PROJECTS[key]) key = '02';
  initProjectNav(key);
  const project = PROJECTS[key];
  document.querySelector('.pd-title').textContent = project.title;
  document.title = project.title + ' | Project Detail';

  /* Info 표 */
  if (project.info) renderInfo(project.info);

  /* Overview 설명 */
  const overview = document.querySelector('.pd-overview');
  if (project.overview) {
    overview.replaceChildren(
      ...project.overview.map((text) => Object.assign(document.createElement('p'), { textContent: text }))
    );
  }

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

/*
  글이 길어지거나 표 줄 수가 달라지면 아래 내용의 위치를 맞춤 (Figma 간격 유지)
  - Overview 가 원래 디자인(160px)보다 길면 Info 와 그 아래를 같은 만큼 내림
  - Info 표가 6줄(256px)보다 짧으면 Details 와 그 아래를 짧아진 만큼 올림
*/
const OVERVIEW_BASE_HEIGHT = 160;
const INFO_BASE_HEIGHT = 256;

function applyLayoutShift() {
  const overview = document.querySelector('.pd-overview');
  const info = document.querySelector('.pd-info');
  const shiftInfo = Math.max(0, Math.round(overview.offsetHeight - OVERVIEW_BASE_HEIGHT));
  layoutShift = shiftInfo + Math.round(info.offsetHeight - INFO_BASE_HEIGHT); /* Details 이하가 움직이는 거리 */
  stage.style.setProperty('--shift', shiftInfo + 'px');
  stage.style.setProperty('--shift-below', layoutShift + 'px');
  stage.style.height = BASE_HEIGHT + layoutShift + 'px';
  fitStage();
}

function initInteractions() {
  initProjectTitle();
  applyLayoutShift();
  document.fonts.ready.then(applyLayoutShift);
  updateHeaderColor();
  initDetailsSlider();
}

fitStage();
initInteractions();
