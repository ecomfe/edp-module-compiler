/**
 * @file test/compiler.spec.js
 * @author leeight
 */

var expect = require('expect.js');

var Compiler = require('../src/compiler');

describe('Compiler', function () {
    function createFile(moduleId, deps) {
        var contents = deps
            ? new Buffer('define(' + JSON.stringify(deps) + ', function () { return "' + moduleId + '"});')
            : new Buffer('define(function () { return "' + moduleId + '"});');
        return {
            contents: contents
        };
    }

    it('toSingle (paths)', function () {
        var moduleConfig = {
            baseUrl: 'src',
            paths: {
                tpl: 'common/tpl',
                js: 'common/js'
            }
        };
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['app'], createFile('app', ['js!//www.baidu.com/relay.js', 'tpl!./a.tpl.html']));

        var moduleId = 'app';
        expect(compiler.toSingle(moduleId)).to.eql(
            'define(\'app\', [\n    \'js!//www.baidu.com/relay.js\',\n    \'tpl!./a.tpl.html\'\n], function () {\n    return \'app\';\n});');
    });

    it('toSingle (not amd)', function () {
        var moduleConfig = {};
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['app'], {
            contents: new Buffer('var app = 10;')
        });

        var moduleId = 'app';
        expect(compiler.toSingle(moduleId)).to.eql('var app = 10;');
    });

    it('toSingle', function () {
        var moduleConfig = {};
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['app'], createFile('app'));

        var moduleId = 'app';
        expect(compiler.toSingle(moduleId)).to.eql(
            'define(\'app\', [], function () {\n    return \'app\';\n});');
    });

    it('toSingle (package)', function () {
        var moduleConfig = {
            packages: [
                {
                    name: 'er',
                    location: '../dep/er/0.0.0/src',
                    main: 'main'
                },
                {
                    name: 'etpl',
                    location: '../dep/etpl/0.0.0/src'
                },
                {
                    name: 'inf-ria',
                    location: '../dep/inf-ria/0.0.0/src',
                    main: 'startup.js'
                }
            ]
        };
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['er', 'er/main'], createFile('er'));
        compiler.registerModuleIds(['er/View'], createFile('er/View'));
        compiler.registerModuleIds(['etpl', 'etpl/main'], createFile('etpl'));
        compiler.registerModuleIds(['etpl/tpl'], createFile('etpl/tpl'));
        compiler.registerModuleIds(['inf-ria', 'inf-ria/startup'], createFile('inf-ria'));
        compiler.registerModuleIds(['inf-ria/main'], createFile('inf-ria/main'));

        var erPkgBundle = 'define(\'er/main\', [], function () {\n    return \'er\';\n});'
            + '\n\n'
            + 'define(\'er\', [\'er/main\'], function (main) { return main; });';
        var etplPkgBundle = 'define(\'etpl/main\', [], function () {\n    return \'etpl\';\n});'
            + '\n\n'
            + 'define(\'etpl\', [\'etpl/main\'], function (main) { return main; });';
        var infRiaPkgBundle = 'define(\'inf-ria/startup\', [], function () {\n    return \'inf-ria\';\n});'
            + '\n\n'
            + 'define(\'inf-ria\', [\'inf-ria/startup\'], function (main) { return main; });';

        expect(compiler.toSingle('er')).to.eql(erPkgBundle);
        expect(compiler.toSingle('er/View')).to.eql(
            'define(\'er/View\', [], function () {\n    return \'er/View\';\n});');
        expect(compiler.toSingle('er/main')).to.eql(erPkgBundle);

        expect(compiler.toSingle('etpl')).to.eql(etplPkgBundle);
        expect(compiler.toSingle('etpl/tpl')).to.eql(
            'define(\'etpl/tpl\', [], function () {\n    return \'etpl/tpl\';\n});');
        expect(compiler.toSingle('etpl/main')).to.eql(etplPkgBundle);

        expect(compiler.toSingle('inf-ria')).to.eql(infRiaPkgBundle);
        expect(compiler.toSingle('inf-ria/main')).to.eql(
            'define(\'inf-ria/main\', [], function () {\n    return \'inf-ria/main\';\n});');
    });

    it('toPackage', function () {
        var moduleConfig = {
            packages: [
                {
                    name: 'er',
                    location: '../dep/er/0.0.0/src'
                },
                {
                    name: 'underscore',
                    location: '../dep/underscore/0.0.0/src'
                },
                {
                    name: 'eoo',
                    location: '../dep/eoo/0.0.0/src'
                }
            ]
        };

        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['eoo', 'eoo/main'], createFile('eoo'));
        compiler.registerModuleIds(['underscore', 'underscore/main'], createFile('underscore'));
        compiler.registerModuleIds(['er', 'er/main'], createFile('er'));
        compiler.registerModuleIds(['er/View'], createFile('er/View'));
        compiler.registerModuleIds(['er/Action'], createFile('er/Action', ['eoo', 'underscore']));
        compiler.registerModuleIds(['er/URL'], createFile('er/URL'));
        compiler.registerModuleIds(['er/locator'], createFile('er/locator'));
        compiler.registerModuleIds(['er/controller'], createFile('er/controller'));

        var moduleId = 'er';
        expect(compiler.toPackage(moduleId)).to.eql(
            'define(\'er/controller\', [], function () {\n    return \'er/controller\';\n});'
            + '\n\n'
            + 'define(\'er/locator\', [], function () {\n    return \'er/locator\';\n});'
            + '\n\n'
            + 'define(\'er/URL\', [], function () {\n    return \'er/URL\';\n});'
            + '\n\n'
            + 'define(\'er/Action\', [\n    \'eoo\',\n    \'underscore\'\n], function () {\n    return \'er/Action\';\n});'
            + '\n\n'
            + 'define(\'er/View\', [], function () {\n    return \'er/View\';\n});'
            + '\n\n'
            + 'define(\'er/main\', [], function () {\n    return \'er\';\n});'
            + '\n\n'
            + 'define(\'er\', [\'er/main\'], function (main) { return main; });');
    });

    it('toBundle', function () {
        var moduleConfig = {
            packages: [
                {
                    name: 'er',
                    location: '../dep/er/0.0.0/src'
                }
            ],
            combine: {
                app: true
            }
        };
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['app'], createFile('app', ['./lib', 'er']));
        compiler.registerModuleIds(['lib'], createFile('lib', ['js!./x.js', 'css!./x.css', 'er']));
        compiler.registerModuleIds(['js'], createFile('js'));
        compiler.registerModuleIds(['css'], createFile('css'));
        compiler.registerModuleIds(['er', 'er/main'], createFile('er'));

        var moduleId = 'app';
        expect(compiler.toBundle(moduleId)).to.eql(
            'define(\'js\', [], function () {\n    return \'js\';\n});'
            + '\n\n'
            + 'define(\'css\', [], function () {\n    return \'css\';\n});'
            + '\n\n'
            + 'define(\'er/main\', [], function () {\n    return \'er\';\n});'
            + '\n\n'
            + 'define(\'er\', [\'er/main\'], function (main) { return main; });'
            + '\n\n'
            + 'define(\'lib\', [\n    \'js!./x.js\',\n    \'css!./x.css\',\n    \'er\'\n], function () {\n    return \'lib\';\n});'
            + '\n\n'
            + 'define(\'app\', [\n    \'./lib\',\n    \'er\'\n], function () {\n    return \'app\';\n});');
    });

    it('case-xtpl', function () {
        var moduleConfig = {
            baseUrl: 'src',
            paths: {
                hello: 'bar/hello',
                css: 'resource/css',
                xtpl: 'common/xtpl',
                xtpl2: 'common/xtpl',
                xtpl3: 'common/xtpl',
                ztpl: 'common/ztpl',
                ztpl2: 'common/ztpl'
            },
            combine: {
                'case-xtpl': true
            }
        };
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['case-xtpl'], createFile('case-xtpl', ['xtpl', 'common/xtpl']));
        compiler.registerModuleIds(['xtpl', 'xtpl2', 'xtpl3', 'common/xtpl'], createFile('xtpl'));

        var moduleId = 'case-xtpl';
        expect(compiler.toBundle(moduleId)).to.eql(
            'define(\'xtpl\', [], function () {\n    return \'xtpl\';\n});'
            + '\n\n\n'
            + '/** d e f i n e */\ndefine(\'xtpl2\', [\'xtpl\'], function (target) { return target; });'
            + '\n\n\n'
            + '/** d e f i n e */\ndefine(\'xtpl3\', [\'xtpl\'], function (target) { return target; });'
            + '\n\n\n'
            + '/** d e f i n e */\ndefine(\'common/xtpl\', [\'xtpl\'], function (target) { return target; });'
            + '\n\n'
            + 'define(\'case-xtpl\', [\n    \'xtpl\',\n    \'common/xtpl\'\n], function () {\n    return \'case-xtpl\';\n});');
    });

    it('ssp promise duplicate issue', function () {
        var moduleConfig = {
            baseUrl: 'src',
            combine: {
                'ssp/bar': 1,
                'ssp/foo': {
                    files: [
                        '!ssp/promise'
                    ]
                }
            }
        };

        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['ssp/bar'], createFile('ssp/bar', ['./promise']));
        compiler.registerModuleIds(['ssp/foo'], createFile('ssp/foo', ['./bar']));
        compiler.registerModuleIds(['ssp/promise'], createFile('ssp/promise'));

        expect(compiler.toBundle('ssp/bar')).to.eql(
            'define(\'ssp/promise\', [], function () {\n    return \'ssp/promise\';\n});'
            + '\n\n'
            + 'define(\'ssp/bar\', [\'./promise\'], function () {\n    return \'ssp/bar\';\n});');
        expect(compiler.toBundle('ssp/foo')).to.eql(
            'define(\'ssp/bar\', [\'./promise\'], function () {\n    return \'ssp/bar\';\n});'
            + '\n\n'
            + 'define(\'ssp/foo\', [\'./bar\'], function () {\n    return \'ssp/foo\';\n});');
        expect(compiler.toBundle('ssp/bar')).to.eql(
            'define(\'ssp/promise\', [], function () {\n    return \'ssp/promise\';\n});'
            + '\n\n'
            + 'define(\'ssp/bar\', [\'./promise\'], function () {\n    return \'ssp/bar\';\n});');
    });

    it('toBundle (paths)', function () {
        var moduleConfig = {
            baseUrl: 'src',
            paths: {
                tpl: 'common/tpl',
                js: 'common/js'
            },
            combine: {
                app: true
            }
        };
        var compiler = new Compiler(moduleConfig);
        compiler.registerModuleIds(['app'], createFile('app', ['js!//www.baidu.com/relay.js', 'tpl!./a.tpl.html']));
        compiler.registerModuleIds(['js', 'common/js'], createFile('js'));
        compiler.registerModuleIds(['tpl', 'common/tpl'], createFile('tpl'));

        var moduleId = 'app';
        expect(compiler.toBundle(moduleId)).to.eql(
            'define(\'js\', [], function () {\n    return \'js\';\n});'
            + '\n\n\n'
            + '/** d e f i n e */\ndefine(\'common/js\', [\'js\'], function (target) { return target; });'
            + '\n\n'
            + 'define(\'tpl\', [], function () {\n    return \'tpl\';\n});'
            + '\n\n\n'
            + '/** d e f i n e */\ndefine(\'common/tpl\', [\'tpl\'], function (target) { return target; });'
            + '\n\n'
            + 'define(\'app\', [\n    \'js!//www.baidu.com/relay.js\',\n    \'tpl!./a.tpl.html\'\n], function () {\n    return \'app\';\n});');
    });
});
