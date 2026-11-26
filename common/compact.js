/*
  모바일 판정 (head 에서 바로 실행: 첫 화면이 그려지기 전에 클래스를 붙여서 깜빡임을 막음)
  - 화면 폭이 MOBILE_MAX 이하이면 html 에 is-mobile 클래스를 붙이고 window.IS_MOBILE 을 true 로 함
  - 모바일은 피그마 phone 시안 전용 화면(#mobile, mobile.css, mobile.js), 그 위 폭은 기존 데스크톱 화면
  - 폭이 기준선을 넘나들면(예: 개발자 도구에서 창 크기를 바꿀 때) 새로고침해서 알맞은 화면으로 다시 시작함
*/
(function () {
  var MOBILE_MAX = 640;
  var mq = window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)');
  window.IS_MOBILE = mq.matches;
  if (mq.matches) document.documentElement.classList.add('is-mobile');
  var onChange = function () {
    location.reload();
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();
