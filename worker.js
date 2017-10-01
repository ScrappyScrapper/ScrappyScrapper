/**
 * Created by MaximeMaillet on 03/06/2017.
 */

"use strict";


var xmlParser = require('xml2js');
var hh = require('http-https');
/**
 * @deprecated
 * @type {"path"}
 */
let path = require('path');

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

const {promisify} = require('util');

let cbZlib = require('zlib');
let contentType = require('content-type');
let urlParser = require('url');
let engine = require('./engine');
let debug = require('debug');

let lWorker = debug('ScrappyScrapper.engine.debug');
let lError = debug('ScrappyScrapper.engine.error');
let urlToScrap = [];
let tooManyRequestMode = false;

/**
 * Entry point of worker
 * @param config
 */
module.exports.start = (config) => {

	lWorker("Start engine");
	customScrapSite = config.worker;
	baseUrl = config.baseUrl;

	urlToScrap.push(baseUrl);
	urlToScrap.push(baseUrl+'/sitemap.xml');

	setInterval(function() {
		scrapArrayUrl();
	}, config.interval);
};

/**
 * List url for scrapped
 */
function scrapArrayUrl() {

	if(tooManyRequestMode) {
		setInterval(function() {
			tooManyRequestMode = false;
		}, 5000)
	}

	if(urlToScrap.length > 0 && !tooManyRequestMode) {
		for(let i=0; i<100 && i<urlToScrap.length; i++) {
			getUrl(urlToScrap[i]);
			urlToScrap.splice(i, 1);
		}
	}
}

/**
 * send GET request to url
 * @param url
 */
function getUrl(url) {

	let urlParsed = urlParser.parse(url);

	if (urlParsed.hostname === null) {
		lError("Url whitout hostname : %s", url);
		return;
	}

	if (urlParsed.protocol !== 'http:' && urlParsed.protocol !== 'https:') {
		lError("Bad protocol : %s", urlParsed.protocol);
		return;
	}

	let req = hh.request(url, function (res) {
		if (res.statusCode >= 300 && res.statusCode < 400) {
			return getUrl(res.headers.location);
		} else if(res.statusCode === 429) {
			tooManyRequestMode = true;
		} else if (res.statusCode >= 200 && res.statusCode < 300) {

			let contentTypeUrl = contentType.parse(res.headers['content-type']);
			let chunks = [];

			let out = function(buffer) {
				if(contentTypeUrl.type === 'application/xml') {
					scrapXmlData(buffer.toString());
				} else if(contentTypeUrl.type === 'application/octet-stream') {
					decompressGzFromBuffer(buffer);
				} else if(contentTypeUrl.type === 'text/html') {
					scrapFromBody(url, buffer.toString());
				}
			};

			res.on('data', function (chunk) {
				chunks.push(chunk);
			});

			res.on('end', function() {
				let buffer = Buffer.concat(chunks);
				out(buffer);
			});
		} else {
			lError("Status not accepted (%s) : %s", res.statusCode, url);
			urlToScrap.push(url);
		}
	});

	req.on('error', (e) => {
		urlToScrap.push(url);
		lError("Problem with url : %s, Request: %s", url, e.message);
	});

	req.end();
}

/**
 * Scrap xml data
 * @param xml
 */
function scrapXmlData(xml) {
	let parseString = xmlParser.parseString;
	parseString(xml, function (err, result) {
		if(err) {
			return false;
		}

		if(result.sitemapindex !== undefined) {
			result.sitemapindex.sitemap.forEach(function(sitemap) {
				urlToScrap.push(sitemap.loc[0]);
			});
		}

		if(result.urlset !== undefined) {
			result.urlset.url.forEach(function(sitemap) {
				urlToScrap.push(sitemap.loc[0]);
			});
		}

		result = null;
		xml = null;
	});
}

/**
 * Decompress buffer
 * @param buffer
 */
function decompressGzFromBuffer(buffer) {
	cbZlib.unzip(buffer, function(err, data) {
		scrapXmlData(data.toString());
	});
}

/**
 * Start scrapping from body
 * @param url
 * @param body
 */
async function scrapFromBody(url, body) {

	try {
		let $ = await engine.transform(body);
		scrapLinks($);
		await correspondToPattern(url);
		await customScrapSite.canScrapping(url);
		lWorker("Launch scrapping %s", url);
		customScrapSite.start(url, $);

		$ = null;

	} catch(e) {
		lError(e);
	}
}

/**
 * Start scrapping from url
 * @param url
 */
async function scrapFromUrl(url) {

	try {
		let $ = await engine.scrap(url);
		scrapLinks($);
		await correspondToPattern(url);
		await customScrapSite.canScrapping(url);

		lWorker("Launch scrapping %s", url);
		customScrapSite.start(url, $);

		$ = null;

	} catch(e) {
		console.error(e);
	}
}

/**
 * Get custom pattern for check url
 * @param url
 * @returns {Promise}
 */
function correspondToPattern(url) {
	return new Promise((resolve, reject) => {
		let urlDomain = formatUrl(url);
		if(urlDomain !== null) {
			customScrapSite.scrapPattern.forEach(function(pattern) {
				if(pattern.exec(urlDomain.endpoint) !== null) {
					resolve();
				}
			});
		}

		reject("Url does not corresponding to custom pattern : %s", url);
	});
}

/**
 * Scrap page for found link
 * @param $
 */
function scrapLinks($) {
	$('a').each(function() {
		let urlDomain = formatUrl($(this).attr('href'));
		urlToScrap.push(urlDomain.url);
	});
}

/**
 * Format URL for return domain + endpoint
 * @param url
 * @returns {*}
 */
function formatUrl(url) {
	let domainRegex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)(.+)/im;
	let matches = domainRegex.exec(url);
	if(matches === null) {
		return {url: baseUrl+url, endpoint: url};
	}
	else {
		return {url: matches[0], endpoint: matches[2]};
	}
}