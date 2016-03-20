//
// Loom Story Engine
//

var LoomSE = (function() {

    //
    // Private
    //

    // Private variables
    var status = {
            version: '0.28',
            control: 'waiting', // playing | paused | seeking | waiting (initial load of media) | error
            media: null, // current type of media in queue
            id: null, // id of media in queue
            subtitles: null // subtitles on? true or false
        },
        devOptions = {
            // developer options only
            muteAudio: false, // overrides any settings in script
            verbose: 'minimal', // reports errors, findings, events etc to console. Options are full | minimal | subtitles
            disableCheckScript: false, // by default script file is checked for errors, set to true to skip this
            disableScrubScreen: false // disables clearing the screen when media is scrubbed
        },
        mediaLoadType = 'full', // full | progressive
        script,
        firstScene,
        currentScene,
        mediaTimeEventResolution = 0.4,// this is margin for which events are detected on the timecode of the media playing, if flag lockEventToMediaTime is set to true
        minimumResolution = {
        // default values, overridden by values in script - if set
            width: 640,
            height: 480
        },
        id = {
            stage: 'loom_stage',
            notify: 'loom_notify',
            overlay: 'loom_overlay',
            mediaGroup: 'loom_mediaGroup',
            video: 'loom_video',
            audio: 'loom_audio'
        };

    // Common utilities which may be referred to from other functions
    var utilities = {
        ajaxRequest: function(file, fileType, async, callback) {
            var data,
                xmlhttp = new XMLHttpRequest();

            xmlhttp.onreadystatechange = function() {
                if(xmlhttp.readyState === 4 && xmlhttp.status === 200) {
                    if(fileType === 'JSON'){
                        data = JSON.parse(xmlhttp.responseText);
                    }
                    else {
                        data = xmlhttp.responseText;
                    }
                    callback(data);
                }
            };

            xmlhttp.open('GET', file, async);
            xmlhttp.send();
        },

        report: function(message) {
            // display report
            console.log(message);
        },

        displayError: function(errorMessage) {
            var errorText = '\n*** Error ***\n';
            // throw an exception
            throw errorText + errorMessage;
            //console.log(errorText + errorMessage);
        },

        random: function(minRange, maxRange) {
            if(typeof minRange === 'undefined') {
                var minRange = 0;
            }
            var range = maxRange - minRange;
            if(range <= 0){
                range = maxRange;
                minRange = 0;
            }
            // returns a random number between 1 and number
            var number = (Math.floor((Math.random() * range)) + minRange);
            return number;
        },

        cleanString: function(string) {
            // removes whitespace, and converts to lowercase
            var cleanedString = string.replace(/[^a-z0-9_]+]/gi, '');
            return cleanedString.toLowerCase();
        },

        style: function(element, object) {
            for(var attribute in object)
            {
                var value = object[attribute];

                switch(attribute)
                {
                    case 'width':
                    case 'height':
                    case 'top':
                    case 'left':
                    case 'right':
                    case 'bottom':
                        value = value + 'px';
                }
                element.style[attribute] = value;
            }
        },

        animateCSS: function(element, parameter, startValue, endValue, time, callback) {
            var currentValue,
                steps = 4, // adjust this value to make animation smoother
                currentStep = 0,
                difference = endValue - startValue,
                timeStep = time / steps,
                valueStep = difference / steps,
                object = {},
                step = setInterval(function() {
                    if(currentStep > steps) {
                        clearInterval(step);
                        if(callback) {
                            callback();
                        }
                    } else {
                        if(currentStep === steps) {
                            currentValue = endValue;
                        } else {
                            currentValue = startValue + (valueStep * currentStep);
                        }
                        object[parameter] = currentValue;
                        utilities.style(element, object);
                        currentStep = currentStep + 1;
                    }
                }, timeStep);
        }
    };

    // Handles addition and removal of HTML nodes, as well as other exchanges
    var node = {
        // not sure if I'm keeping add / remove or offloading onto module
        add: function(id) {
            var element = document.createElement('div');
            element.setAttribute('id', id);
            return element;
        },

        remove: function(element) {
            element.parentNode.removeChild(element);
        }
    };

    var environment = (function() {

        var resolution = {
                width: null,
                height: null
            },
            controls = {},
            screenObjects = {
                root: {},
                stage: {},
                overlay: {},
                mediaGroup: {},
                mediaObject: {},
                clearOverlay: function() {
                    // this function clears any active on screen events
                    while (this.overlay.firstChild) this.overlay.removeChild(this.overlay.firstChild);
                }
            };

        controls.container = document.createElement('div');
        controls.playpause = document.createElement('div');
        controls.rewind = document.createElement('div');
        controls.skip = document.createElement('div');

        controls.container.setAttribute('id', 'LoomSE_controls');
        controls.playpause.setAttribute('id', 'LoomSE_playpause');
        controls.rewind.setAttribute('id', 'LoomSE_rewind');
        controls.skip.setAttribute('id', 'LoomSE_skip');

        controls.package = function() {
            this.container.appendChild(this.playpause);
            this.container.appendChild(this.rewind);
            this.container.appendChild(this.skip);
        };

        return {
            gui: (function() {
                return {
                    show: function() {
                        controls.package();
                        environment.screenObjects.overlay.appendChild(controls.container);
                    }
                }
            })(),
            reset: function(){
                subtitles.reset();
                environment.screenObjects.clearOverlay();
            },
            resize: function(element, width, height) {
                utilities.style(element, {
                    'width': width,
                    'height': height
                });
            },
            screenObjects: screenObjects,
            resolution: resolution
        }
    })();

    // Keeps a record of the scenes passed through by the user. Provides some control over how to navigate the history
    var history = (function() {
        var scenes = [];
        return {
            record: function(object) {
                // records scene
                scenes.push(object);
            },
            erase: function() {
                // removes scene

            },
            remind: function() {
                // returns current scene
                var scene = scenes[scenes.length-1];
                return scene;
            },
            rewind: function() {
                // goes back 1 scene & erases current scene
                var scene;
                if(scenes.length > 1){
                    scenes.splice(scenes.length-1, 1);
                }
                scene = scenes[scenes.length-1];
                return scene;
            }
        };
    })();

    // Handles the script logic
    var readScript = (function() {
        // --
        // A collection of methods that set process the media elements in the Script
        // --
        function setScene(scriptObject, scene) {
            // --
            // Runs when a new scene is set from the Script
            // Pulls the relevant scene details from the object, resets parameters and launches the process() method.
            // --

            currentScene = new Scene(scene, scriptObject.settings.language, scriptObject.scenes[scene]);

            subtitles.parse(currentScene.subtitles);
            status.media = currentScene.media.type;
            history.record(currentScene);
            process(currentScene);
        }

        function process(scene) {
            // --
            // Processes the current scene
            // --
            // Each scene is composed of a 'media' type, which in turn has 'data' and 'parameters'
            // Each 'media' type also has a number of events

            function scheduleEvents(target, array, callback) {
                // --
                // Schedules timed events for each media element
                // --

                for(var i in array){
                    var event = array[i],
                        id = event.call + '_' + i;

                    var createEvent = new Event(id, event.call, event.schedule, event.parameters);

                    Event.prototype.schedule = function () {

                        // We calculate the ins and outs here
                        var that = this,
                            timeIn = that.in,
                            timeOut = that.out,
                            timeInLow = timeIn - (mediaTimeEventResolution / 2),
                            timeInHigh = timeIn + (mediaTimeEventResolution / 2),
                            timeOutLow = timeOut - (mediaTimeEventResolution / 2),
                            timeOutHigh = timeOut + (mediaTimeEventResolution / 2);

                        media.listen(function(time) {
                            if(time >= timeInLow && time <= timeInHigh){
                                if(devOptions.verbose === 'full') {
                                    utilities.report('[Event] Run: ' + id);
                                    utilities.report('[Event] ' + 'T:' + time + ', L:' + timeInLow + ', H:' + timeInHigh);
                                }

                                that.run();
                            }
                            // 'Out'
                            if(time >= timeOutLow && time <= timeOutHigh) {
                                if(devOptions.verbose === 'full') {
                                    utilities.report('[Event] Stop: ' + id);
                                    utilities.report('[Event] ' + 'T:' + time + ', L:' + timeOutLow + ', H:' + timeOutHigh);
                                }

                                that.stop();
                                //node.remove(document.getElementById(that.id));
                            }
                        });
                    };

                    createEvent.schedule();
                }

                callback();
            }

            media.create(scene.container, scene.media, function(playObject) {

                mediaObject = playObject;
                // check which media needs to play
                // play video
                if(scene.media.type === 'video') { // TODO need to allow this to accept and process multiple strings
                    //scene.media.video.duration = playObject.duration;

                    // check if video SHOULD autoplay
                    if(mediaObject.parameters.autoplay === true) {
                        media.play(mediaObject);
                    }

                    //if(playObject.loop === false && (scene.data.nextSceneByDefault !== null || scene.data.nextnextSceneByDefault !== '')){
                    //    playObject.onended = function(e){
                    //        readScript.setScene(scene.data.nextSceneByDefault);
                    //    };
                    //}

                    // video loop logic must stay here

                    if(playObject.parameters.loop === true) {
                        if(playObject.parameters.loopIn === 0 && playObject.parameters.loopOut === null) {
                            playObject.onended = function(e){
                                console.log('looping from end to beginning');
                                status.control = 'seeking'; // required for media.play check
                                environment.reset();
                                media.play(playObject, 0);
                            };
                        }
                        else {
                            console.log('Im going to loop the video from the in and out points defined');
                            // add loop point as event
                            // for the purposes of our system, in / out points are reversed
                            // (schedule in point is actually loop out point etc)
                            currentScene.events.push(
                                {
                                    call: 'loop',
                                    schedule: {
                                        in: playObject.parameters.loopOut,
                                        out: playObject.parameters.loopIn
                                    }
                                }
                            );
                        }
                    }
                }

                if(scene.events !== null) {
                    scheduleEvents(playObject, scene.events, function() {});
                }
                else {
                    utilities.report('[Events] No events in scene.');
                }
            });
        }

        return {
            setScene: setScene,
            process: process
        };
    })();

    var subtitles = (function() {
        var subtitlesArray = [],
            arrayPosition = 0,
            active = [0, 0, null, false],
            id = 'subtitle',
            container = document.createElement('div'),
            element = document.createElement('p');

        container.setAttribute('id', id);

        function parse(url) {
            var rawSubs,
                line,
                newLine = /\n/g;

            function convertToInternalTime(string, h, m, s, ms) {
                var hours = Number(string.slice(h[0], h[1])),
                    minutes = Number(string.slice(m[0], m[1])),
                    seconds = Number(string.slice(s[0], s[1])),
                    milliseconds = Number(string.slice(ms[0], ms[1])) / 1000,
                    time = (hours * 3600) + (minutes * 60) + seconds + milliseconds;

                return time;
            }

            // support for .srt files
            function srt(array) {
                var arrayPush = [],
                    currentRecord,
                    times,
                    timeIn,
                    timeOut,
                    string = '';

                //console.log(array);
                for(var i=0; i < array.length; i++) {
                    currentRecord = array[i];
                    if(isNaN(currentRecord) === false) {
                        //if(typeof currentRecord === 'number') {
                        // push old string to array
                        if(i > 0) {
                            arrayPush = [timeIn, timeOut, string];
                            subtitlesArray.push(arrayPush);
                            string = '';
                        }
                        // skip to next line, we're expecting the times now
                        times = array[i+1];
                        timeIn = (function() {
                            var string = times.slice(0,12);

                            return convertToInternalTime(string, [0,2], [3,5], [6,8], [9,12]);
                        }());
                        timeOut = (function() {
                            var string = times.slice(17,29);

                            return convertToInternalTime(string, [0,2], [3,5], [6,8], [9,12]);
                        }());
                        i++;
                    }
                    else {
                        string = string + ' ' + currentRecord;
                    }
                }
            }

            utilities.ajaxRequest(url, null, true, function(data) {
                rawSubs = data.match(/[^\r\n]+/g);
                if(url.endsWith('srt')) {
                    srt(rawSubs);
                }
                else {
                    return 'No valid subtitles found';
                }
            });
        }

        function check(time) {
            var check = subtitlesArray[arrayPosition]; // pull current record and see if it is ready
            //console.log(time, check[0]);
            if(check[0] === time || check[0] < time) {

                // check if preceding subtitle still exists, if it does, remove it
                if(active[3] === true) {
                    remove();
                }

                active = check;
                active[3] = true; // set visibility flag to true
                display(active[2]); // display subtitle
                arrayPosition++;
            }
        }

        function display(phrase) {
            // if the subtitles weren't meant to be displayed, fall silent
            if(status.subtitles === true) {
                if(devOptions.verbose === 'full' || devOptions.verbose === 'subtitles') {
                    utilities.report('[Subtitle] ' + phrase);
                }
                element.innerHTML = phrase;
                environment.screenObjects.overlay.appendChild(container);
                container.appendChild(element);
                media.listen(remove);
            }
        }

        function remove(time) {
            function destroy() {
                if(active === true){
                    active[3] = false;
                    environment.screenObjects.overlay.removeChild(container);
                }
            }

            // check if time is defined
            if(time) {
                if((active[1] === time || active[1] < time) && active[3] === true) {
                    destroy();
                }
            }
            // if not, default behaviour is to remove subtitle
            else {
                destroy();
            }
        }

        function reset(time) {
            if(active[3] === true){
                active[3] = false;
                environment.screenObjects.overlay.removeChild(container);
            }
            if(typeof time === 'number' && time !== 0) {
                // find the next subtitle with the timecode
                for(i=0; i<(subtitlesArray.length-1); i++) {
                    var currentRecord = subtitlesArray[i];
                    if(time < currentRecord[0]) {
                        arrayPosition = i;
                        break;
                    }
                }
            }
            else {
                arrayPosition = 0;
            }
        }

        return {
            parse: parse, // parse subtitle file
            check: check, // check if next subtitle is ready to be displayed
            display: display, // show the subtitle
            remove: remove, // remove existing subtitle
            reset: reset // reset subtitles (fixes to current time index)
        }
    })();

    // Handles media
    var media = (function() {
        function target(sceneId) {
            var parent = document.getElementById(sceneId),
                media = parent.media,
                selection;
            switch (media) {
                case 'video':
                    selection = document.querySelector('video');
                    break;
                case 'audio':
                    selection = document.querySelector('audio');
                    break;
                default:
                    break;
            }
            return selection;
        }

        function pause(object) {
            notify.push('Video paused');
            this.poll.end();
            object.pause();
            status.control = 'paused';
        }

        function play(object, timecode) {
            if(status.media === 'video' || status.media === 'audio') {
                if(status.control === 'waiting' && mediaLoadType === 'full') {
                    // wait for video / audio to fully load
                    // show progress bar
                    notify.push('Loading');

                    object.oncanplaythrough = function() {
                        if(devOptions.verbose === 'full' || devOptions.verbose === 'minimal') {
                            console.log('[Media] Fully loaded, playing.');
                        }
                        notify.dismiss();
                        object.play();
                        watch(object);
                        status.control = 'playing';
                    }
                }

                if(status.control === 'waiting' && mediaLoadType === 'progressive') {
                    // progressively load video / audio and play when enough data is loaded
                    notify.push('Loading');

                    object.oncanplay = function() {
                        if(devOptions.verbose === 'full' || devOptions.verbose === 'minimal') {
                            console.log('[Media] Partially loaded, playing.');
                        }
                        notify.dismiss();
                        object.play();
                        watch(object);
                        media.poll.run(object);
                        status.control = 'playing';
                    }
                }

                if(status.control === 'seeking' && typeof timecode === 'number') {
                    object.currentTime = timecode;
                    subtitles.reset(timecode);
                    object.play();
                    object.ontimeupdate = function() {
                        // assuming we don't need this, that the listener remains
                    };
                    this.poll.run(object);
                    status.control = 'playing';
                    return;
                }

                if(object.paused === true && status.control === 'paused') {
                    // check if media was paused, if so, simply unpause

                    notify.dismiss();
                    object.play();
                    object.ontimeupdate = function() {

                    };
                    this.poll.run(object);
                    status.control = 'playing';
                    return;
                }
            }
        }

        function listen(callback) {
            // add an event listener
            mediaObject.addEventListener('timeupdate', function() {
                callback(mediaObject.currentTime);
            });
        }

        function watch(object) {
            // everytime the timecode changes, the following series of actions are taken:
            //  - check to see if any subtitle needs displaying
            //  - check to see if a scene event needs to be fired
            object.ontimeupdate = function() {
                // I begin my watch...
                subtitles.check(object.currentTime);
            };
        }

        var poll = (function() {
            var pollEvent,
                pollInterval = 300,
                playbackStopEvents = 0,
                playBackStopState = false;

            return {
                run: function(object) {
                    var oldTime = object.currentTime,
                        newTime;

                    pollEvent = setInterval(function() {
                        newTime = object.currentTime;
                        // perform analysis
                        if(oldTime !== newTime) {
                            // all ok
                            if(playBackStopState === true) {
                                playBackStopState = false;
                                notify.dismiss();
                            }
                            oldTime = newTime;
                        }
                        else {
                            // else do this if playback has stopped
                            if(devOptions.verbose === 'full' || devOptions.verbose === 'minimal') {
                                console.log('[Poll] Video has stopped playing.');
                            }
                            if(playBackStopState === false) { // check if it hasn't stopped before
                                if(devOptions.verbose === 'full' || devOptions.verbose === 'minimal') {
                                    console.log('[Poll] This is the first time the video has stopped without user input.');
                                }
                                playbackStopEvents = playbackStopEvents + 1;
                            }
                            playBackStopState = true;
                            notify.push('Buffering');
                        }
                    }, pollInterval);
                },
                end: function() {
                    clearInterval(pollEvent);
                }
            }
        })();

        function create(container, media, callback) {
            // --
            // Creates a media object and posts to DOM
            // --
            var mediaElement;

            function audio() {
                // TODO

                return;
            }

            var Video = function() {
                // --
                // Create video element for screen
                // --

                var element = document.createElement('video'),
                    child1 = document.createElement('source'),
                    child2 = document.createElement('source'),
                    width = environment.screenObjects.mediaGroup.offsetWidth,
                    height = environment.screenObjects.mediaGroup.offsetHeight;

                element.setAttribute('width', width);
                element.setAttribute('height', height);
                element.setAttribute('id', id.video);

                if(typeof media.video.ogg === 'string') {
                    child1.setAttribute('src', media.video.ogg);
                    child1.setAttribute('type', 'video/ogg');
                    element.appendChild(child1);
                }

                if(typeof media.video.mp4 === 'string') {
                    child2.setAttribute('src', media.video.mp4);
                    child2.setAttribute('type', 'video/mp4');
                    element.appendChild(child2);
                }

                status.id = id.video;

                element.parameters = {};

                if(media.video.muted === true) {
                    element.muted = true;
                }

                // overrides any previous settings
                if(devOptions.muteAudio === true) {
                    element.muted = true;
                }

                if(media.video.controls === true) {
                    element.controls = true;
                    //element.setAttribute('controls', true);
                }

                if(media.video.autoplay === true) {
                    element.parameters.autoplay = true;
                }

                if(media.video.loop === true) {
                    element.parameters.loop = true;

                    // check if loop in is a number, if it isn't set in point to 0 by default
                    if(typeof media.video.loop_in === 'number') {
                        element.parameters.loopIn = media.video.loop_in;
                    } else {
                        element.parameters.loopIn = 0;
                    }

                    // check if loop out is a number, if it isn't, default to null
                    if(typeof media.video.loop_out === 'number') {
                        element.parameters.loopOut = media.video.loop_out;
                    } else {
                        element.parameters.loopOut = null;
                    }
                }

                return element;
            };

            function graphic() {

                return;
            }

            environment.screenObjects.mediaGroup.appendChild(container);

            if(!callback){
                throw 'Expected callback';
            }

            if(media.type === 'audio') {
                callback(audio());
            }
            else if(media.type === 'video') {
                mediaElement = new Video();
                container.appendChild(mediaElement);
                callback(mediaElement);
            }
            else if(media.type === 'graphic') {
                callback(graphic());
            }
            else {
                throw 'Invalid media type';
            }
        }

        return {
            target: target,
            pause: pause,
            play: play,
            listen: listen,
            watch: watch,
            poll: poll,
            create: create
        }
    })();

    var notify = (function() {
        // lowers 'curtain' on screen and pushes notification
        var isActive = false,
            container = document.createElement('div'),
            child = document.createElement('div'),
            child2 = document.createElement('p');

        function position(object) {
            var availableWidth = window.innerWidth,
                availableHeight = window.innerHeight;

            utilities.style(object, {
                opacity: 0
            });

            var objWidth = object.offsetWidth,
                objHeight = object.offsetHeight,
                x = (availableWidth - objWidth) / 2 ,
                y = (availableHeight - objHeight) / 2;

            utilities.style(object, {
                position: 'absolute',
                display: 'block',
                left: x,
                top: y,
                opacity: 1
            });
        }

        return {
            push: function(message) {
                if(isActive === false) {
                    isActive = true; // set active flag
                    // create conditions for notification

                    container.setAttribute('id', id.notify);

                    // make child full size of screen
                    //node.maximise(container);

                    // animate the 'curtain falling' on stage

                    utilities.animateCSS(environment.screenObjects.stage, 'opacity', 1, 0.2, 200);

                    environment.screenObjects.root.appendChild(container);
                    container.appendChild(child);
                    child.appendChild(child2);
                }

                // push notification to screen

                child2.innerHTML = message;
                position(child);
            },

            dismiss: function() {
                if(isActive === false) {
                    return;
                }
                else {
                    // function goes here
                    isActive = false; // reset activity flag
                    environment.screenObjects.root.removeChild(container);
                    utilities.animateCSS(environment.screenObjects.stage, 'opacity', 0.2, 1, 200);
                }
            }
        };
    })();

    // Constructor function that creates instances of each scene
    var Scene = function(title, language, assets) {
        var that = this;
        this.title = title;
        this.shortName = assets.short_name;
        this.longName = assets.long_name;
        this.sceneId = utilities.cleanString(this.title);
        this.media = assets.media;
        this.subtitles = assets.media.subtitles[language];
        // why is this not here?
        //if(this.media === 'video') {
        //    this.video = assets.video;
        //}
        //if(this.media === 'audio') {
        //    this.audio = assets.audio;
        //}
        this.events = assets.events;
        this.container = (function() {
            var element = document.createElement('div');
            element.setAttribute('id', that.sceneId);
            element.media = that.media.type;
            return element;
        })();
    };

    // Constructor function that creates instances of each event
    var Event = function(id, call, schedule, parameters) {
        var that = this,
            plugin = new LoomSE.Modules();

        //check if the module reference exists as a function
        if(typeof plugin[call] === 'function') {
            var callModule = plugin[call]();
        }

        this.id = id; // event id
        this.call = call;
        this.status = status;
        this.in = schedule.in / 1000;
        this.out = schedule.out / 1000;
        this.parameters = parameters;
        this.run = function() {
            callModule.run(environment.screenObjects.overlay, that);
        };
        this.stop = function() {
            callModule.stop();
        };
    };

    //
    // Public
    //

    var publicMethods = {};

    // namespace for our external modules
    publicMethods.Modules = function() {
    };

    publicMethods.loadSubtitles = function(url) {
        subtitles.parse(url);
    };

    publicMethods.timecode = function() {
        setInterval(function() {
            console.log(mediaObject.currentTime);
        }, 500);
    };

    publicMethods.events = function() {
        console.log(currentScene.events);
    };

    publicMethods.notify = function(message) {
        // temporary function to test the notification function
        notify.push(message);
    };

    publicMethods.notifyDismiss = function(message) {
        // temporary function to test the notification function
        notify.dismiss();
    };

    publicMethods.eventQueue = function() {
        // temporary function to show event queue
        console.log(events.returnQueue());
    };

    publicMethods.runCounter = function() {
    // temporary function designed to call a module from console

        var j = new Loom.Modules(),
            o = j.mediaTime(),
            data = {
                status: {
                    media: 'video',
                    id: status.id
                },
                id: 'mediaTime',
                parameters: {
                    x: 70,
                    y: 70,
                    class: 'mediaTime'
                }
            };

        o.run(document.getElementById(overlay.id), data);
    };

    // Properties
    publicMethods.publicProperty = null;

    // Methods
    publicMethods.initialise = function(target, scriptFile, firstScene, resolution) {
        // --
        // Program begins here. Runs once and sets sets up the environment.
        // --

        //var body = document.getElementsByTagName('body');
        //body[0].setAttribute('onresize', 'Loom.control.viewportResize()');

        //window.onresize = Loom.control.viewportResize();

        //window.addEventListener('resize', Loom.rez(), true);k

        //if(environment.check() == false){
        //    console.log('WARNING: Screen too small');
        //}

        // load script file and check the returned data

        utilities.ajaxRequest(scriptFile, 'JSON', true, function(returnedData) {
            script = returnedData;

            // this doesnt actually do anything yet
            minimumResolution.width = script.settings.minimum_resolution.width; // TODO check value is number
            minimumResolution.height = script.settings.minimum_resolution.height;

            environment.screenObjects.root = document.getElementById(target);
            environment.screenObjects.stage = document.getElementById(id.stage);
            environment.screenObjects.mediaGroup = document.getElementById(id.mediaGroup);
            environment.screenObjects.overlay = document.getElementById(id.overlay);

            status.subtitles = script.settings.subtitles;

            // set our environment
            if(resolution){
                environment.resolution.width = resolution[0];
                environment.resolution.height = resolution[1];
            }
            else {
                environment.resolution.width = window.innerWidth;
                environment.resolution.height = window.innerHeight;
            }

            environment.resize(environment.screenObjects.mediaGroup, environment.resolution.width, environment.resolution.height);
            environment.resize(environment.screenObjects.overlay, environment.resolution.width, environment.resolution.height);
            readScript.setScene(script, firstScene);
        });
    };

    publicMethods.verbose = function() {
        devOptions.verbose = 'full'; // activate verbose mode from console
    };

    publicMethods.status = function() {
        // report stats on media
        // (unfinished)
        var selection = document.getElementById(status.id);

        console.log('Length of media file: ' + selection.duration);
        console.log(status);
    };

    publicMethods.control = (function () {
        // API for system control

        return {
            displayControls: function() {
                environment.gui.show();
            },

            pause: function() {
                media.pause(mediaObject);
                return 'Paused';
            },

            play: function() {
                media.play(mediaObject);
                return 'Playing';
            },

            scrub: function(time) {
                // scrub to time in media
                // time in seconds 4 = 4 seconds
                status.control = 'seeking';
                if(devOptions.disableScrubScreen === false) {
                    environment.reset();
                }
                media.play(mediaObject, time);
                return 'Seeking';
            },

            reload: function() {
                // restarts the current scene

                return 'Reloaded scene';
            },

            skip: function(sceneName) {
                // abandon current scene and load the named scene

                return 'Skipped to scene' + sceneName;
            },

            scaleMedia: function(dimensions, location) {
                // resizes currently playing media and repositions it
            },

            viewportResize: function() {
                // resizes the screen
                // node.maximise(environment.screenObjects.mediaGroup);
                // node.maximise(environment.screenObjects.overlay);
                //elements.array.forEach(function(element, index, array){
                //    // find all records that have position information
                //    if(element[1] !== null){
                //        //view.element(document.getElementById(element[0]),{
                //        //    position: element[1]
                //        //}).position();
                //    }
                //    // fullscreen elements
                //    if(element[1] === 'full'){
                //        maxDimensions(document.getElementById(element[0]));
                //    }
                //});
            },

            fullscreen: function() {
                // set app to fullscreen
            }
        };
    })();

    //Return just the public parts
    return publicMethods;
}());