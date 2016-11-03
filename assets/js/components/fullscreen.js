'use strict';

var pubsub = require('../pubsub.js');

var toggleFullscreen = function ( ) {
    document.fullscreenEnabled =
        document.fullscreenEnabled ||
        document.mozFullScreenEnabled ||
        document.msFullscreenEnabled ||
        document.documentElement.webkitRequestFullScreen;

    if (!document.fullscreenElement && !document.mozFullScreenElement &&
            !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }

        pubsub.publish('fullscreen', true);
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }

        pubsub.publish('fullscreen', false);
    }
};

// Listen for keyboard presses
pubsub.subscribe('keysPressed', function (keys) {
    if (keys.constructor === Array && keys.indexOf(16) !== -1 && keys.indexOf(70) !== -1) {
        toggleFullscreen();
    }
});

function Fullscreen (elem) {
    elem.addEventListener('click', toggleFullscreen);

    return {
        toggle: toggleFullscreen
    };
}

module.exports = Fullscreen;
