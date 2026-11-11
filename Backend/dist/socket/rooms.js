"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_ROOM = void 0;
exports.userRoom = userRoom;
function userRoom(userId) {
    return `user:${userId}`;
}
exports.ADMIN_ROOM = "admin_room";
