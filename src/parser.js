const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { transformFromAst } = require("@babel/core");
/**
 *
 * @param {string} path - file path
 */
function getAst(path) {
  // 读取入口文件
  const content = fs.readFileSync(path, "utf-8");
  // 将文件内容转为AST抽象语法树
  return parser.parse(content, {
    sourceType: "module",
  });
}

function getDependencies(ast, filename) {
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
}

function getExports(ast) {
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
}

function /**
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
}

function getCode(ast) {
  const { code } = transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });
  return code;
}

module.exports = {
  getAst,
  getDependencies,
  getExports,
  removeNeedlessExports,
  getCode,
};
