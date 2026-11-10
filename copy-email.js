'use strict';

/*
  이메일 복사
  - 푸터의 이메일(data-copy 가 붙은 요소)을 누르면 주소가 클립보드에 복사됨 (링크가 아니라서 마우스를 올려도 주소 표시가 뜨지 않음)
  - 복사되면 이메일 옆에 "Copied!" 가 잠깐 나타남
  되돌리려면 이메일을 다시 <a href="mailto:..."> 로 바꾸고 각 html 의 copy-email.js / copy-email.css 줄을 지우면 됨
*/
const COPIED_SHOW_MS = 1600; /* 안내 문구가 떠 있는 시간(ms) */

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  /* http 로 열었을 때 등 clipboard API 를 못 쓰는 경우 */
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'copy-email__buffer';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    ok ? resolve() : reject(new Error('copy failed'));
  });
}

document.querySelectorAll('[data-copy]').forEach((link) => {
  const address = link.dataset.copy;
  let timer = 0;
  link.classList.add('copy-email');
  const copy = (e) => {
    e.preventDefault();
    copyText(address)
      .then(() => {
        link.classList.add('is-copied');
        clearTimeout(timer);
        timer = setTimeout(() => link.classList.remove('is-copied'), COPIED_SHOW_MS);
      })
      .catch(() => {});
  };
  link.addEventListener('click', copy);
  link.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') copy(e);
  });
});
