/**
 * Created by MaximeMaillet on 03/06/2017.
 */
'use strict';

var debug = require('debug');
var lServer = debug('ScrappyServer.index');

var workerMain = require('./worker');
var engine = require('./engine');

var config;

/**
 * Init & check config array
 * @param cnf
 */
module.exports.init = function(cnf) {
	return new Promise((resolve, reject) => {
		lServer("Start config checking");
		config = cnf;
		for(var i=0; i<config.length; i++) {
			var ckCnf = checkConfig(config[i]);
			if(!ckCnf.status) {
				reject("Config file is not correctly");
			}
			else {
				config[i] = ckCnf.config;
			}
		}
		resolve();
		lServer("End config checking : OK");
	});
};

/**
 * Scrapper, which relaunch every hour
 */
module.exports.start = function() {
	worker();

	if(!config.oneShot) {
		setInterval(() => {
			worker();
		}, 3600*1000);
	}
};

/**
 * Method for check one config item
 * @param cnf
 * @returns {*}
 */
function checkConfig(cnf) {
	if(cnf.baseUrl === undefined) {
		lServer("Config failed : 'baseUrl' is not defined");
		return {status: false};
	}

	if(cnf.worker === undefined) {
		lServer("Config failed : 'worker' is not defined");
		return {status: false};
	}
	else {
		if(cnf.worker.scrapPattern === undefined) {
			lServer("Config failed (bad worker) : array 'scrapPattern' is not defined");
			return {status: false};
		}

		if(cnf.worker.start === undefined) {
			lServer("Config failed (bad workker) : function 'start()' is not defined");
			return {status: false};
		}

		if(cnf.worker.isAlreadyScrapped === undefined) {
			lServer("Config failed (bad workker) : function 'isAlreadyScrapped()' is not defined");
			return {status: false};
		}
	}

	if(cnf.oneShot === undefined) {
		lServer("Config default : 'oneShot' = false");
		cnf['oneShot'] = false;
	}

	if(cnf.interval === undefined) {
		lServer("Config default : 'interval' = 500");
		cnf['interval'] = false;
	}

	return {
		status: true,
		config: cnf
	};
}

/**
 * Function for launch every worker
 */
function worker() {
	lServer("Start main worker");
	for(var i=0; i<config.length; i++) {
		workerMain.start(config[i]);
	}
}