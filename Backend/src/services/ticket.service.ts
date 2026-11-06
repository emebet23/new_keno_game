import { Prisma, TicketStatus } from "@prisma/client";
import { TicketRepository, CreateTicketData } from "../repositories/ticket.repository";

export class TicketService {
  private repository = new TicketRepository();

  create(tx: Prisma.TransactionClient, data: CreateTicketData) {
    return this.repository.create(tx, data);
  }

  getByGame(tx: Prisma.TransactionClient, gameId: string) {
    return this.repository.getByGame(tx, gameId);
  }

  findByGameId(tx: Prisma.TransactionClient, gameId: string) {
    return this.repository.findByGameId(tx, gameId);
  }

  settle(
    tx: Prisma.TransactionClient,
    ticketId: string,
    data: { matches: number; multiplier: number; payout: number; status: TicketStatus }
  ) {
    return this.repository.settle(tx, ticketId, data);
  }

  getUserTickets(userId: string, page = 1, limit = 20) {
    return this.repository.findByUserId(userId, page, limit);
  }

  getById(id: string) {
    return this.repository.findById(id);
  }
}
