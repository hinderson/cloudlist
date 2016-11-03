'use strict';

var pubsub = require('../pubsub.js');

var elems = {
    dialog: document.getElementsByClassName('dialog')[0],
    closeDialog: document.getElementsByClassName('close-dialog')[0],
    dialogOverlay: document.getElementsByClassName('dialog-overlay')[0],
};

var toggleDialog = function ( ) {
    if (document.documentElement.classList.contains('overlay')) {
        elems.dialog.setAttribute('aria-hidden', true);
        document.documentElement.classList.remove('overlay');
    } else {
        elems.dialog.setAttribute('aria-hidden', false);
        document.documentElement.classList.add('overlay');
    }
};

pubsub.subscribe('keysPressed', function (key) {
    if (key === 27) {
        elems.dialog.setAttribute('aria-hidden', true);
        document.documentElement.classList.remove('overlay');
    }
});

elems.dialogOverlay.addEventListener('click', toggleDialog);
elems.closeDialog.addEventListener('click', toggleDialog);

function Dialog (elem) {
    elem.addEventListener('click', toggleDialog);

    return {
        toggle: toggleDialog
    };
}

module.exports = Dialog;
