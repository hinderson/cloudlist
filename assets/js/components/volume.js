'use strict';

var audio = require('../audio.js');

function setVolume (e) {
    audio.setVolume(e.target.value / 100);
}

function Volume (elem) {
    elem.addEventListener('input', setVolume);
    elem.value = audio.getVolume() * 100; // Set initial (visual) volume state based on saved user states

    return {
        set: setVolume
    };
}

module.exports = Volume;
