(function () {
  try {
    var pref = localStorage.getItem('theme');
    var dark =
      pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    /* ignore */
  }
})();
