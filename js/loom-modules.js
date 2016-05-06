// displays current media time on screen

loomSE.Modules.prototype.loop = function() {
    // loops video between in and out points

    return {
        run: function(container) {
            loomSE.control.scrub(container.loomSE_schedule.out);
        },
        stop: function() {

        }
    }
};

loomSE.Modules.prototype.mediaTime = function() {
    // add an on screen timer
    // time linked to media time

    var update;

    return {
        run: function(container) {
            var clock,
                xy = loomSE.Modules.locatePerc(container.loomSE_parameters.x, container.loomSE_parameters.y, container.loomSE_resolution.width, container.loomSE_resolution.height),
                element = document.createElement('span');

            function updateTime() {
                clock = loomSE.currentTime.object();
                element.innerHTML = clock.hours + ':' + clock.minutes + ':' + clock.seconds + ':' + clock.split;
            }

            container.appendChild(element);
            updateTime();

            loomSE.Modules.draw(container, xy);

            update = setInterval(
                function() {
                    updateTime();
                }, 250
            );
        },
        stop: function() {
            clearInterval(update);
        }
    };
};

// returns a pixel position from a %

loomSE.Modules.locatePerc = function(percentage_x, percentage_y, total_x, total_y) {
    // using a co-ordinate system of %, place objects on screen

    var dimensions = getDimensions(),
        pixel_x = (dimensions[0] / 100 * percentage_x),
        pixel_y = (dimensions[1] / 100 * percentage_y);

    return [pixel_x, pixel_y];

    function getDimensions() {
        var availableWidth = total_x,
            availableHeight = total_y;

        return [availableWidth, availableHeight];
    }
};

// output to the screen

loomSE.Modules.draw = function(element, xy) {

    loomSE.Modules.setCSS(element, {
        position: 'absolute',
        left: xy[0],
        top: xy[1]
    });
};

loomSE.Modules.setCSS = function(element, object) {
    for (var attribute in object) {
        var value = object[attribute];

        switch (attribute) {
            case 'width':
            case 'height':
            case 'top':
            case 'left':
            case 'right':
            case 'bottom':
            case 'padding':
            case 'padding-left':
            case 'padding-right':
            case 'padding-top':
            case 'padding-bottom':
                value = value + 'px';
        }
        element.style[attribute] = value;
    }
};