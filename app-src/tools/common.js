import config from '../configs/config';
import cssLib from './css';

/**
 * Simplified AJAX call
 * @param {String} url
 * @param {String} type
 *
 * @returns {Promise}
 */
const ajaxRequest = function (url, type) {

	return new Promise((resolve, reject) => {

		let xmlHTTP = new XMLHttpRequest();

		xmlHTTP.open('GET', url);
		xmlHTTP.send();

		xmlHTTP.onload = function() {

			if (xmlHTTP.status === 200) {
				switch (type) {
					case 'JSON':
						resolve(JSON.parse(xmlHTTP.responseText));
						break;
					default:
						resolve(xmlHTTP.status);
						break;
				}
			} else {
				reject(xmlHTTP.status);
			}

		};

		xmlHTTP.onerror = function() {
			reject(report('File or network error'));
		};

	});

};

/**
 * Removes whitespace from a string, and converts to lowercase
 * @param {String} string
 *
 * @returns {String}
 */
const cleanString = function (string) {

	return string.replace(/\s+/g, '').toLowerCase();
};

/**
 * Turns seconds into hours, minutes, seconds
 * @param {Number} timeInSeconds
 *
 * @returns {Object}
 */
const clock = function (timeInSeconds) {
	let remainder = timeInSeconds,
		hours,
		minutes,
		seconds,
		split;

	/**
	 * Normalises time display by adding a leading zero
	 * @param {Number} number
	 *
	 * @returns {String}
	 */
	function addLeadingZero(number) {
		let string = number.toString();

		if (number < 10) {
			string = '0' + string;
		}

		return string;
	}

	// find how many hours there are
	if (remainder >= 3600) {
		hours = Math.floor(remainder / 3600);
		remainder = remainder - hours * 3600;
	} else {
		hours = 0;
	}

	// find how many minutes there are
	if (remainder >= 60) {
		minutes = Math.floor(remainder / 60);
		remainder = remainder - minutes * 60;
	} else {
		minutes = 0;
	}

	// find how many seconds
	if (remainder >= 1) {
		seconds = Math.floor(remainder);
		remainder = remainder - seconds;
	} else {
		seconds = 0;
	}

	split = remainder.toString();

	if (split === '0') {
		split = '000';
	}
	else {
		split = split.substr(2, 3);
	}

	return {
		hours  : addLeadingZero(hours),
		minutes: addLeadingZero(minutes),
		seconds: addLeadingZero(seconds),
		split  : split
	};
};

/**
 * Creates a DOM object
 * @param {String} type
 * @param {Object} options
 * @param {Object} css
 *
 * @returns {Object}
 */
const newObject = function (type, options, css) {
	let newObject,
		id = config.appRoot;

	if (!type) { type = 'div'; }

	newObject = document.createElement(type);

	if (options) {
		if (options.id) {
			id = id + '_' + options.id;
		}

		if (options.id || options.root) {
			newObject.setAttribute('id', id);
		}

		if (options.class) {
			newObject.setAttribute('class', options.class);
		}

		if (options.parent) {
			options.parent.appendChild(newObject);
		}

		if (options.attributes && Array.isArray(options.attributes)) {
			for (let i = 0; i < options.attributes.length; i += 1) {
				let property = options.attributes[i][0],
					value = options.attributes[i][1];
				newObject.setAttribute(property, value);
			}
		}
	}

	if (css) {
		cssLib.style(newObject, css); // test for bug here with the reference
	}

	return newObject;
};

/**
 * Returns a random number between minRange and maxRange
 * @param {Number} minRange
 * @param {Number} maxRange
 *
 * @returns {Number}
 */
const random = function (minRange, maxRange) {
	let range = maxRange - minRange;

	if (typeof minRange === 'undefined') {
		minRange = 0;
	}
	if (range <= 0) {
		range = maxRange;
		minRange = 0;
	}

	return Math.floor(Math.random() * range) + minRange;
};

/**
 * Outputs debugging information
 * @param {String} message
 *
 */
const report = function (message) {
	if (ENV === 'development') {
		// eslint-disable-next-line
		console.log(message);
	}
};

export { ajaxRequest, cleanString, clock, newObject, random, report };