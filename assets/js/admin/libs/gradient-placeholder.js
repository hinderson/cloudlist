'use strict';

var gradify = function (image) {
    // Colors which do not catch the eye
    var ignoredColors = [[0,0,0,], [255,255,255]];

    // Sensitivity to ignored colors
    var BWSensitivity = 4;

    function getCanvas (img) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.height = img.height;
        canvas.width = img.width;
        ctx.drawImage(img, 0, 0, 60, 60);
        return canvas;
    }

    function toImageData (img) {
        var canvas = getCanvas(img);
        var ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, 60, 60);
    }

    function getColorDiff (first, second) {
        // *Very* rough approximation of a better color space than RGB.
        return Math.sqrt(Math.abs(1.4 * Math.sqrt(Math.abs(first[0] - second[0])) +
            0.8 * Math.sqrt(Math.abs(first[1] - second[1])) + 0.8 * Math.sqrt(Math.abs(first[2] - second[2]))));
    }

    function createCSS (colors) {
        var directionMap = {
            0: 'right top',
            90: 'left top',
            180: 'left bottom',
            270: 'right bottom',
            360: 'right top'
        };

        var gradientCss = '';
        for (var i = 0; i < colors.length; i++) {
            var oppDir = directionMap[(colors[i][3] + 90) % 360];
            gradientCss += 'linear-gradient(to ' + oppDir + ', rgba(' +
                colors[i][0] + ',' + colors[i][1] + ',' + colors[i][2] + ',0) 0%, rgba(' +
                colors[i][0] + ',' + colors[i][1] + ',' + colors[i][2] + ',1) 100%),';
        }
        gradientCss = gradientCss.slice(0, -1);

        return gradientCss;
    }

    function getQuads (colors) {
        // Second iterration of pix data is nescessary because
        // now we have the base dominant colors, we have to check the
        // Surrounding color space for the average location.
        // This can/will be optimized a lot

        // Resultant array;
        var quadCombo = [0,0,0,0];
        var takenPos = [0,0,0,0];

        // Keep track of most dominated quads for each col.
        var quad = [
            [[0,0],[0,0]],
            [[0,0],[0,0]],
            [[0,0],[0,0]],
            [[0,0],[0,0]],
        ];

        for (var j = 0; j < this.data.data.length; j+= 4) {
            // Iterate over each pixel, checking it's closeness to our colors.
            var r = this.data.data[j];
            var g = this.data.data[j+1];
            var b = this.data.data[j+2];
            for (var i = 0; i < colors.length; i++) {
              var color = colors[i];
              var diff = getColorDiff(color, [r,g,b]);
              if (diff < 4.3) {
                // If close enough, increment color's quad score.
                var xq = (Math.floor(((j/4)%60.0)/30));
                var yq = (Math.round((j/4)/(60.0*60)));
                quad[i][yq][xq] += 1;
              }
            }
        }

        for (var i = 0; i < colors.length; i++) {
            // For each col, try and find the best avail quad.
            var quadArr = [];
            quadArr[0] = quad[i][0][0];
            quadArr[1] = quad[i][1][0];
            quadArr[2] = quad[i][1][1];
            quadArr[3] = quad[i][0][1];
            var found = false;

            for (var j = 0; !found; j++) {
                var bestChoice = quadArr.indexOf(Math.max.apply(Math, quadArr));
                if (Math.max.apply(Math, quadArr)===0) {
                    colors[i][3] = 90 * quadCombo.indexOf(0);
                    quadCombo[quadCombo.indexOf(0)] = colors[i];
                    found = true;
                }
                if (takenPos[bestChoice] === 0) {
                    colors[i][3] = 90 * bestChoice;
                    quadCombo[i] = colors[i];
                    takenPos[bestChoice] = 1;
                    found = true;
                    break;
                } else {
                    quadArr[bestChoice] = 0;
                }
            }
        }

        // Create the rule.
        return createCSS(quadCombo);
    }

    function getColors (colors) {
        // Select for dominant but different colors.
        var selectedColors = [],
            found = false,
            diff;

        var sensitivity = sensitivity;
        var bws = BWSensitivity;

        while (selectedColors.length < 4 && !found) {
            selectedColors = [];
            for (var j=0; j < colors.length; j++) {
                var acceptableColor = false;
                // Check curr color isn't too black/white.
                for (var k = 0; k < ignoredColors.length; k++) {
                    diff = getColorDiff(ignoredColors[k], colors[j][0]);
                    if (diff < bws) {
                      acceptableColor = true;
                      break;
                    }
                }

                // Check curr color is not close to previous colors
                for (var g = 0; g < selectedColors.length; g++) {
                    diff = getColorDiff(selectedColors[g], colors[j][0]);
                    if (diff < sensitivity) {
                      acceptableColor = true;
                      break;
                    }
                }

                if (acceptableColor) { continue; }
                // IF a good color, add to our selected colors!
                selectedColors.push(colors[j][0]);
                if (selectedColors.length > 3) {
                    found = true;
                    break;
                }
            }

            // Decrement both sensitivities.
            if (bws > 2) {
                bws -= 1;
            } else {
                sensitivity--;
                // Reset BW sensitivity for new iteration of lower overall sensitivity.
                bws = this.BWSensitivity;
            }
        }
        return getQuads(selectedColors);
    }

    function handleData (data) {
        // Count all colors and sort high to low.
        var r = 0,
            b = 0,
            g = 0;

        this.data = data;
        var colorMap = {};

        for (i = 0; i < data.data.length; i += 4) {
            r = data.data[i];
            g = data.data[i+1];
            b = data.data[i+2];
            // Pad the rgb values with 0's to make parsing easier later.
            var newCol = ('00' + r.toString()).slice(-3) + ('00' + g.toString()).slice(-3) + ('00' + b.toString()).slice(-3);
            if (newCol in colorMap) {
                colorMap[newCol].val += 1;
            } else {
                colorMap[newCol] = { 'val': 0 };
            }
        }
        var items = Object.keys(colorMap).map(function(key) {
            return [[parseInt(key.slice(0, 3)), parseInt(key.slice(3, 6)), parseInt(key.slice(6, 9))], colorMap[key].val];
        });
        items.sort(function(first, second) {
            return second[1] - first[1];
        });
        this.colMap = colorMap;
        return getColors(items);
    }

    return handleData(toImageData(image));
};

module.exports = gradify;
