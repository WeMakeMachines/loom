import Component from '../Abstract';

import { Queue } from '../../model/Queue';

import { Block } from '../';

import { eventActions } from '../../constants';

import { secondsToMilliseconds } from '../../tools';
import { parseFile } from '../../tools';

import { radio } from '../../../services';

import storyBehaviour from '../../../configs/storyBehaviour';

import styles from './styles';

import state from '../../state';

export class Subtitles extends Component {
	constructor(url) {
		super({
			id: 'subtitles'
		});

		this.parsedFile = parseFile(url[state.language]);
		this.active = false;
		this.activeEvents = {};

		this.parsedFile.then((subtitles) => {
			this.queue = new Queue(subtitles);

			this.listenToRadio();
		});

		this.parsedFile.catch((error) => {
			console.warn(error);
		});
	}

	isReadyToAction(time) {
		if (!time || !this.queue.pending) { return; }

		if (time >= this.queue.pending.time) {
			this.runAction(this.queue.pending);
		}
	}

	runAction(event) {
		switch (event.action) {
			case eventActions.RUN:
				this.showSubtitle(event);
				break;
			case eventActions.STOP:
				this.hideSubtitle(event);
				break;
			default:
				return;
		}

		this.queue.advance();
	}

	showSubtitle(event) {
		const timedObject = this.queue.getTimedObject(event.id);

		const subtitle = {
			id: `subtitle-${event.id}`,
			styles: styles.subtitle,
			x: storyBehaviour.subtitles.x,
			y: storyBehaviour.subtitles.y,
			text: timedObject.payload.text,
			parent: this.node
		};

		this.activeEvents[event.id] = new Block(subtitle);

		this.activeEvents[event.id].render();
	}

	hideSubtitle(event) {
		this.activeEvents[event.id].unmount();

		delete this.activeEvents[event.id];
	}

	listenToRadio() {
		radio.listen('video:timeupdate', (payload) => {
			if (payload.time) {
				const time = secondsToMilliseconds(payload.time);

				this.isReadyToAction(time);
			}
		});
	}
}
