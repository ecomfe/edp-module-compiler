/**
 * @file lib/helper.js
 * @author leeight
 */

var edp = require('edp-core');
var escodegen = require('escodegen');
var estraverse = require('estraverse');

var SYNTAX = estraverse.Syntax;
var LITERAL_DEFINE = 'define';

// 以下代码来自于
// http://s1.bdstatic.com/r/www/cache/ecom/esl/2-0-6/esl.source.js

exports.satisfy = function (path, pattern, stat) {
    return edp.path.satisfy(path, pattern, stat);
};

exports.resolveModuleId = function (id, baseId) {
    return edp.amd.resolveModuleId(id, baseId);
};

exports.getModuleId = function (moduleFile, moduleConfigFile) {
    return edp.amd.getModuleId(moduleFile, moduleConfigFile);
};

/**
 * 将key为module id prefix的Object，生成数组形式的索引，并按照长度和字面排序
 *
 * @inner
 * @param {Object} value 源值
 * @param {boolean} allowAsterisk 是否允许*号表示匹配所有
 * @return {Array} 索引对象
 */
exports.createKVSortedIndex = function (value, allowAsterisk) {
    var index = exports.kv2List(value, 1, allowAsterisk);
    index.sort(descSorterByKOrName);
    return index;
};

/**
 * 将对象数据转换成数组，数组每项是带有k和v的Object
 *
 * @inner
 * @param {Object} source 对象数据
 * @param {boolean} keyMatchable key是否允许被前缀匹配
 * @param {boolean} allowAsterisk 是否支持*匹配所有
 * @return {Array.<Object>} 对象转换数组
 */
exports.kv2List = function (source, keyMatchable, allowAsterisk) {
    var list = [];
    if (!source) {
        return list;
    }

    for (var key in source) {
        if (source.hasOwnProperty(key)) {
            var item = {
                k: key,
                v: source[key]
            };
            list.push(item);

            if (keyMatchable) {
                item.reg = key === '*' && allowAsterisk
                    ? /^/
                    : createPrefixRegexp(key);
            }
        }
    }

    return list;
};

/**
 * 创建id前缀匹配的正则对象
 *
 * @inner
 * @param {string} prefix id前缀
 * @return {RegExp} 前缀匹配的正则对象
 */
function createPrefixRegexp(prefix) {
    return new RegExp('^' + prefix + '(/|$)');
}

/**
 * 根据元素的k或name项进行数组字符数逆序的排序函数
 *
 * @inner
 * @param {Object} a 要比较的对象a
 * @param {Object} b 要比较的对象b
 * @return {number} 比较结果
 */
function descSorterByKOrName(a, b) {
    var aValue = a.k || a.name;
    var bValue = b.k || b.name;

    if (bValue === '*') {
        return -1;
    }

    if (aValue === '*') {
        return 1;
    }

    return bValue.length - aValue.length;
}

/**
 * 获取模块id所属的package信息
 *
 * @param {string} moduleId 模块id
 * @param {Object} moduleConfig 模块配置文件
 * @return {Object}
 */
exports.getPackageInfo = function (moduleId, moduleConfig) {
    var packages = moduleConfig.packages || [];
    for (var i = 0; i < packages.length; i++) {
        var pkg = packages[i];
        var pkgName = pkg.name;
        var pkgMain = (pkg.main || 'main').replace(/\.js$/, '');
        var module = pkgName + '/' + pkgMain;

        // er || er/main 都应该被正常处理
        if (moduleId === pkgName || moduleId === module) {
            return {
                name: pkgName,
                location: pkg.location,
                main: pkgMain,
                module: pkgName + '/' + pkgMain
            };
        }
    }

    return null;
};

/**
 * 生成模块代码
 *
 * @param {Object|Array.<Object>} moduleInfo 模块信息，通常是analyseModule的返回结果
 * @param {...Object} sourceAst 源文件的AST
 * @return {string}
 */
exports.generateModuleCode = function (moduleInfo, sourceAst) {
    // 统一转化为数组

    if (!(moduleInfo instanceof Array)) {
        moduleInfo = [moduleInfo];
    }


    var ast;
    // 如果没有原始的ast
    // 则按照moduleInfo来生成代码
    if (!sourceAst) {
        ast = {
            type: SYNTAX.Program,
            body: []
        };

        moduleInfo.forEach(function (item) {
            ast.body.push({
                type: SYNTAX.ExpressionStatement,
                expression: generateModuleAst(item)
            });
        });
    }
    // 有原始ast
    // 则对原始ast中module定义的部分进行替换
    else {
        var i = 0;
        ast = estraverse.replace(sourceAst, {
            enter: function (node) {
                if (node.type === SYNTAX.CallExpression
                    && node.callee.name === LITERAL_DEFINE
                ) {
                    if (moduleInfo[i]) {
                        return generateModuleAst(moduleInfo[i++]);
                    }
                }
            }
        });
    }

    return escodegen.generate(ast);
};

function intersect(a, b) {
    var index = {};
    var result = [];
    var exists = {};

    a.forEach(function (item) {
        index[item] = 1;
    });

    b.forEach(function (item) {
        if (index[item] && !exists[item]) {
            result.push(item);
            exists[item] = 1;
        }
    });

    return result;
}

function subtract(a, b) {
    var index = {};
    b.forEach(function (item) {
        index[item] = 1;
    });

    var result = [];
    var exists = {};
    a.forEach(function (item) {
        if (!index[item] && !exists[item]) {
            result.push(item);
            exists[item] = 1;
        }
    });

    return result;
}

/**
 * 根据模块信息生成AST
 *
 * @param {Object} moduleInfo 模块信息，通常是analyseModule的返回结果
 * @return {Object}
 */
function generateModuleAst(moduleInfo) {
    var dependenciesExpr;
    var actualDependencies = moduleInfo.actualDependencies;
    var dependencies = (moduleInfo.dependencies || []).slice(0);

    if (actualDependencies instanceof Array) {
        dependenciesExpr = {
            type: SYNTAX.ArrayExpression,
            elements: []
        };

        var diffDependencies = subtract(
            actualDependencies,
            intersect(dependencies, actualDependencies)
        );
        dependencies.concat(diffDependencies).forEach(function (dependency) {
            dependenciesExpr.elements.push({
                type: SYNTAX.Literal,
                value: dependency,
                raw: '\'' + dependency + '\''
            });
        });
    }

    var defineArgs = [moduleInfo.factoryAst];
    if (dependenciesExpr) {
        defineArgs.unshift(dependenciesExpr);
    }
    var id = moduleInfo.id;
    if (id) {
        defineArgs.unshift({
            type: SYNTAX.Literal,
            value: moduleInfo.id,
            raw: '\'' + moduleInfo.id + '\''
        });
    }

    return {
        type: SYNTAX.CallExpression,
        callee: {
            type: SYNTAX.Identifier,
            name: LITERAL_DEFINE
        },
        arguments: defineArgs
    };
}
