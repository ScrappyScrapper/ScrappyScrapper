/**
 * Created by MaximeMaillet on 03/06/2017.
 */

"use strict";
var engine = require('./engine');
var debug = require('debug');
var lWorker = debug('ScrappyScrapper.worker');
var xmlParser = require('xml2js');
var path = require('path');
var zlib = require('zlib');
var hh = require('http-https');

var urlToScrap = [];
var customScrapSite, baseUrl;

/**
 * Entrypoint : url html : http://jdjdjd
 * Scrap entrypoint
 * 	find urls html with pattern
 * 		push
 * Scrap sitemap
 * 	recursive to find html
 * 		find url with pattern
 * 			push
 *
 */



/**
 * Entry point of worker
 * @param config
 */
module.exports.start = (config) => {

	lWorker("Start extend worker");
	customScrapSite = config.worker;
	baseUrl = config.baseUrl;

	scrapUrl(baseUrl+'/sitemap.xml');

	setInterval(function() {
		scrapArrayUrl();
	}, config.interval);
};

/**
 * Scrap url
 * @param url
 */
function scrapUrl(url) {
	switch(path.extname(url)) {
		case '.xml':
			var req = hh.request(url, function (res) {
				res.on('data', function (chunk) {
					scrapDataXml(chunk);
				});
			});
			req.end();
			break;
		case '.gz':
			decompressGz(url)
				.then((data) => {
					scrapDataXml(data);
				})
				.catch((err) => {
					lWorker(err);
				});
			break;
		case '.html':
		default:
			correspondToPattern(url)
				.then(() => {
					urlToScrap.push(url);
				});
	}
}

/**
 * Method for decompress .gz file
 * @param url
 * @returns {Promise}
 */
function decompressGz(url) {
	return new Promise((resolve, reject) => {
		var req = hh.request(url, function (res) {
			var chunks = [];
			res.on('data', function (chunk) {
				chunks.push(chunk);
			});

			res.on('end', function() {
				const buffer = Buffer.concat(chunks);
				zlib.unzip(buffer, (err, buf) => {
					if (!err) {
						resolve(buf.toString());
					}
					else {
						lWorker("Error unzip : %s", err);
					}
				});
			});
		});
		req.end();
	});
}

/**
 * Scrap XML data for found URLs
 * @param xml
 */
function scrapDataXml(xml) {
	var parseString = xmlParser.parseString;
	parseString(xml, function (err, result) {
		if(err) {
			return false;
		}

		if(result.sitemapindex !== undefined) {
			result.sitemapindex.sitemap.forEach(function(sitemap) {
				scrapUrl(sitemap.loc[0]);
			});
		}

		if(result.urlset !== undefined) {
			result.urlset.url.forEach(function(sitemap) {
				scrapUrl(sitemap.loc[0]);
			});
		}
	});
}

/**
 * List array and scrap waiting url
 */
function scrapArrayUrl() {
	if(urlToScrap.length > 0) {
		for(var i=0; i<10 && i<urlToScrap.length; i++) {
			scrap(urlToScrap[i]);
			urlToScrap.splice(i, 1);
		}
	}
}

/**
 * Start scrapping
 * @param url
 */
function scrap(url) {
	customScrapSite.isAlreadyScrapped(url)
		.then(() => {
			return false;
		})
		.catch(() => {
			engine.scrap(url)
				.then(($) => {
					lWorker("Launch scrapping %s", url);
					customScrapSite.start(url, $);
					scrapLinks($);
				})
				.catch((error) => {
					lWorker("Engine catch error : %s > %s", error, url);
				});
		});
}

/**
 * Scrap page for found link
 * @param $
 */
function scrapLinks($) {
	$('a').each(function() {
		var urlDomain = formatUrl($(this).attr('href'));
		scrapUrl(urlDomain.url);
	});
}

/**
 * Format URL for return domain + endpoint
 * @param url
 * @returns {*}
 */
function formatUrl(url) {
	var domainRegex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)(.+)/im;
	var matches = domainRegex.exec(url);
	if(matches === null) {
		return {url: baseUrl+url, endpoint: url};
	}
	else {
		return {url: matches[0], endpoint: matches[2]};
	}
}

function correspondToPattern(url) {
	return new Promise((resolve, reject) => {
		var urlDomain = formatUrl(url);
		if(urlDomain !== null) {
			customScrapSite.scrapPattern.forEach(function(pattern) {
				if(pattern.exec(urlDomain.endpoint) !== null) {
					resolve();
				}
			});
		}
	});
}