const fs = require("fs");
const path = require("path");
const {
  getAst,
  getDependencies,
  removeNeedlessExports,
  getCode,
} = require("./parser");
class Compiler {
  /**
   *
   * @param {Object} options
   * @param {string} options.entry
   */
  constructor(options) {
    const { entry, output } = options;
    this.entry = path.resolve(__dirname, "..", entry);
    this.output = output;
    this.modules = [];
  }

  run() {
    const entryModule = {
      filepath: this.entry,
      imported: [],
    };
    const info = this.build(entryModule);
    // 将入口info推到modules中
    // 包括 filename, dependencies, code 字段
    this.modules.push(info);
    this.modules.forEach(({ dependencies }) => {
      if (dependencies) {
        for (const dependency in dependencies) {
          this.modules.push(this.build(dependencies[dependency]));
        }
      }
    });
    // 生成依赖关系图
    const dependencyGraph = this.modules.reduce((graph, item) => {
      return {
        ...graph,
        [item.filepath]: {
          dependencies: item.dependencies,
          code: item.code,
        },
      };
    }, {});
    // console.log(dependencyGraph);
    this.generate(dependencyGraph);
  }

  /**
   *
   * @param {object} module
   * @param {string} module.filepath
   * @param {Array<*>} module.imported
   * @returns
   */
  build({ filepath, imported }) {
    const ast = getAst(filepath);
    const dependencies = getDependencies(ast, filepath);
    removeNeedlessExports(ast, imported);
    const code = getCode(ast);
    return {
      code,
      filepath,
      dependencies,
    };
  }

  generate(graph) {
    const filepath = path.join(this.output.path, this.output.filename);
    const bundle = `(function(graph) {
      function require(module) {
        function localRequire(relativePath) {
          return require(graph[module].dependencies[relativePath].filepath)
        }
        var exports = {};
        (function(require, exports, code) {
          eval(code)
        })(localRequire, exports, graph[module].code);
        return exports;
      }
      require('${this.entry}');
    })(${JSON.stringify(graph)});`;
    if (!fs.existsSync(this.output.path)) {
      fs.mkdirSync(this.output.path);
    }
    fs.writeFileSync(filepath, bundle, "utf-8");
  }
}

module.exports = Compiler;
