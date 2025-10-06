/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/csprng";
exports.ids = ["vendor-chunks/csprng"];
exports.modules = {

/***/ "(rsc)/./node_modules/csprng/lib/csprng.js":
/*!*******************************************!*\
  !*** ./node_modules/csprng/lib/csprng.js ***!
  \*******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("var DEFAULT_BITS  = 128,\n    DEFAULT_RADIX = 16,\n    DIGITS        = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');\n\nvar crypto = __webpack_require__(/*! crypto */ \"crypto\"),\n    Seq    = __webpack_require__(/*! sequin */ \"(rsc)/./node_modules/sequin/lib/sequin.js\");\n\nvar rand = function(bits, radix) {\n  bits  = bits  || DEFAULT_BITS;\n  radix = radix || DEFAULT_RADIX;\n\n  if (radix < 2 || radix > 36)\n    throw new Error('radix argument must be between 2 and 36');\n\n  var length  = Math.ceil(bits * Math.log(2) / Math.log(radix)),\n      entropy = crypto.randomBytes(bits),\n      stream  = new Seq(entropy),\n      string  = '';\n\n  while (string.length < length)\n    string += DIGITS[stream.generate(radix)];\n\n  return string;\n};\n\nmodule.exports = rand;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvY3Nwcm5nL2xpYi9jc3BybmcuanMiLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBOztBQUVBLGFBQWEsbUJBQU8sQ0FBQyxzQkFBUTtBQUM3QixhQUFhLG1CQUFPLENBQUMseURBQVE7O0FBRTdCO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSIsInNvdXJjZXMiOlsiL1VzZXJzL25lem9iZW5hcmRpL0FJX3N0dWZmL09uYm9hcmRpbmdQb3J0YWwvbm9kZV9tb2R1bGVzL2NzcHJuZy9saWIvY3Nwcm5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbInZhciBERUZBVUxUX0JJVFMgID0gMTI4LFxuICAgIERFRkFVTFRfUkFESVggPSAxNixcbiAgICBESUdJVFMgICAgICAgID0gJzAxMjM0NTY3ODlhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5eicuc3BsaXQoJycpO1xuXG52YXIgY3J5cHRvID0gcmVxdWlyZSgnY3J5cHRvJyksXG4gICAgU2VxICAgID0gcmVxdWlyZSgnc2VxdWluJyk7XG5cbnZhciByYW5kID0gZnVuY3Rpb24oYml0cywgcmFkaXgpIHtcbiAgYml0cyAgPSBiaXRzICB8fCBERUZBVUxUX0JJVFM7XG4gIHJhZGl4ID0gcmFkaXggfHwgREVGQVVMVF9SQURJWDtcblxuICBpZiAocmFkaXggPCAyIHx8IHJhZGl4ID4gMzYpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdyYWRpeCBhcmd1bWVudCBtdXN0IGJlIGJldHdlZW4gMiBhbmQgMzYnKTtcblxuICB2YXIgbGVuZ3RoICA9IE1hdGguY2VpbChiaXRzICogTWF0aC5sb2coMikgLyBNYXRoLmxvZyhyYWRpeCkpLFxuICAgICAgZW50cm9weSA9IGNyeXB0by5yYW5kb21CeXRlcyhiaXRzKSxcbiAgICAgIHN0cmVhbSAgPSBuZXcgU2VxKGVudHJvcHkpLFxuICAgICAgc3RyaW5nICA9ICcnO1xuXG4gIHdoaWxlIChzdHJpbmcubGVuZ3RoIDwgbGVuZ3RoKVxuICAgIHN0cmluZyArPSBESUdJVFNbc3RyZWFtLmdlbmVyYXRlKHJhZGl4KV07XG5cbiAgcmV0dXJuIHN0cmluZztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZDtcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/csprng/lib/csprng.js\n");

/***/ })

};
;