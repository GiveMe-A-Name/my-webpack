(function (graph) {
  function require(module) {
    function localRequire(relativePath) {
      return require(graph[module].dependencies[relativePath]);
    }
    var exports = {};
    (function (require, exports, code) {
      eval(code);
    })(localRequire, exports, graph[module].code);
    return exports;
  }
  require("/Users/xqx359157/Works/demo/my-webpack/src/code/index.js");
})({
  "/Users/xqx359157/Works/demo/my-webpack/src/code/index.js": {
    dependencies: {
      "./utils.js": {
        filepath: "/Users/xqx359157/Works/demo/my-webpack/src/code/utils.js",
        imported: ["add"],
      },
    },
    code: '"use strict";\n\nvar _utils = require("./utils.js");\n\nconsole.log((0, _utils.add)(1, 2));',
  },
  "/Users/xqx359157/Works/demo/my-webpack/src/code/utils.js": {
    dependencies: {},
    code: '"use strict";\n\nObject.defineProperty(exports, "__esModule", {\n  value: true\n});\nexports.add = add;\n\nfunction add(a, b) {\n  return a + b;\n}',
  },
});
