"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
class Validator {
    static validateTicket(numbers, bet) {
        if (bet <= 0)
            throw new Error("Invalid bet amount");
        if (numbers.length < 1 || numbers.length > 10)
            throw new Error("Select between 1 and 10 numbers");
        const unique = new Set(numbers);
        if (unique.size !== numbers.length)
            throw new Error("Duplicate numbers selected");
        for (const number of numbers) {
            if (number < 1 || number > 80)
                throw new Error("Invalid number selected");
        }
    }
}
exports.Validator = Validator;
