var cache = {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    lastScrollY: window.pageYOffset,
    mousePosition: {
        x: 0,
        y: 0
    }
};

var get = function (prop) {
    return cache[prop];
};

var set = function (prop, value) {
    cache[prop] = value;
};

module.exports = {
    get: get,
    set: set
};
