/**
 * @file lib/compiler.js
 * @author leeight
 */

var u = require('underscore');
var edp = require('edp-core');

var helper = require('./helper');
var CombineConfig = require('./combine-config');
var Module = require('./module');

/**
 * The Compiler
 *
 * @constructor
 * @param {Object} moduleConfig module.conf的路径.
 * @param {Object=} moduleCombineConfigs combine字段的内容.
 * @param {Object=} moduleMapConfigs map字段的内容.
 */
function Compiler(moduleConfig, moduleCombineConfigs, moduleMapConfigs) {
    this._moduleConfig = moduleConfig;
    this._moduleCombineConfigs = moduleCombineConfigs || this._moduleConfig.combine || {};
    this._moduleMapConfigs = helper.createKVSortedIndex(moduleMapConfigs, 1);

    u.each(this._moduleMapConfigs, function (item) {
        item.v = helper.createKVSortedIndex(item.v);
    });

    this._idToFileMap = {};

    /**
     * 二维数组.
     * @type {Array.<Array.<string>>}
     */
    this._aliasModules = [];

    /**
     * key 是 module id
     * value 是 _aliasModules 的 index
     * @type {Object.<string, number>}
     */
    this._aliasModulesMap = {};

    /**
     * 缓存模块的定义信息.
     * @type {Object.<string, ModuleDefinition>}
     */
    this._moduleDefinitions = {};
}

Compiler.prototype.getAllModules = function () {
    return Object.keys(this._idToFileMap);
};

/**
 * 如果这个模块在 module.conf 里面配置了 combine 的信息，那么
 * 通过这个接口就可以获取对应的 CombineConfig 的实例.
 *
 * @param {string} moduleId 模块的Id
 * @return {?CombineConfig}
 */
Compiler.prototype.getCombineConfig = function (moduleId) {
    var bundleConfig = this._moduleCombineConfigs[moduleId];
    if (!bundleConfig) {
        // 如果配置了 "x": false 或者 "x": 0 的情况，那么也就不要合并了.
        return null;
    }

    return new CombineConfig(bundleConfig, this.getAllModules(), moduleId);
};

Compiler.prototype.getModuleDefinition = function (moduleId) {
    var definition = this._moduleDefinitions[moduleId];
    if (definition != null) {
        return definition;
    }

    var file = this._idToFileMap[moduleId];
    // TODO Handle aliased module id
    if (!file || !file.contents) {
        throw new Error('Get code failed, moduleId = ' + moduleId);
    }

    var code = file.contents.toString();
    var ast = edp.amd.getAst(code);
    if (!ast) {
        throw new Error('Parse code failed, moduleId = ' + moduleId);
    }

    var defs = edp.amd.analyseModule(ast) || [];
    if (!Array.isArray(defs)) {
        defs = [defs];
    }

    /**
     * 『包』的定义信息.
     * 从 module.conf 解析出来的 package 的配置信息
     * 并不是所有的模块都会有这个信息，例如：
     * 解析 dep/er/3.1.0-beta.6/src/main.js 的时候可以有这个配置信息，但是
     * 解析 dep/er/3.1.0-beta.6/src/ajax.js 的时候就没有了.
     */
    var pkgDef = null;

    if (defs.length === 1 && !defs[0].id) {
        // 说明这个文件只有一个匿名的模块.
        // 大部分时候都符合这个逻辑.
        // src/foo.js
        // define(function (require) { return {}; });
        pkgDef = this._getPackageDef(moduleId);
        defs[0].id = pkgDef ? pkgDef.module : moduleId;
    }
    else if (defs.length > 1) {
        // console.error('Multiple definitions are not supported, moduleId = ' + moduleId);
        // src/foo.js
        // define(function (require) { return {}; });
        // define('bar1', function (require) { return {}; });
        // define('bar2', function (require) { return {}; });
        //
        // 如果存在多个匿名的模块，说明是有问题的，对吧?
        // 这种情况比较少，先不处理了 (TODO)

        // 如果全部都是具名的模块，那么合并的时候，这些id应该被排除掉的，对吧?
    }

    definition = this._moduleDefinitions[moduleId] = {
        modDefs: defs,
        pkgDef: pkgDef,
        ast: ast
    };

    return definition;
};

/**
 * 检查一下当前处理的文件是否需要进行合并的操作。这里的 moduleIds 一般情况下
 * 应该只有一项，如果有2项的话，可能是一个 package 的 入口模块，或者因为定义了 path alias 导致的
 *
 * @param {Array.<string>} moduleIds The module ids.
 * @return {boolean}
 */
