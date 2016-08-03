/**
 * @file test/module.spec.js
 * @author leeight
 */

var expect = require('expect.js');

var Module = require('../src/module');
var Compiler = require('../src/compiler');

describe('Module', function () {
    function createFile(moduleId, deps) {
        var contents = deps
            ? new Buffer('define(' + JSON.stringify(deps) + ', function () { return "' + moduleId + '"});')
            : new Buffer('define(function () { return "' + moduleId + '"});');
        return {
            contents: contents
        };
    }

    it('default', function () {
        var moduleConfig = {};
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['er', 'er/main'], createFile('er'));
        compiler.registerModuleIds(['er/View'], createFile('er/View'));
        compiler.registerModuleIds(['er/controller'], createFile('er/controller'));
        compiler.registerModuleIds(['app'], createFile('app'));

        var app = new Module('app', compiler);
        expect(app.toBundle()).to.eql('define(\'app\', [], function () {\n    return \'app\';\n});');
    });

    it('explict include is supported', function () {
        var moduleConfig = {
            combine: {
                app: {
                    files: [
                        '!er/**',
                        'er/main',
                        'er/View'
                    ]
                }
            }
        };
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['er/main'], createFile('er/main'));
        compiler.registerModuleIds(['er/View'], createFile('er/View'));
        compiler.registerModuleIds(['er/controller'], createFile('er/controller'));
        compiler.registerModuleIds(['app'], createFile('app'));

        var app = new Module('app', compiler);
        expect(app.toBundle()).to.eql(
            'define(\'er/View\', [], function () {\n    return \'er/View\';\n});'
            + '\n\n'
            + 'define(\'er/main\', [], function () {\n    return \'er/main\';\n});'
            + '\n\n'
            + 'define(\'app\', [], function () {\n    return \'app\';\n});');
    });

    it('explict exclude is supported', function () {
        var moduleConfig = {
            baseUrl: 'src',
            packages: [
                {
                    name: 'er',
                    location: '../dep/er/src',
                    main: 'main.js'
                }
            ],
            combine: {
                app: {
                    files: [
                        '!er/**',
                        'er/main'
                    ]
                }
            }
        };
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['er', 'er/main'], createFile('er'));
        compiler.registerModuleIds(['er/View'], createFile('er/View'));
        compiler.registerModuleIds(['er/controller'], createFile('er/controller'));
        compiler.registerModuleIds(['app'], createFile('app', ['er', 'er/View']));

        var app = new Module('app', compiler);
        expect(app.toBundle()).to.eql(
            'define(\'er/main\', [], function () {\n    return \'er\';\n});'
            + '\n\n'
            + 'define(\'er\', [\'er/main\'], function (main) { return main; });'
            + '\n\n'
            + 'define(\'app\', [\n    \'er\',\n    \'er/View\'\n], function () {\n    return \'app\';\n});'
        );
    });
});
