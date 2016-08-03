/**
 * @file lib/combine-config.js
 * @author leeight
 */

var u = require('underscore');

var helper = require('./helper');

var UNKNOWN = 0;
var INCLUDE = 1;
var EXCLUDE = 2;

/**
 * 一个模块的 Include 和 Exclude 是这样子工作的
 * 1. 解析 foo.js，可以得到一个模块定义的集合，可以把数据结构简化为这个样子
 *    {
 *        excludes: ['id1', 'id2', 'id3'],
 *        modules: [
 *            {id: 'id1', includes: Array.<string>},
 *            {id: 'id2', includes: Array.<string>},
 *            {id: 'id3', includes: Array.<string>},
 *        ]
 *    }
 * 2. 在 module.conf 里面我们可以给 `id` 配置一些 `规则`，通过这些规则我们遍历一次 `所有的模块Id`，就可以
 *    知道这个模块Id 应该是 exclude 还是 include 的状态，例如：
 *    {
 *        "id1": { "modules": ["~er", "!esui/Button"] }
 *    }
 *    此时把得到的 includes 和 excludes 来合并一下
 * 3. 合并的规则是这样子的
 *    excludes 是两个数组简单的合并起来即可
 *    includes 只在入口阶段生效，递归的时候是不生效的(?)
 *
 * @constructor
 * @param {Object|*} config module.conf中的配置.
 * @param {Array.<string>} allModules 所有的模块Id列表.
 * @param {string} moduleId The module id.
 */
function CombineConfig(config, allModules, moduleId) {
    this._config = config;
    this._allModules = allModules;
    this._excludes = {
        require: true,
        module: true,
        exports: true
    };

    this._includes = {};
    this._patterns = [];

    this.prepare();
}

CombineConfig.prototype.prepare = function () {
    if (!this._config) {
        return;
    }

    // https://github.com/ecomfe/edp/issues/187
    // files模式 vs include+exclude模式
    var patterns = null;
    var modules = this._config.files || this._config.modules;
    if (!modules || !Array.isArray(modules)) {
        // 如果存在include和exclude，那么 modules = include.concat(exclude)
        var includeModulePatterns = u.flatten(this._config.include || []);
        var excludeModulePatterns = u.flatten(this._config.exclude || []);
        patterns = includeModulePatterns.concat(
            excludeModulePatterns.map(function (item) {
                return '!' + item;
            }));
    }
    else {
        patterns = u.flatten(modules);
    }

    this._patterns = patterns;

    // 初始化 this._includes 和 this._excludes 的内容
    for (var i = 0; i < this._allModules.length; i++) {
        this.getModuleStatus(this._allModules[i]);
    }
};

CombineConfig.prototype.getIncludes = function () {
    return Object.keys(this._includes);
};

CombineConfig.prototype.getModuleStatus = function (moduleId) {
    var match = UNKNOWN;

    for (var i = 0; i < this._patterns.length; i++) {
        var pattern = this._patterns[i];

        // 用 moduleId 在 patterns 里面走一遍，最终的结果要么是 exclude，要么是 include
        // 应该没有其它的结果了
        if (pattern[0] === '!') {
            pattern = pattern.substring(1);
            if ((match !== 2) && helper.satisfy(moduleId, pattern)) {
                this._excludes[moduleId] = true;
                delete this._includes[moduleId];
                match = EXCLUDE;
            }
        }
        else {
            // 如果当前已经处于 Match 的状态了，那么就不需要调用 helper.satisfy 进行检查了
            if ((match !== 1) && helper.satisfy(moduleId, pattern)) {
                this._includes[moduleId] = true;
                delete this._excludes[moduleId];
                match = INCLUDE;
            }
        }
    }

    return match;
};

/**
 * 判断一个外部模块是否需要被排除
 *
 * @param {string} moduleId 模块Id.
 * @return {boolean}
 */
CombineConfig.prototype.isExcluded = function (moduleId) {
    var rv = this._excludes[moduleId];
    if (rv != null) {
        return rv;
    }

    var status = this.getModuleStatus(moduleId);
    return status === EXCLUDE;
};

/**
 * 判断一个外部的模块是否需要被合并
 *
 * @param {string} moduleId 模块Id.
 * @return {boolean}
 */
CombineConfig.prototype.isIncluded = function (moduleId) {
    var rv = this._includes[moduleId];
    if (rv != null) {
        return rv;
    }

    var status = this.getModuleStatus(moduleId);
    return status === INCLUDE;
};

/**
 * 把一个模块加入到排除列表里面去，常见的情况是已经合并过代码了
 * 后续的递归处理就需要排除掉.
 *
 * @param {string} moduleId 模块Id.
 */
CombineConfig.prototype.addExclude = function (moduleId) {
    if (!this._excludes[moduleId]) {
        this._excludes[moduleId] = true;
    }
};

module.exports = CombineConfig;
