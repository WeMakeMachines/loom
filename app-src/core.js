/**
 * Loom Story Engine
 *
 */
import { ajaxRequest, clock, report } from './tools/common';
import { default as config, data } from './config';
import { fullscreen } from './tools/browser_api';
import gui from './gui';
import media from './media';
import scriptHandler from './model/scriptHandler';
import view from './view/controller';

export default (function () {

	/**
	 * The public interface
	 *
	 */
	let publicInterface = {
		// namespace for our external modules
		Modules: function () {
		},

		pause: function () {
			media.pause();
			return 'Paused';
		},

		play: function () {
			media.play();
			return 'Playing';
		},

		seek: function (time) {
			// scrub to time in media
			// time in seconds 4 = 4 seconds
			media.seek(time);
			return 'Seeking';
		},

		reload: function () {
			// restarts the current scene

			return 'Reloaded scene';
		},

		skip: function (sceneName) {
			// abandon current scene and load the named scene

			return 'Skipped to scene' + sceneName;
		},

		viewportResize: function () {

		},

		fullScreen: fullscreen.toggle,

		status: function () {
			// report stats on media
			report(config);
			report('Current time:' + media.getCurrentTime() + ' / Duration: ' + media.getLength());
		},

		currentTime: {
			seconds: function () {
				return media.getCurrentTime();
			},

			object: function () {
				return clock(media.getCurrentTime());
			}
		},

		duration: {
			seconds: function () {
				return media.getLength();
			},

			object: function () {
				return clock(media.getLength());
			}
		},

		/**
		 * Our public initialise method, used to initialise our application
		 * @param {Function} callback - callback to run after script processing
		 *
		 */
		initialise: function (callback) {

			// view check : check browser can handle HTML5 events.js
			// begin load screen

			ajaxRequest(config.scriptFile, 'JSON', true, function (returnedData) {

				if (typeof returnedData === 'object') {

					data.script = returnedData;
					data.modules = new loomSE.Modules(); // review this
					scriptHandler.setScene(data.script, config.firstScene);
					view.initialise(config.target, config.resolution);
					gui.load();

					if (callback) {
						callback();
					}
				} else {
					report('Script file not found or invalid');
				}
			});
		}
	};
	return publicInterface;
}());
