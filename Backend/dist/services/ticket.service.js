"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketService = void 0;
const ticket_repository_1 = require("../repositories/ticket.repository");
class TicketService {
    repository = new ticket_repository_1.TicketRepository();
    create(tx, data) {
        return this.repository.create(tx, data);
    }
    getByGame(tx, gameId) {
        return this.repository.getByGame(tx, gameId);
    }
    findByGameId(tx, gameId) {
        return this.repository.findByGameId(tx, gameId);
    }
    settle(tx, ticketId, data) {
        return this.repository.settle(tx, ticketId, data);
    }
    getUserTickets(userId, page = 1, limit = 20) {
        return this.repository.findByUserId(userId, page, limit);
    }
    getById(id) {
        return this.repository.findById(id);
    }
}
exports.TicketService = TicketService;
