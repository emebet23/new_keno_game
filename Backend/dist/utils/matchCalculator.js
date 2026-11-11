"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countMatches = countMatches;
function countMatches(selected, draw) {
    let matches = 0;
    for (const number of selected) {
        if (draw.includes(number)) {
            matches++;
        }
    }
    return matches;
}
