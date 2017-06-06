/**
 * Test engine
 */

var assert = require('assert');
var expect = require('expect.js');
var should = require('should');
var engine = require('../engine');

module.exports.start = () => {

describe('Engine', function() {
  describe('start', function() {
    it('should resolve object', function(done) {
		var url = 'https://google.com';
		engine.scrap(url)
			.then(($) => {
				expect($('html')).to.be.an('object');
				done();
			})
			.catch((err) => {
				done();
			});
    });
  });
});
}

/*
var url = 'https://google.com';

engine.scrap(url)
.then(($) => {

})
.catch((err) => {

});*/