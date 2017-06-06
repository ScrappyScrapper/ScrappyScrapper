"use strict";
var rp = require('request-promise');
var cheerio = require('cheerio'); // Basically jQuery for node.js

module.exports = {

	url: null,
	send: function () {
		var self = this;
		return new Promise((resolve, reject) => {

			var options = {
				uri: self.url,
				transform: function (body) {
					return cheerio.load(body);
				}
			};
			
			rp(options)
				.then(($) => {
					resolve($)
				})
				.catch(function (err) {
					reject(err);
				});
		});
	},
	scrap: function(url) {
		this.url = url;
		return this.send();
	}
};