/**
 * @file test/combine-config.js
 * @author leeight
 */

var expect = require('expect.js');

var CombineConfig = require('../src/combine-config');

describe('CombineConfig', function () {
    function createCompiler(allModules) {
        return {
            getAllModules: function () {
                return allModules;
            }
        };
    }

    it('empty', function () {
        var compiler = createCompiler([
            'er/main',
            'esui/main',
            'etpl/main',
            'underscore'
        ]);
        var moduleId = 'app';
        var config = new CombineConfig(null, compiler.getAllModules(), moduleId);
        expect(config._patterns).to.eql([]);
        expect(config._includes).to.eql({});
        expect(config._excludes).to.eql({exports: true, module: true, require: true});
    });

    it('default', function () {
        var combineConfig = {
            files: [
                '!jquery',
                'esui/main',
                'er/main'
            ]
        };
        var compiler = createCompiler([
            'er/main',
            'esui/main',
            'etpl/main',
            'underscore'
        ]);
        var moduleId = 'app';
        var config = new CombineConfig(combineConfig, compiler.getAllModules(), moduleId);
        expect(config._patterns).to.eql(['!jquery', 'esui/main', 'er/main']);
        expect(config.isIncluded('er/main')).to.be(true);
        expect(config.isIncluded('esui/main')).to.be(true);
        expect(config._excludes).to.eql({exports: true, module: true, require: true});

        var combineConfig2 = {
            include: [
                'esui/main',
                'er/main'
            ],
            exclude: [
                'jquery'
            ]
        };
        var config2 = new CombineConfig(combineConfig2, compiler.getAllModules(), moduleId);
        expect(config2._patterns).to.eql(['esui/main', 'er/main', '!jquery']);
        expect(config2.isIncluded('er/main')).to.be(true);
        expect(config2.isIncluded('esui/main')).to.be(true);
        expect(config2._excludes).to.eql({exports: true, module: true, require: true});
    });

    it('exclude and include 1', function () {
        var combineConfig = {
            files: [
                '!er',
                '!er/**',
                'er/main',
                'er/View'
            ]
        };
        var compiler = createCompiler([
            'er/main', 'er/View', 'er/controller', 'er/google',
            'er/baidu', 'er'
        ]);
        var moduleId = 'app';
        var config = new CombineConfig(combineConfig, compiler.getAllModules(), moduleId);
        expect(config._patterns).to.eql(['!er', '!er/**', 'er/main', 'er/View']);
        expect(config.isIncluded('er/View')).to.be(true);
        expect(config.isIncluded('er/main')).to.be(true);
        expect(config._excludes).to.eql({
            'er': true,
            'er/baidu': true,
            'er/controller': true,
            'er/google': true,
            'exports': true,
            'module': true,
            'require': true
        });
    });

    it('exclude and include 2', function () {
        var combineConfig = {
            files: [
                '!er',
                'er/main',
                '!er/**',
                'er/View'
            ]
        };
        var compiler = createCompiler([
            'er/main', 'er/View', 'er/controller', 'er/google',
            'er/baidu', 'er'
        ]);
        var moduleId = 'app';
        var config = new CombineConfig(combineConfig, compiler.getAllModules(), moduleId);
        expect(config._patterns).to.eql(['!er', 'er/main', '!er/**', 'er/View']);
        expect(config.isIncluded('er/View')).to.be(true);
        expect(config.isIncluded('er/main')).to.be(false);
        expect(config.isIncluded('er/google')).to.be(false);
        expect(config.isExcluded('er/google')).to.be(true);
        expect(config._excludes).to.eql({
            'er': true,
            'er/controller': true,
            'er/baidu': true,
            'er/main': true,
            'er/google': true,
            'exports': true,
            'module': true,
            'require': true
        });
    });
});









