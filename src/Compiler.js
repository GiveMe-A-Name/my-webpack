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
      ImportDeclaration({ node, scope }) {
        const dirname = path.dirname(filename);
        const filepath = path.join(dirname, node.source.value);
        const dependency = {
          filepath,
          imported: [],
        };
        traverse(
          node,
          {
            ImportSpecifier({ node }) {
              dependency.imported.push(node.imported.name);
            },
          },
          scope
        );
        dependencies[node.source.value] = dependency;
      },
    });
    return dependencies;
  },
  getExports(ast) {
    const exports = [];
    traverse(ast, {
      ExportNamedDeclaration({ node, scope }) {
        traverse(
          node,
          {
            ExportSpecifier({ node }) {
              exports.push(node.exported.name);
            },
            VariableDeclarator({ node }) {
              exports.push(node.id.name);
            },
            FunctionDeclaration({ node }) {
              exports.push(node.id.name);
            },
            ClassDeclaration({ node }) {
              exports.push(node.id.name);
            },
          },
          scope
        );
      },
    });
    return exports;
  },
  /**
   *
   * @param {*} ast
   * @param {Array<string>} imported
   */
  removeNeedlessExports(ast, imported) {
    traverse(ast, {
      ExportNamedDeclaration(path) {
        const { node, scope } = path;
        traverse(
          node,
          {
            ExportSpecifier(path) {
              const { node } = path;
              if (!imported.includes(node.exported.name)) {
                path.remove();
              }
            },
            VariableDeclarator(path) {
              const { node } = path;
              if (!imported.includes(node.id.name)) {
                path.remove();
              }
            },
            FunctionDeclaration(path) {
              const { node } = path;
              if (!imported.includes(node.id.name)) {
                path.remove();
              }
            },
            ClassDeclaration(path) {
              const { node } = path;
              if (!imported.includes(node.id.name)) {
                path.remove();
              }
            },
          },
          scope
        );
      },
    });
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
   * @param {string} module.path
   * @param {Array<*>} module.imported
   * @returns
   */
  build({ filepath, imported }) {
    const ast = Parser.getAst(filepath);
    const dependencies = Parser.getDependencies(ast, filepath);
    Parser.removeNeedlessExports(ast, imported);
    const code = Parser.getCode(ast);
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
