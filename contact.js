'use strict';

gsap.registerPlugin(ScrollTrigger);

/* --------------------------------------------------------------------------
   1920px 기준 캔버스를 화면 폭에 맞춰 축소/확대
   -------------------------------------------------------------------------- */
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 2154;

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

/* 헤더가 어두운 푸터 위에 올라오면 흰색으로 */
const FOOTER_TOP = 1700; /* 푸터 도형이 시작되는 높이(캔버스 기준) */

function updateHeaderColor() {
  const headerBottom = (window.scrollY + (header.offsetHeight * scale) / 2) / scale;
  header.classList.toggle('is-light', headerBottom >= FOOTER_TOP);
}

window.addEventListener('scroll', updateHeaderColor, { passive: true });

/* --------------------------------------------------------------------------
   Form: 보내기를 누르면 입력한 내용이 Web3Forms 를 거쳐 바로 메일함으로 도착함
   - 이름, 회사, 이메일, 메시지는 꼭 써야 함 (포지션만 선택). 비어 있으면 그 칸으로 커서를 옮기고 안내를 띄움
   - 받는 메일 주소는 Web3Forms 에서 키를 만들 때 정한 주소 (jodabin9098@gmail.com)
   - 키를 바꾸려면 아래 ACCESS_KEY 만 바꾸면 됨
   -------------------------------------------------------------------------- */
const ACCESS_KEY = '2784913b-c5c4-452a-bdfa-a4c10b144951';
const SUBMIT_URL = 'https://api.web3forms.com/submit';

/* 모션 확인용 스위치: false 면 실제로 메일을 보내지 않고(서버 연결 끊음) 성공한 것처럼 접는 모션만 보여 줌. 실제로 보내려면 true 로 */
const SEND_FOR_REAL = true;

function initForm() {
  const form = document.getElementById('contactForm');
  const notice = document.getElementById('formError');
  const sendButton = form.querySelector('.ct-send');
  const sendLabel = sendButton.querySelector('.ct-send__label');
  const sendText = sendLabel.textContent;
  let noticeTimer = 0;
  let sending = false;

  const showNotice = (text, ms = 2600) => {
    notice.textContent = text;
    notice.classList.add('is-visible');
    clearTimeout(noticeTimer);
    if (ms) noticeTimer = setTimeout(() => notice.classList.remove('is-visible'), ms);
  };

  /* 칸마다 아래에 오류 안내 자리를 만들어 둠 (칸 아래에 떠서 다른 칸을 밀어내지 않음) */
  form.querySelectorAll('.ct-field').forEach((field) => {
    const msg = document.createElement('span');
    msg.className = 'ct-field__msg';
    msg.setAttribute('role', 'alert');
    field.append(msg);
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const EMAIL_BAD = '이메일 형식에 맞지 않아요. 예) name@example.com';

  /* 입력한 글씨의 너비를 재서 형광펜 길이를 정함 */
  const measureCtx = document.createElement('canvas').getContext('2d');
  const textWidth = (control) => {
    const cs = getComputedStyle(control);
    measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const spacing = parseFloat(cs.letterSpacing) || 0;
    return measureCtx.measureText(control.value).width + spacing * control.value.length;
  };

  /*
    칸의 상태: '' (평소) / 'error' (안내 문구와 함께 빨갛게) / 'valid' (형식에 맞게 씀: 체크 표시와 OK)
    - 쓰는 동안 형식이 맞으면 체크 표시(is-valid), 칸을 벗어나면 글씨 뒤에 형광펜이 칠해짐(is-done). 체크 표시는 그대로
  */
  const setState = (control, state, text) => {
    const field = control.closest('.ct-field');
    field.classList.toggle('is-error', state === 'error');
    field.classList.toggle('is-valid', state === 'valid');
    field.classList.remove('is-done');
    field.querySelector('.ct-field__msg').textContent = state === 'valid' ? 'OK' : state === 'error' ? text : '';
    if (state === 'valid') field.style.setProperty('--hl-w', `${textWidth(control)}px`);
  };

  /* 칸을 벗어남: 형식에 맞게 썼으면 OK 문구를 지우고 형광펜을 칠함 */
  const finish = (control) => {
    const field = control.closest('.ct-field');
    if (!field.classList.contains('is-valid')) return;
    field.querySelector('.ct-field__msg').textContent = '';
    field.classList.add('is-done');
  };

  const showError = (control, text) => {
    setState(control, 'error', text);
    control.focus();
  };

  
  /* 쓰는 동안: 해당 칸의 오류를 지우고, 이메일은 바로바로 형식을 검사해서 틀리면 그 자리에서 안내 */
  form.addEventListener('input', (e) => {
    if (sending) return;
    notice.classList.remove('is-visible');
    const control = e.target;
    const field = control.closest('.ct-field');
    if (!field) return;
    const value = control.value.trim();
    const wasDone = field.classList.contains('is-done'); /* 이미 형광펜이 칠해져 있었는지 */
    setState(control, '');

    if (control === form.elements.email && value) {
      const ok = EMAIL_RE.test(value);
      setState(control, ok ? 'valid' : 'error', EMAIL_BAD);
      /* 형광펜이 칠해진 뒤에 고치는 중이면 그대로 두고 길이만 따라감. 형식이 틀려지면 걷힘 */
      if (ok && wasDone) finish(control);
    } else if (HIGHLIGHT_ONLY.includes(control.name) && value && wasDone) {
      field.style.setProperty('--hl-w', `${textWidth(control)}px`);
      field.classList.add('is-done');
    }
    /* 글씨를 다 지워서 비면 위의 setState('') 로 형광펜도 같이 지워짐 */
  });

  /*
    칸을 벗어날 때
    - 이메일: 형식에 맞으면 형광펜 (체크 표시는 그대로), 틀리면 빨간 안내
    - 이름, 회사, 포지션: 뭐라도 썼으면 형광펜
    - 메시지는 여러 줄이라 형광펜 없음
  */
  const HIGHLIGHT_ONLY = ['name', 'company', 'position'];

  form.addEventListener('focusout', (e) => {
    const control = e.target;
    if (sending) return;
    const field = control.closest('.ct-field');
    if (!field) return;
    const value = control.value.trim();

    if (control.name === 'email') {
      if (!value) return setState(control, '');
      if (!EMAIL_RE.test(value)) return setState(control, 'error', EMAIL_BAD);
      setState(control, 'valid');
      return finish(control);
    }
    if (HIGHLIGHT_ONLY.includes(control.name) && value) {
      field.style.setProperty('--hl-w', `${textWidth(control)}px`);
      field.classList.add('is-done');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const v = (name) => form.elements[name].value.trim();

    if (!v('name')) return showError(form.elements.name, '이름을 입력해 주세요.');
    if (!v('company')) return showError(form.elements.company, '회사명을 입력해 주세요.');
    if (!v('email')) return showError(form.elements.email, '이메일을 입력해 주세요.');
    if (!EMAIL_RE.test(v('email'))) return showError(form.elements.email, EMAIL_BAD);
    if (!v('message')) return showError(form.elements.message, '남기고픈 내용을 작성해 주세요.');

    sending = true;
    sendButton.disabled = true;
    sendLabel.textContent = '보내는 중...';
    notice.classList.remove('is-visible');

    try {
      if (!SEND_FOR_REAL) await new Promise((resolve) => setTimeout(resolve, 600)); /* 보내는 중처럼 잠깐 기다림 */
      const res = SEND_FOR_REAL && await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `[포트폴리오 문의] ${v('name')}${v('company') ? ` (${v('company')})` : ''}`,
          from_name: v('name'),
          name: v('name'),
          email: v('email'),
          company: v('company'),
          position: v('position'),
          message: v('message'),
          botcheck: form.elements.botcheck.checked, /* 사람 눈에는 안 보이는 칸: 봇이 채우면 스팸으로 처리됨 */
        }),
      });
      if (SEND_FOR_REAL) {
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'failed');
      }
      form.reset();
      form.querySelectorAll('.ct-field input, .ct-field textarea').forEach((control) => setState(control, ''));
      showNotice('메일이 잘 도착했어요. 확인하고 답장드릴게요!', 6000);
    } catch (err) {
      showNotice(`메일을 보내지 못했어요. 잠시 뒤 다시 시도하거나 ${EMAIL_FALLBACK}로 보내 주세요.`, 8000);
    } finally {
      sending = false;
      sendButton.disabled = false;
      sendLabel.textContent = sendText;
    }
  });
}
const EMAIL_FALLBACK = 'jodabin9098@gmail.com';

