/**
 * @file test/helper.spec.js
 * @author leeight
 */

var expect = require('expect.js');

var helper = require('../src/helper');

describe('helper', function () {
    it('getPackageInfo (no packages)', function () {
        var moduleConfig = {};
        expect(helper.getPackageInfo('er', moduleConfig)).to.be(null);
    });

    it('getPackageInfo (empty packages)', function () {
        var moduleConfig = {
            packages: []
        };
        expect(helper.getPackageInfo('er', moduleConfig)).to.be(null);
    });

    it('getPackageInfo (default)', function () {
        var moduleConfig = {
            packages: [
                {
                    name: 'er',
                    location: '../dep/er/0.0.0/src'
                },
                {
                    name: 'etpl',
                    location: '../dep/etpl/0.0.0/src',
                    main: 'main'
                },
                {
                    name: 'eoo',
                    location: '../dep/eoo/0.0.0/src',
                    main: 'main.js'
                }
            ]
        };

        var erModule = {
            name: 'er',
            location: '../dep/er/0.0.0/src',
            main: 'main',
            module: 'er/main'
        };
        var etplModule = {
            name: 'etpl',
            location: '../dep/etpl/0.0.0/src',
            main: 'main',
            module: 'etpl/main'
        };
        var eooModule = {
            name: 'eoo',
            location: '../dep/eoo/0.0.0/src',
            main: 'main',
            module: 'eoo/main'
        };
        expect(helper.getPackageInfo('er', moduleConfig)).to.eql(erModule);
        expect(helper.getPackageInfo('er/main', moduleConfig)).to.eql(erModule);
        expect(helper.getPackageInfo('etpl', moduleConfig)).to.eql(etplModule);
        expect(helper.getPackageInfo('etpl/main', moduleConfig)).to.eql(etplModule);
        expect(helper.getPackageInfo('eoo', moduleConfig)).to.eql(eooModule);
        expect(helper.getPackageInfo('eoo/main', moduleConfig)).to.eql(eooModule);
    });
});