Compiler.prototype.shouldCombine = function (moduleIds) {
    var combineConfig = this._moduleCombineConfigs;

    for (var i = 0; i < moduleIds.length; i++) {
        var moduleId = moduleIds[i];
        if (combineConfig[moduleId]) {
            return true;
        }
    }

    return false;
};

/**
 * 不合并文件，只是把 deps 提取出来而已，但是对于 package 的主模块
 *
 * @param {string} moduleId 需要处理的模块ID.
 * @return {string}
 */
Compiler.prototype.toSingle = function (moduleId) {
    var module = new Module(moduleId, this);
    return module.toBundle();
};

Compiler.prototype.toPackage = function (moduleId) {
    var combineConfig = new CombineConfig({
        modules: ['!**/*', '~' + moduleId]
    }, this.getAllModules(), moduleId);
    return this.toBundle(moduleId, combineConfig);
};

Compiler.prototype.toBundle = function (moduleId, combineConfig) {
    var module = new Module(moduleId, this, combineConfig);
    return module.toBundle();
};

Compiler.prototype.getCombinedModules = function () {
    return Object.keys(this._moduleCombineConfigs);
};

/**
 * Register Module Ids
 *
 * @param {Array.<string>} moduleIds The module ids.
 * @param {File} file The file.
 */
Compiler.prototype.registerModuleIds = function (moduleIds, file) {
    for (var i = 0; i < moduleIds.length; i++) {
        this._idToFileMap[moduleIds[i]] = file;
    }
    if (moduleIds.length > 1) {
        this.addToAliasMap(moduleIds);
    }
};

Compiler.prototype.getFileByModuleId = function (moduleId) {
    return this._idToFileMap[moduleId];
};

/**
 * 根据 map 的配置，返回新的 depId（如果有的话），如果没有，返回
 * 参数中的 depId
 *
 * @param {string} moduleId 模块Id.
 * @param {string} depId 模块所依赖的模块Id.
 * @return {string}
 */
Compiler.prototype.getXXX = function (moduleId, depId) {
    for (var i = 0; i < this._moduleMapConfigs.length; i++) {
        var item = this._moduleMapConfigs[i];
        if (!item.reg.test(moduleId)) {
            continue;
        }

        var value = item.v;
        for (var j = 0; j < value.length; j++) {
            if (value[j].reg.test(depId)) {
                return depId.replace(value[j].k, value[j].v);
            }
        }
    }

    return depId;
};

/**
 * 记录一下项目中重名的模块
 * [
 *   [],
 *   []
 * ],
 * {
 *   "id1": 0,
 *   "id2": 0
 * }
 *
 * @param {Array.<string>} moduleIds 重名的模块数组列表.
 */
Compiler.prototype.addToAliasMap = function (moduleIds) {
    var found = false;
    moduleIds.forEach(function (moduleId) {
        found = found || (this._aliasModulesMap[moduleId] != null);
    }, this);

    if (!found) {
        this._aliasModules.push(moduleIds);
        var value = this._aliasModules.length - 1;
        moduleIds.forEach(function (moduleId) {
            this._aliasModulesMap[moduleId] = value;
        }, this);
    }
};

/**
 * Compiler初始化的时候会遍历项目中所有的模块，同时记录下具有别名的模块信息
 * 后续输出代码的时候，如果需要输出别名，就调用这个函数查询一下.
 *
 * @param {string} moduleId 模块的Id.
 * @return {?Array.<string>} 模块的别名，如果没有的话，返回null.
 */
Compiler.prototype.getModuleIdAlias = function (moduleId) {
    var value = this._aliasModulesMap[moduleId];
    if (value == null) {
        return null;
    }

    return this._aliasModules[value];
};

/**
 * Get the package definition
 *
 * @private
 * @param {string} moduleId 模块的Id.
 * @return {?Object}
 */
Compiler.prototype._getPackageDef = function (moduleId) {
    var pkgDef = helper.getPackageInfo(moduleId, this._moduleConfig);
    return pkgDef;
};

/**
 * 根据 defs 和 ast 的信息生成最终的代码.
 *
 * @param {ModuleDefinition} definition 模块的定义信息.
 * @return {string}
 */
Compiler.prototype.generateCode = function (definition) {
    var defs = definition.modDefs;
    var ast = definition.ast;
    return helper.generateModuleCode(defs, ast);
};

module.exports = Compiler;
