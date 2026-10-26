/**
 * 把语音识别出的文字塞进第三方网页的输入框。
 *
 * ⚠️ 为什么不能直接改 `el.value`：
 * Bing / DeepSeek / 豆包 的输入框都是 React 或 Vue 的**受控组件**，
 * 直接赋值只改了 DOM，框架内部的状态没变，一敲键盘或者一点发送，内容就回到原来的值。
 * 正确做法是让浏览器自己"输入"这段字 —— `document.execCommand('insertText')`
 * 会走一遍真实的输入流程并派发 input 事件，框架的 onChange 才收得到。
 * 万一它不可用（有些页面禁用了 execCommand），再退回到「原生 value setter + 手动派发 input 事件」。
 *
 * ⚠️ 为什么按"位置 + 面积"挑输入框而不是写死选择器：
 * 这几个站点的 DOM 结构经常改，写死选择器过一阵就失效。
 * 所以先按已知选择器给个优先级，再用可见性与面积打分，挑最像聊天框的那个。
 */
export function fillInputScript(text: string): string {
  /*
   * 文本里可能有引号、换行、emoji，必须走 JSON 转义。
   * U+2028 / U+2029 是 JS 字符串字面量里的行分隔符，直接嵌进代码会断行 ——
   * 这里用字符码构造它们（源码里不出现这两个不可见字符，免得以后被编辑器"修"掉），
   * 再替换成转义写法交给 JS 引擎。
   */
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  const literal = JSON.stringify(text)
    .split(LS)
    .join('\\u2028')
    .split(PS)
    .join('\\u2029');

  return `(function(){
  var text = ${literal};
  function pick(){
    var sels = [
      'textarea#sb_form_q',
      'input#sb_form_q',
      'textarea[name="q"]',
      'input[name="q"]',
      'textarea',
      'div[contenteditable="true"]',
      'input[type="text"]',
      'input[type="search"]'
    ];
    var best = null, bestScore = -1;
    for (var i = 0; i < sels.length; i++) {
      var list = document.querySelectorAll(sels[i]);
      for (var j = 0; j < list.length; j++) {
        var el = list[j];
        var r = el.getBoundingClientRect();
        if (r.width < 60 || r.height < 18) continue;
        var st = window.getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
        // 打分：选择器优先级最高，其次面积；聊天框通常在页面下半部分（再加点分）
        var score = (sels.length - i) * 1000
                  + (r.width * r.height) / 1000
                  + (r.top > window.innerHeight * 0.35 ? 400 : 0);
        if (score > bestScore) { bestScore = score; best = el; }
      }
    }
    return best;
  }
  var el = pick();
  if (!el) {
    window.ReactNativeWebView.postMessage('__voice_nofield__');
    return;
  }
  try { el.focus(); } catch (e) {}
  var ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
  if (!ok) {
    try {
      var proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, (el.value || '') + text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      ok = true;
    } catch (e) { ok = false; }
  }
  window.ReactNativeWebView.postMessage(ok ? '__voice_ok__' : '__voice_fail__');
})();`;
}