/*
  푸터 종이 흔들기 (마우스 리펠 효과, 프로젝트 상세 페이지 푸터와 같음)
  - 종이는 각자 아래쪽(페이지 바닥 조금 아래)에 있는 한 점을 축으로 좌우로 흔들리는 추처럼 움직임
  - 마우스를 종이 가까이 가져가면 종이 위쪽이 마우스 반대쪽으로 기울고, 멀어지면 출렁이며 제자리로 돌아옴
  되돌리려면 이 함수와 아래 호출을 지우면 됨
*/
const REPEL_RADIUS = 750; /* 이 거리 안으로 마우스가 들어오면 반응 */
const REPEL_ROTATE = 2.4; /* 가장 세게 기울어질 때 각도(deg) */
const REPEL_PIVOT_BELOW = 100; /* 흔들림의 축: 페이지 맨 아래에서 이만큼 더 아래 */

function initFooterRepel() {
  const footer = document.getElementById('footer');
  const shapes = [...footer.querySelectorAll('.ct-footer__shape')];
  let frame = 0;
  let mouse = null;

  shapes.forEach((shape) => {
    gsap.set(shape, { transformOrigin: `50% ${BASE_HEIGHT - shape.offsetTop + REPEL_PIVOT_BELOW}px` });
  });

  const settle = (shape) => gsap.to(shape, { rotation: 0, duration: 1.4, ease: 'elastic.out(1, 0.3)', overwrite: true });

  function update() {
    frame = 0;
    if (!mouse) return;
    const baseY = stage.getBoundingClientRect().bottom - 250 * scale;
    shapes.forEach((shape) => {
      const r = shape.getBoundingClientRect();
      const vx = (r.left + r.width / 2 - mouse.x) / scale;
      const vy = (baseY - mouse.y) / scale;
      const influence = Math.max(0, 1 - Math.hypot(vx, vy) / REPEL_RADIUS);
      if (influence <= 0) {
        if (shape._repelled) {
          shape._repelled = false;
          settle(shape);
        }
        return;
      }
      shape._repelled = true;
      const side = Math.max(-1, Math.min(1, vx / 300));
      gsap.to(shape, { rotation: side * REPEL_ROTATE * influence, duration: 0.5, ease: 'power3.out', overwrite: true });
    });
  }

  window.addEventListener(
    'mousemove',
    (e) => {
      mouse = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true }
  );

  document.documentElement.addEventListener('mouseleave', () => {
    mouse = null;
    shapes.forEach((shape) => {
      shape._repelled = false;
      settle(shape);
    });
  });
}

fitStage();
updateHeaderColor();
initForm();
initFooterRepel();
