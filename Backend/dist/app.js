"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const wallet_route_1 = __importDefault(require("./routes/wallet.route"));
const game_routes_1 = __importDefault(require("./routes/game.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const wallet_routes_1 = __importDefault(require("./payment/routes/wallet.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const live_keno_service_1 = require("./services/live-keno.service");
// Prevent BigInt serialization TypeError in JSON responses
BigInt.prototype.toJSON = function () {
    return this.toString();
};
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// === Live Keno Atlas V Endpoints ===
app.post("/gethash", (req, res) => {
    const { key, salt } = req.body || {};
    if (!key || !salt) {
        return res.status(400).json({ error: "Missing key or salt" });
    }
    const engine = live_keno_service_1.LiveKenoEngine.getInstance();
    const hash = engine.verifyHash(String(key), String(salt));
    return res.json({ hash });
});
app.post("/mygamehistory", (req, res) => {
    const { player_id, token, page } = req.body || {};
    const userId = String(player_id || token || "demo_player");
    const pageNum = parseInt(page, 10) || 0;
    const engine = live_keno_service_1.LiveKenoEngine.getInstance();
    const result = engine.getUserGameHistory(userId, pageNum);
    return res.json(result);
});
app.get("/", (_, res) => {
    res.json({
        name: "Keno Game API Engine",
        status: "running",
        version: "1.0.0",
        docs: {
            auth: "/auth/telegram",
            wallet: "/wallet",
            play: "/games/keno/play",
            current: "/games/keno/current",
            result: "/games/keno/result/:id",
            history: "/games/keno/history",
            provablyFair: "/games/keno/provably-fair",
            admin: "/admin/*",
        },
    });
});
app.use("/auth", auth_routes_1.default);
app.use("/", wallet_route_1.default);
app.use("/", wallet_routes_1.default);
app.use("/games/keno", game_routes_1.default);
app.use("/admin", admin_routes_1.default);
// Global Error Handler
app.use(error_middleware_1.errorHandler);
exports.default = app;
