const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { transformFromAst } = require("@babel/core");

const Parser = {
  /**
   *
   * @param {string} path - file path
   */
  getAst(path) {
    // 读取入口文件
    const content = fs.readFileSync(path, "utf-8");
    // 将文件内容转为AST抽象语法树
    return parser.parse(content, {
      sourceType: "module",
    });
  },
  getDependencies(ast, filename) {
    const dependencies = {};
    traverse(ast, {
      ImportDeclaration({ node }) {
        const dirname = path.dirname(filename);
        const filepath = path.join(dirname, node.source.value);
        dependencies[node.source.value] = filepath;
      },
    });
    return dependencies;
  },
  getCode(ast) {
    const { code } = transformFromAst(ast, null, {
      presets: ["@babel/preset-env"],
    });
    return code;
  },
};

class Compiler {
  /**
   *
   * @param {Object} options
   * @param {string} options.entry
   */
  constructor(options) {
    const { entry, output } = options;
    this.entry = path.resolve(__dirname, entry);
    this.output = output;
    this.modules = [];
  }

  run() {
    const info = this.build(this.entry);
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
    const dependencyGraph = this.modules.reduce(
      (graph, item) => ({
        ...graph,
        [item.filename]: {
          dependencies: item.dependencies,
          code: item.code,
        },
      }),
      {}
    );
    // console.log(dependencyGraph);
    /*
    {
      '/Users/home/Works/demo/my-webpack/src/code/index.js': {
        dependencies: {
          './utils.js': '/home/Works/demo/my-webpack/src/code/utils.js'
        },
        code: '"use strict";\n' +
          '\n' +
          'var _utils = _interopRequireDefault(require("./utils.js"));\n' +
          '\n' +
          'function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }'
      },
      '/Users/home/Works/demo/my-webpack/src/code/utils.js': { dependencies: {}, code: '"use strict";' }
    }
    */
    this.generate(dependencyGraph);
  }

  build(filename) {
    const ast = Parser.getAst(filename);
    const dependencies = Parser.getDependencies(ast, filename);
    const code = Parser.getCode(ast);
    return {
      filename,
      dependencies,
      code,
    };
  }

  generate(graph) {
    const filepath = path.join(this.output.path, this.output.filename);
    const bundle = `(function(graph) {
      function require(module) {
        function localRequire(relativePath) {
          return require(graph[module].dependencies[relativePath])
        }
        var exports = {};
        (function(require, exports, code) {
          eval(code)
        })(localRequire, exports, graph[module].code);
        return exports;
      }
      require('${this.entry}');
    })(${JSON.stringify(graph)});`;
    fs.writeFileSync(filepath, bundle, "utf-8");
  }
}

module.exports = Compiler;
