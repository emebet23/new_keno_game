// ============================================
// PARTITION 1: WebSocket Variables and Connection Setup
// ============================================

var socket;
var _loginStatus = false;
var _connectionStatus = false;
var _game_init = false;
var _start_init = false;
var _can_reconnect = true;
var _demo_popup_timer = 0;
var _language = "en";
var _socketid = "init";
var _loader_hidden = false;
var _ticket_retry_used = false;

function setReconnectBannerVisible(visible) {
    var banner = document.getElementById("kenoReconnectBanner");
    if (!banner) return;
    if (visible) banner.removeAttribute("hidden");
    else banner.setAttribute("hidden", "");
}

/** Hide Atlas splash only after first successful init (or a fatal login error). */
function hideInitialLoader() {
    if (_loader_hidden) return;
    _loader_hidden = true;
    $(".loader").addClass("done");
}

/** BET stays on WAIT until login snapshot (wallet) is on screen. */
function setBetLockedUntilWallet(locked) {
    if (locked) $(".bet_set_btn").addClass("wait");
    else $(".bet_set_btn").removeClass("wait");
}

// Socket.IO connection
function initializeSocket() {
    // Socket.IO Manager expects http(s):// — passing ws:// makes the client fall
    // back to a relative /socket.io path (e.g. /keno/socket.io → 404).
    var base = (typeof _server_url === 'string' && /^https?:\/\//i.test(_server_url))
        ? _server_url.replace(/\/$/, '')
        : window.location.origin;
    var wsUrl = base + '/gamesocket';
    if (socket) {
        try { socket.removeAllListeners(); socket.close(); } catch (e) { /* ignore */ }
    }
    socket = io(wsUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 8000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
        console.log("connected");
        _connectionStatus = true;
        setReconnectBannerVisible(false);
        if (_game_init) {
            Socket_Login();
        }
    });

    socket.on("message", (data) => {
        if (data.status) {
            if (data.status == "eventresp") {
                Socket_onMyEventGet(data.data);
            } else if (data.status == "roomevent") {
                Socket_onRoomEventsGet(data.data);
            } else if (data.status == "error") {
                Socket_onError(data.data);
            }
        }
    });

    socket.on("disconnect", (reason) => {
        console.log("disconnected:", reason);
        _loginStatus = _connectionStatus = false;
        setBetLockedUntilWallet(true);
        if (_can_reconnect) {
            setReconnectBannerVisible(true);
        }
    });

    socket.on("connect_error", (error) => {
        console.log("connection error:", error);
        _connectionStatus = false;
        if (_can_reconnect) {
            setReconnectBannerVisible(true);
        }
    });

    socket.on("reconnect_attempt", () => {
        if (_can_reconnect) setReconnectBannerVisible(true);
    });

    socket.on("reconnect", () => {
        setReconnectBannerVisible(false);
    });
}

window.addEventListener("offline", function () {
    if (_can_reconnect) setReconnectBannerVisible(true);
});
window.addEventListener("online", function () {
    if (socket && socket.connected) setReconnectBannerVisible(false);
});

// Initialize connection
initializeSocket();

// ============================================
// PARTITION 2: Socket Event Handler Functions
// ============================================

function Socket_onRoomEventsGet(t) {
    if (window.KenoChat && (t.status == "chat" || t.status == "chat_reaction" || t.status == "chat_rain_update" || t.status == "online")) {
        KenoChat.onRoomEvent(t);
    }
    if (_game_init && _start_init) {
        if (t.status == "play") {
            GamePlay(t);
        } else if (t.status == "wait") {
            UpdateTimer(t);
        } else if (t.status == "newgame") {
            NewGame(t);
            if (_demo_game && ++_demo_popup_timer == 3) {
                _demo_popup_timer = 0;
                if (document.getElementById("first_screen_pop_up")) {
                    document.getElementById("first_screen_pop_up").style.display = "block";
                }
            }
        } else if (t.status == "ticketsset") {
            OtherBetSet(t);
        }
    }
}

function readStoredFreeBetPreference() {
    try {
        return sessionStorage.getItem(KENO_FREE_BET_KEY);
    } catch (e) {
        return null;
    }
}

function writeStoredFreeBetPreference(value) {
    try {
        if (value == null) sessionStorage.removeItem(KENO_FREE_BET_KEY);
        else sessionStorage.setItem(KENO_FREE_BET_KEY, String(value));
    } catch (e) {}
}

function resolveSelectedFreeBetId() {
    var stored = readStoredFreeBetPreference();
    if (stored === "cash" || stored === "") {
        return null;
    }
    if (stored != null && _free_bets.some(function(fb) { return String(fb.id) === String(stored); })) {
        return stored;
    }
    // No preference yet: default to cash so the picker matches "Play with cash"
    if (stored == null) {
        return null;
    }
    return null;
}

function syncBetControlsForFreeBetMode() {
    _global_free_spins = _free_bets.length;
    var selected = _selected_free_bet_id != null
        ? _free_bets.find(function(fb) { return String(fb.id) === String(_selected_free_bet_id); })
        : null;

    if (selected) {
        _bet = Number(selected.amount) || _min_bet;
        $("#bet_input_bar").val(_bet);
        if (!$(".bet_input").hasClass("disable")) {
            $(".bet_input").addClass("disable");
        }
        var freeLabel = (_all_translation[_language] && _all_translation[_language].free) || "Free";
        $("#trs_place").html(freeLabel + " ( " + _global_free_spins + " )");
    } else {
        $(".bet_input").removeClass("disable");
        var placeLabel = (_all_translation[_language] && _all_translation[_language].place_bet) || "BET";
        $("#trs_place").text(placeLabel);
    }

    $("#kenoFreeBetGearBtn").toggleClass("has-freebets", _free_bets.length > 0);
}

function kenoFreeBetPanelHtml() {
    var cashSelected = _selected_free_bet_id == null;
    var currencyHint = (typeof _currency === "string" ? _currency.replace(/<[^>]*>/g, "") : "") || "";
    var html = "";

    html += '<div class="keno-fb-section-label">Betting mode</div>';
    html += '<button type="button" class="keno-fb-option' + (cashSelected ? " selected" : "") + '" data-free-bet-id="">';
    html += '<span class="keno-fb-radio" aria-hidden="true"></span>';
    html += '<span class="keno-fb-option-text">';
    html += '<span class="keno-fb-option-title">PLAY WITH CASH</span>';
    html += '<span class="keno-fb-option-meta">Use your real balance' + (currencyHint ? (" (" + currencyHint + ")") : "") + "</span>";
    html += "</span></button>";

    html += '<div class="keno-fb-header">ACTIVE FREE BETS</div>';

    if (!_free_bets.length) {
        html += '<div class="keno-fb-empty">You have no free bets yet</div>';
        return html;
    }

    _free_bets.forEach(function(fb, index) {
        var active = String(fb.id) === String(_selected_free_bet_id);
        var amount = Number(fb.amount);
        var amountLabel = (typeof formatMoney === "function" ? formatMoney(amount) : amount);
        var currency = fb.currency || currencyHint || "";
        var exp = fb.expiresAt
            ? new Date(fb.expiresAt).toLocaleString()
            : null;
        html += '<button type="button" class="keno-fb-option' + (active ? " selected" : "") + '" data-free-bet-id="' + String(fb.id) + '" data-free-bet-amount="' + amount + '">';
        html += '<span class="keno-fb-radio" aria-hidden="true"></span>';
        html += '<span class="keno-fb-option-text">';
        html += '<span class="keno-fb-option-title">FREE BET' + (_free_bets.length > 1 ? (" #" + (index + 1)) : "") + "</span>";
        html += '<span class="keno-fb-option-amount">' + amountLabel + (currency ? (" " + currency) : "") + "</span>";
        if (exp) {
            html += '<span class="keno-fb-option-meta">Expires: ' + exp + "</span>";
        } else {
            html += '<span class="keno-fb-option-meta">No expiry</span>';
        }
        html += "</span></button>";
    });
    return html;
}

function renderKenoFreeBetPanels() {
    var markup = kenoFreeBetPanelHtml();
    var menu = document.getElementById("kenoFreeBetMenuPanel");
    var modal = document.getElementById("kenoFreeBetModalPanel");
    if (menu) menu.innerHTML = markup;
    if (modal) modal.innerHTML = markup;
}

function selectKenoFreeBet(freeBetId) {
    if (freeBetId == null || freeBetId === "") {
        _selected_free_bet_id = null;
        writeStoredFreeBetPreference("cash");
    } else {
        var match = _free_bets.find(function(fb) { return String(fb.id) === String(freeBetId); });
        if (!match) return;
        _selected_free_bet_id = match.id;
        writeStoredFreeBetPreference(String(match.id));
    }
    syncBetControlsForFreeBetMode();
    renderKenoFreeBetPanels();
}

function openKenoFreeBetModal() {
    renderKenoFreeBetPanels();
    var modal = document.getElementById("kenoFreeBetModal");
    if (modal) modal.hidden = false;
}

function closeKenoFreeBetModal() {
    var modal = document.getElementById("kenoFreeBetModal");
    if (modal) modal.hidden = true;
}

function applyFreeBetsFromPayload(t) {
    if (Array.isArray(t.free_bets)) {
        _free_bets = t.free_bets.slice();
    }
    if (t.freespin_count != null && !Array.isArray(t.free_bets)) {
        _global_free_spins = Number(t.freespin_count) || 0;
    } else {
        _global_free_spins = _free_bets.length;
    }

    if (!_free_bets.length) {
        _selected_free_bet_id = null;
    } else {
        _selected_free_bet_id = resolveSelectedFreeBetId();
        // If preference pointed at a used free bet, clear to cash
        if (_selected_free_bet_id != null) {
            var still = _free_bets.some(function(fb) {
                return String(fb.id) === String(_selected_free_bet_id);
            });
            if (!still) {
                _selected_free_bet_id = null;
                writeStoredFreeBetPreference("cash");
            }
        }
    }

    syncBetControlsForFreeBetMode();
    renderKenoFreeBetPanels();
}

function Socket_onMyEventGet(t) {
    if (t.status == "login") {
        if (t.error) {
            _loginStatus = false;
            var errText = String(t.error || "");
            var isStaleTicket = /invalid or expired connection ticket/i.test(errText)
                || /invalid connection ticket/i.test(errText);
            var canRetryWithToken = isStaleTicket
                && !_ticket_retry_used
                && !_demo_game
                && Boolean(_user_token)
                && _user_token !== "demo"
                && _user_token !== "local-demo";
            if (canRetryWithToken) {
                _ticket_retry_used = true;
                clearConnTicket();
                Socket_Login();
                return;
            }
            $("#socket_status_text").text(t.error);
            $("#socket_status").show();
            // Don't leave users stuck on the splash if login fails.
            hideInitialLoader();
            return;
        }
        _loginStatus = true;
        setBetLockedUntilWallet(false);
        _game_id = t.game_id;
        if (t.sid) {
            _socketid = t.sid;
        }
        if (t.ticket) {
            _conn_ticket = t.ticket;
            try {
                sessionStorage.setItem(KENO_TICKET_KEY, _conn_ticket);
            } catch (e) {}
        }
        if (t.player_id) {
            _user_id = t.player_id;
        }
        if (t.credit != null) {
            _credit = t.credit;
            $(".header_credit").html(formatMoney(_credit) + " " + _currency);
        }
        applyBetLimitsFromPayload(t);
        applyFreeBetsFromPayload(t);
        if (window.KenoChat) {
            KenoChat.onLoginSnapshot(t);
        } else {
            // chat-client may still be loading — apply when it boots
            window.__kenoPendingLogin = t;
        }
        if (_game_init && !_is_inited) {
            start_init(t);
        } else if (!_game_init && !_is_inited) {
            // Login beat document.ready — start_init when UI is ready.
            window.__kenoPendingStartInit = t;
        } else if (_is_inited) {
            // Re-login after reconnect — splash already dismissed.
            hideInitialLoader();
        }
    } else if (t.status == "ticketsset") {
        if (_game_init && _start_init) {
            MyBetSet(t);
        }
    } else if (t.status == "betclosed") {
        if (t.error) {
            $("#socket_status_text").text(t.error);
        } else {
            $("#socket_status_text").text(_all_translation[_language].wrong_data);
        }
        $("#socket_status").show();
        setTimeout(function() {
            $("#socket_status").hide();
        }, 2000);
        $(".bet_set_btn").addClass("active").removeClass("wait");
        if (t.credit != null) {
            _credit = t.credit;
            $(".header_credit").html(formatMoney(_credit) + " " + _currency);
        }
    } else if (t.status == "balance" && t.credit != null) {
        if (stashCreditDuringDraw(t.credit)) {
            return;
        }
        _credit = t.credit;
        paintHeaderCredit();
        if (window.KenoChat) {
            KenoChat.onMyEvent(t);
        }
    } else if (t.status == "rain_received" || t.status == "rain_claimed") {
        if (Array.isArray(t.free_bets)) {
            applyFreeBetsFromPayload(t);
        }
        if (window.KenoChat) {
            KenoChat.onMyEvent(t);
        }
    } else if (window.KenoChat && t.status == "chat_error") {
        KenoChat.onMyEvent(t);
    }
}

function Socket_SendEvent(t) {
    if (_loginStatus && socket) {
        socket.emit("message", {
            status: "event",
            data: t
        });
    }
}

function Socket_Login() {
    if (_connectionStatus && socket) {
        if (!_conn_ticket) {
            try {
                _conn_ticket = sessionStorage.getItem(KENO_TICKET_KEY) || null;
            } catch (e) {
                _conn_ticket = null;
            }
        }
        var payload = {
            status: "login",
            id: _user_id,
            token: _user_token,
            demo: _demo_game,
            sid: _socketid
        };
        if (_conn_ticket) {
            payload.ticket = _conn_ticket;
        }
        socket.emit("message", payload);
    }
}

function clearConnTicket() {
    _conn_ticket = null;
    try {
        sessionStorage.removeItem(KENO_TICKET_KEY);
    } catch (e) {}
}

function Socket_onError(t) {
    if (t == "session_expire") {
        _can_reconnect = false;
        hideInitialLoader();
        ShowWarning(_all_translation[_language].session_expire, false);
    }
}

// ============================================
// PARTITION 3: Game State Variables
// ============================================

var _game_id;
var _game_progress_interval;
var _tickets_carousel;
var _default_bet = 5;
var _bet = _default_bet;
var _credit = 100;
var _tickets = [];
var _my_tickets = [];
var _my_tickets_ids = [];
var _bufer_history = [];
var _leaders = [];
var _history = [];
var _numbers = [];
var _my_selected_numbers = [];
var _uniqu_selected_numbers = [];
var _game_status = 0;
var _copy_buffer = "";
var _is_buttons_set = 1;
var _cur_timer = 0;
var _is_desktop_left_right_set = 1;
var _mybethistorypage = 1;
var _mybethistoryids = [];
var _game_hash = "";
var _statistics = [];
var _game_progress_time = 0;
var _current_animated_index = 1;
var _animation_interval;
var DRAW_REVEAL_MS = 21000;
var _draw_reveal_timer = null;
var _draw_reveal_pending = false;
var _pending_credit = null;
var _payout_scale = 1;
var _all_kayfs = [
    [0, 3.5],
    [0, 1, 10],
    [0, 0, 2, 50],
    [0, 0, 1.5, 10, 80],
    [0, 0, 1, 3, 30, 150],
    [0, 0, 0, 2, 15, 60, 500],
    [1, 0, 0, 2, 4, 20, 80, 1000],
    [1, 0, 0, 0, 5, 15, 50, 200, 2000],
    [2, 0, 0, 0, 2, 10, 25, 125, 1000, 5000],
    [2, 0, 0, 0, 0, 5, 30, 100, 300, 2000, 10000]
];
var _can_increase_creadit = false;
var _my_tickets_nosent = [];
var _global_free_spins = 0;
var _free_bets = [];
var _selected_free_bet_id = null;
var KENO_TICKET_KEY = "keno_conn_ticket";
var KENO_FREE_BET_KEY = "keno_selected_free_bet";
var _conn_ticket = (function() {
    try {
        return sessionStorage.getItem(KENO_TICKET_KEY) || null;
    } catch (e) {
        return null;
    }
})();
var _is_inited = false;

// ============================================
// PARTITION 4: Initialization Functions
// ============================================

function start_init(t) {
    _game_hash = t.hash || "";
    _tickets = t.tickets;
    _leaders = t.leaders;
    _history = t.history;
    _statistics = t.statistics;
    _credit = parseFloat(_demo_game ? 10000 : t.credit);
    
    if (t.my_tickets) {
        _my_tickets = t.my_tickets;
    }
    
    if (_my_tickets.length > 0) {
        _my_tickets.map(function(t, e) {
            _my_tickets_ids.push(t.t.toString());
            addMyTicketsItemToGameTable(t, e + 1);
        });
    }
    
    if (_tickets.length > 0) {
        _tickets.map(function(t) {
            addOtherTicketsItemToGameTable(t);
        });
    }
    
    if (_statistics.length > 0) {
        UpdateStatistics();
    }
    
    if (_leaders && _leaders.length > 0) {
        LeaderTableUpdate(_leaders);
    }
    
    if (_history.length > 0) {
        _history.map(function(t) {
            addItemToHistoryTable(t);
        });
    }
    
    if (!$("#t" + _game_id)[0]) {
        _history.push({
            date: "",
            numbers: [],
            game_id: _game_id,
            hash: _game_hash,
            salt: "-",
            key: "-"
        });
        addItemToHistoryTable({
            game_id: _game_id,
            numbers: [],
            date: "",
            hash: _game_hash,
            salt: "-",
            key: "-"
        });
    }
    
    if (t.game_status == 1) {
        var betTime = parseInt(t.time, 10);
        if (!Number.isFinite(betTime) || betTime < 0) {
            betTime = 0;
        }
        UpdateTimer({
            time: betTime,
            total_count: t.total_count,
            tickets: t.tickets || []
        });
    } else if (t.game_status == 2 && t.numbers && t.numbers.length) {
        if (!$(".global_wrapper").hasClass("stopbet")) {
            $(".global_wrapper").addClass("stopbet");
        }
        // Hide betting timer during draw — ball counter is the only progress UI.
        if (_game_progress_interval) {
            clearInterval(_game_progress_interval);
            _game_progress_interval = null;
        }
        _game_progress_time = 0;
        $(".game_timer").removeClass("leyt").hide();
        $(".game_timer_sec").text("00");

        GamePlay({
            game_id: t.game_id || _game_id,
            numbers: t.numbers,
            date: t.date || Date.now(),
            total_count: t.total_count,
            salt: t.salt || "",
            key: t.key || "",
            hash: t.hash || _game_hash,
            elapsed: t.elapsed || 0,
            skip_stats: true
        });
    }
    
    if (_tickets_carousel && _my_tickets.length == 0) {
        $(".bet_sele").each(function() {
            $(this).parent().remove();
        });
        _tickets_carousel.trigger("destroy.owl.carousel");
        _tickets_carousel = $("#tickets_carousel").owlCarousel({
            loop: false,
            margin: 10,
            nav: false,
            dots: false,
            items: 1,
            center: true
        });
        $(".total_tickets_count").text("0");
        $(".my_tickets_count").text("0");
        $(".my_bets_count").text("0");
    }
    
    $(".header_credit").html(formatMoney(_credit) + " " + _currency);
    $(".game_id_num").text(_game_id);
    $(".game_id").attr("data-hash", _game_hash);
    $(".game_id").attr("data-id", _game_id);
    
    applyFreeBetsFromPayload(t);
    
    _start_init = true;
    _is_inited = true;
    hideInitialLoader();
}

function close_game() {
    console.log("game closed");
    window.parent.history.back();
}

/** Desktop left-sidebar Fairness/Atlas brand: show only when active tab is empty. */
function updateKenoSidebarBrand() {
    var brand = document.querySelector(".keno-sidebar-brand");
    if (!brand) return;
    var isDesktop = window.innerWidth > 710 && !document.body.classList.contains("keno-mobile-layout");
    if (!isDesktop) {
        brand.classList.remove("is-visible");
        return;
    }
    var $active = $(".content_left_side .tab_cont.active");
    if (!$active.length) {
        brand.classList.remove("is-visible");
        return;
    }
    var empty = false;
    if ($active.hasClass("cont_tab1")) {
        empty = $active.find(".game_table .table_row").length === 0;
    } else if ($active.hasClass("cont_tab2")) {
        empty = $active.find(".game_mybet_history .tab_history_itm").length === 0;
    } else if ($active.hasClass("cont_tab3")) {
        empty = $active.find(".game_history .table_row").length === 0;
    } else if ($active.hasClass("cont_tab4")) {
        empty = $active.find(".statistics_table .table_row, .statistics_table .statistic_num").length === 0;
    } else if ($active.hasClass("cont_tab5")) {
        empty = $active.find(".game_leaders .table_row").length === 0;
    }
    brand.classList.toggle("is-visible", empty);
}

function ResizeContent() {
    var t, e;
    
    if (window.innerWidth > 710 && _is_desktop_left_right_set == 2) {
        $(".bet_board").append($(".bet_input"));
        $(".left_side_tabs_top").append($("#tab1"));
        $(".left_side_tabs_top").append($("#tab2"));
        $(".left_side_tabs_top").append($("#tab3"));
        $(".left_side_tabs_top").append($("#tab4"));
        $(".left_side_tabs_top").append($("#tab5"));
        $(".left_side_tabs_cont").append($(".cont_tab1"));
        $(".left_side_tabs_cont").append($(".cont_tab2"));
        $(".left_side_tabs_cont").append($(".cont_tab3"));
        $(".left_side_tabs_cont").append($(".cont_tab4"));
        $(".left_side_tabs_cont").append($(".cont_tab5"));
        $(".canvas_wrap").append($(".bottom_wrap"));
        $(".statistic_ui").append($("#kenoChatOverlay"));
        $(".tab_itm").removeClass("active");
        $(".tab_cont").removeClass("active");
        $("#tab1").addClass("active");
        $(".cont_tab1").addClass("active");
        document.body.classList.remove("keno-mobile-layout");
        document.getElementById("kenoChatOverlay")?.classList.remove("open");
        _is_desktop_left_right_set = 1;
        $(".header_left").append($(".header_credit"));
        $(".game_id_contener").append($(".game_id"));
        updateKenoSidebarBrand();
    } else if ((device.mobile() || _is_mobile) && window.innerWidth <= 710 && _is_desktop_left_right_set == 1) {
        $(".bet_ui").append($(".bet_input"));
        $("#global_conteiner").append($(".bottom_wrap"));
        $(".right_side_tabs_top").prepend($("#tab5"));
        $(".right_side_tabs_top").prepend($("#tab4"));
        $(".right_side_tabs_top").prepend($("#tab3"));
        $(".right_side_tabs_top").prepend($("#tab2"));
        $(".right_side_tabs_top").prepend($("#tab1"));
        $(".right_side_tabs_cont").prepend($(".cont_tab5"));
        $(".right_side_tabs_cont").prepend($(".cont_tab4"));
        $(".right_side_tabs_cont").prepend($(".cont_tab3"));
        $(".right_side_tabs_cont").prepend($(".cont_tab2"));
        $(".right_side_tabs_cont").prepend($(".cont_tab1"));
        $("body").append($("#kenoChatOverlay"));
        $(".tab_itm").removeClass("active");
        $(".tab_cont").removeClass("active");
        $("#tab1").addClass("active");
        $(".cont_tab1").addClass("active");
        document.body.classList.add("keno-mobile-layout");
        document.getElementById("kenoChatOverlay")?.classList.remove("open");
        // Desktop path sets zoom on #global_conteiner — clear it for real mobile layout
        var globalEl = document.getElementById("global_conteiner");
        if (globalEl) globalEl.style.zoom = "1";
        _is_desktop_left_right_set = 2;
        $(".header_center_left").append($(".header_credit"));
        $(".header_center_right").append($(".game_id"));
        updateKenoSidebarBrand();
    } else {
        updateKenoSidebarBrand();
    }
    
    if (device.mobile() || _is_mobile) {
        var globalMobile = document.getElementById("global_conteiner");
        if (globalMobile) globalMobile.style.zoom = "1";
        if (window.innerWidth <= 710) {
            _tickets_carousel = _tickets_carousel || $("#tickets_carousel").owlCarousel({
                loop: false,
                margin: 20,
                nav: false,
                dots: false,
                items: 1,
                center: true
            });
        }
    } else {
        t = Math.min(window.innerWidth / 1280, window.innerHeight / 840);
        if (t > 1) {
            t = 1;
        }
        document.getElementById("global_conteiner").style.zoom = t;
        if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
            e = $(window).width() / 1280;
            t = $(window).height() / 840;
            if (t < e) {
                e = t;
            }
            $("html ,body").css({
                "font-size": 10 * e + "px",
                "line-height": 10 * e + "px"
            });
        }
    }
}

function addCssToDocument() {
    var style = document.createElement("style");
    style.innerText = "@media only screen and (max-width:810px){#global_conteiner{position:fixed;top:0;left:0;width:100%;height:100%;overflow-y: scroll;}.content_right_side,.content_super_wrapper,.left_side_tabs_cont{background-image:none}.ben_his_itm,.ben_his_itm_txt,.game_table .ben_his_itm{min-width:unset;min-height:unset}.canvas_wrap .side_cont_path{border-radius:20px;height:auto}.bet_input{padding:0 0 10px}.canvas_wrap_inn{padding-top:36px}scrollbar{width:3px}scrollbar-track{background-color:#fff;border:0}scrollbar-thumb,scrollbar-thumb:hover{background-color:#3ca266;border-radius:3px}::-webkit-scrollbar{width:3px;display:none}::-webkit-scrollbar-track{background-color:#fff;border:0;display:none}::-webkit-scrollbar-track-piece{background-color:transparent}::-webkit-scrollbar-thumb{background-color:transparent}::-webkit-scrollbar-thumb:hover{background-color:transparent}body,html{font-size:12px;line-height:12px}.main{padding:28% 18px 0;text-align:center}.home_logo{max-width:320px;width:70%}.bet_board,.bet_board_itm_left,.bet_board_itm_qross,.bet_board_itm_top,.desktop_background,.for_desktop_only,.header_logo,.menu_icon,.stopbet .bet_board_cont,.stopbet .bet_ui{display:none}.for_mobile_only,.game_footer,.header{display:block}.canvas_wrap,.content_right_side,.content_super_wrapper{display:block;z-index:2;position:relative;width:100%!important;top:0;left:0;height:auto!important;max-height:unset;max-width:unset;-webkit-transform:translate(0,0);-ms-transform:translate(0,0);-o-transform:translate(0,0);transform:translate(0,0)}.content_right_side{padding:0;margin:0}.content_right_side .side_cont_path{position:relative;border-radius:0;height:auto;padding-top:10px;margin:0}.ben_his_itm{display:inline-block;height:24px;margin:0 2px 2px 0}.bet_input_bar{font-size:2rem;line-height:2rem}.bet_input_btn_m img{width:40px}.bet_input_btn{flex-basis:calc(20% - 0.375em)}.fairness_icon2 img,.home_icon img,.settings_icon img{height:22px;width:auto}.game_id,.header_credit{font-size:1rem;line-height:1.3rem}.game_id{width:auto}.bet_board_itm{padding:4.5% 0;font-size:1.6rem}.ben_his_itm_color_green,.ben_his_itm_color_yellow,.ben_his_itm_num_green,.ben_his_itm_num_yellow,.ben_his_itm_num_yelow{width:25px;font-size:14px;line-height:23px;min-width:unset;min-height:unset;padding-bottom:0}.game_table .ben_his_itm{padding-bottom:0}.ben_his_itm_txt{font-size:8px;line-height:23px;padding:0 7px}.bottom_wrap{padding:60px 0 40px}.table_cont{overflow-y:unset!important;height:auto!important}.table_cont::-webkit-scrollbar{width:.25em;height:.25em;background-color:transparent;display:none}.table_cont::-webkit-scrollbar-thumb{width:.25em;height:.25em;background-color:transparent;display:none}.table_cont::-webkit-scrollbar-track{width:.25em;height:.25em;background-color:transparent;display:none}.table_cont::-webkit-scrollbar-track-piece{width:.25em;height:.25em;background-color:transparent;display:none}.mobile_menu_cont{top:0;height:100%}.mobile_menu_top_bar{margin-top:0}.mobile_menu_top_bar_sound{top:6px;right:50px;width:30px;height:26px}.mobile_menu_contents{top:111px;height:calc(100% - 115px)}.fairness_popup_close{top:8px}.menu_close,.menu_open{height:22px;width:22px}.mobile_menu_tab_itm{padding:10px}.mobile_menu_tab_itm span,.table_row_ttl{font-size:1.3rem;line-height:1.3rem}.mobile_menu_cont_itm li,.mobile_menu_cont_itm p{font-size:1.16rem;line-height:1.58rem}.mobile_menu_close{position:absolute;top:6px;right:10px}.fairness_icn{padding-left:7%}.tic_b,.ticket_sel_tbl_itm{font-size:1.2rem}.fairness_popup_cont_bttl,.tic_curr_n,.tic_s_win,.ticket_curr_number,.ticket_match_tbl_itm,.ticket_sel_cont_posible_win,.ticket_sel_cont_ttl_txt{font-size:1.4rem;line-height:1.4rem}.ticket_match_tbl_itm,.ticket_match_tbl_itm:first-child{font-size:1.1rem;line-height:1.1rem}.ticket_match_tbl1,.ticket_match_tbl2{width:94%}.ticket_help{font-size:1.6rem;padding:1.1rem 0;width:2.1rem}.ticket_helptext1{font-size:2rem;line-height:3rem}#waiting_text_cont,.ticket_helptext2{font-size:1.6rem;line-height:2rem}.anim_ball_cont{width:20%;padding:10% 0}.balls_counter{top:35px;right:9px;font-size:1.2rem;line-height:17px;width:60px}.balls_counter span{width:20px}.canvas_wrap{padding:0 6px}.anim_ball span{font-size:3.6rem}.statistic_num .ben_his_itm{padding:40% 0;width:80%;font-size:1.2rem}.statistics_table .table_row_itm:last-child{padding-right:10px}.game_history .table_row_itm{font-size:1.1rem;line-height:1.4rem}.bet_input{margin-bottom:10px}.game_table .table_row{margin-bottom:6px}.fairness_popup_cont_ttl,.table_row_halff{font-size:1.2rem;line-height:1.2rem}.fairness_popup_cont_hash{padding:9px}.copy_to_clipboard,.past_to_value{right:5px;top:5px}.game_history .ben_his_itm{width:9.2%}.statistic_line{width:78%}.bet_sele,.bet_selections{margin:20px 0 10px;height:146px}.bet_selections:after{width:25%;height:106%;pointer-events:none}#bet_selections{width:92%;float:right}.paytable table td,.paytable table th{font-size:1rem;line-height:1rem;padding:4px 2px}.bet_sele_first{margin-right:-9%;float:right}.active .bet_sele_first{margin-right:0}#game_animation{padding:5px 0 38%;margin:0 auto;height:auto}#game_animation:before{top:-100%}.game_timer{top:26px;font-size:1.5rem;line-height:22px;padding:3px 11px;pointer-events:none}@-webkit-keyframes ball_move1{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:-5%}}@keyframes ball_move1{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:-5%}}@-webkit-keyframes ball_move2{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:5%}}@keyframes ball_move2{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:5%}}@-webkit-keyframes ball_move3{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:15%}}@keyframes ball_move3{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:15%}}@-webkit-keyframes ball_move4{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:25%}}@keyframes ball_move4{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:25%}}@-webkit-keyframes ball_move5{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:35%}}@keyframes ball_move5{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:35%}}@-webkit-keyframes ball_move6{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:45%}}@keyframes ball_move6{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:45%}}@-webkit-keyframes ball_move7{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:55%}}@keyframes ball_move7{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:55%}}@-webkit-keyframes ball_move8{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:65%}}@keyframes ball_move8{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:65%}}@-webkit-keyframes ball_move9{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:75%}}@keyframes ball_move9{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:75%}}@-webkit-keyframes ball_move10{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:85%}}@keyframes ball_move10{0%{top:0}100%{opacity:1;transform:scale(.4);-webkit-transform:scale(.4);-moz-transform:scale(.4);top:36%;left:85%}}.header_logo{width:90px;top:5px}.game_result_popup_top_ttl{font-size:1.33rem;line-height:26px}.game_result_popup_top{height:38px;padding:6px 10%;top:-19px}.game_result_popup_bottom_lost,.game_result_popup_win_amount{font-size:3rem;line-height:3rem}.rro{padding:25px 0 0}.warning_alert_popup_cont{width:80%}.settings_icon{margin-left:15px}#fairness2{font-size:2rem}.loader_spin{width:20%}.bet_board_itm_number{font-size:1.83rem;line-height:2.25rem}.bet_board_itm_text,.tab_history_itm_top_ttl_dat_wrap span,.table_header_itm{font-size:1rem;line-height:1rem}.game_status_wait,.game_status_win,.tab_history_itm_top_ttl_dat_wrap,.table_row_itm{font-size:1.16rem;line-height:1.16rem}.bet_board{padding-bottom:15px}.bet_input_row{display:block;width:100%}.bet_input_row:first-child,.bet_input_row:last-child{padding:0;width:100%}.bet_set_btn{margin-top:5px;height:60px}.bet_input_btn_m{padding:4px}.bet_input_btn span{font-size:1.33rem;line-height:1.33rem}.tabs{overflow-x:scroll;white-space:nowrap}.tab_history_itm_top_ttl_dat,.tab_history_itm_top_ttl_line{flex:1 1 70%}.tab_history_itm_top_ttl_dat_wrap{padding-right:25px;background-size:17px}.fairness_popup_content{width:100%;height:auto;position:absolute;margin:0}.fairness_popup_top{position:fixed}.game_result_popup{top:46px}.game_result_popup_win_ttl{font-size:1.8rem;line-height:1.8rem}.game_result_popup_lost,.game_result_popup_win_amount{font-size:2.4rem;line-height:2.4rem}.bet_play_demo,.bet_play_real{width:90%}.bet_play_demo span,.bet_play_real span{font-size:2rem;line-height:4.5rem}.first_screen_wrap{top:46%}.first_screen_pop_up_cont{padding:40px 20px;top:40%}.fairness_popup_cont_cal,.fairness_popup_cont_car{width:100%;padding-right:0;padding-left:0}}@media only screen and (max-width:420px){.bet_sele,.bet_selections{height:120px}}";
    document.head.appendChild(style);
}

// ============================================
// PARTITION 5: Utility Functions
// ============================================

function formatMoney(t) {
    var decimals = t.toString().indexOf(".") > -1 ? 2 : 0;
    var sign = t < 0 ? "-" : "";
    let numStr = (decimals == 2 ? parseInt(t = Math.abs(Number(t) || 0).toFixed(decimals)) : parseInt(t = Math.abs(Number(t) || 0))).toString();
    var remainder = numStr.length > 3 ? numStr.length % 3 : 0;
    return sign + (remainder ? numStr.substr(0, remainder) + " " : "") +
           numStr.substr(remainder).replace(/(\d{3})(?=\d)/g, "$1 ") +
           (decimals == 2 ? "." + Math.abs(t - numStr).toFixed(decimals).slice(2) : "");
}
window.formatMoney = formatMoney;

function addOtherTicketsItemToGameTable(t) {
    if (_my_tickets_ids.indexOf(t.t.toString()) == -1) {
        $(".game_table").append(
            '<div class="table_row other_tcket_itm" id="b' + t.t + '" data-numbers="' + t.n.join(",") + '" data-bet="' + t.b + '">' +
                '<div class="table_row_ttl">' + t.p + '</div>' +
                '<div class="table_row_bet_nums">' + GenerateBetNums(t.n, false) + '</div>' +
                '<div class="table_row_bet_status">' +
                    '<div class="table_row_halff">' + _all_translation[_language].bet + " " + formatMoney(t.b) + '</div>' +
                    '<div class="table_row_halff game_status_wait">' + _all_translation[_language].waiting + '</div>' +
                    '<div class="table_row_halff game_status_win"></div>' +
                '</div>' +
            '</div>'
        );
    }
}

function addMyTicketsItemToGameTable(t, e) {
    $(".game_table").prepend(
        '<div class="table_row my_tk" id="b' + t.t + '" data-numbers="' + t.n.join(",") + '" data-bet="' + t.b + '" data-round="' + _game_id + '">' +
            '<div class="table_row_ttl">' + e + " " + _all_translation[_language].me + '</div>' +
            '<div class="table_row_bet_nums">' + GenerateBetNums(t.n, true) + '</div>' +
            '<div class="table_row_bet_status">' +
                '<div class="table_row_halff">' + _all_translation[_language].bet + " " + formatMoney(t.b) + '</div>' +
                '<div class="table_row_halff game_status_wait">' + _all_translation[_language].waiting + '</div>' +
                '<div class="table_row_halff game_status_win"></div>' +
            '</div>' +
        '</div>'
    );
}

function addItemToHistoryTable(t) {
    var dateStr = t.date || "";
    if (dateStr != "" && dateStr != "-") {
        dateStr = moment(new Date(parseInt(dateStr))).local().format("HH:mm:ss");
    }
    $(".game_history").prepend(
        '<div class="table_row" id="t' + t.game_id + '">' +
            '<div class="table_row_itm fairness_icn" data-id="' + t.game_id + '" data-salt="' + (t.salt || "") + '" data-key="' + (t.key || "") + '" data-hash="' + (t.hash || "") + '">' +
                t.game_id + "<br>" + dateStr +
            '</div>' +
            '<div class="table_row_itm game_result_icon">' + GetResulticon(t.numbers) + '</div>' +
        '</div>'
    );
}

function GetResulticon(t) {
    var result = t.length > 0 ? "" : '<span class="ben_his_itm" style="width: 100%;">' + _all_translation[_language].wait + "</span>";
    t.map(function(num) {
        result += '<span class="ben_his_itm">' + num + "</span>";
    });
    return result;
}

function GenerateBetNums(t, e) {
    var html = "";
    for (var s = 0; s < 10; s++) {
        if (s < t.length) {
            html += '<div class="bet_nms bet_nms' + t[s] + '">' + t[s] + "</div>";
            if (_uniqu_selected_numbers.indexOf(t[s]) < 0 && e) {
                _uniqu_selected_numbers.push(t[s]);
            }
        } else {
            html += '<div class="bet_nms inactive"></div>';
        }
    }
    return html;
}

// ============================================
// PARTITION 6: Game Logic Functions
// ============================================

function NewGame(t) {
    if (_game_progress_interval) {
        clearInterval(_game_progress_interval);
    }
    if (_animation_interval) {
        clearInterval(_animation_interval);
        _animation_interval = null;
    }
    if (_credit < _min_bet && _demo_game) {
        document.getElementById("first_screen_pop_up").style.display = "block";
    }
    _game_status = 1;
    _game_id = t.game_id;
    applyBetLimitsFromPayload(t);
    
    $(".game_timer").removeClass("leyt").show();
    $(".game_timer_sec").text("00");
    
    if (_history.length > 0) {
        $("#t" + _history[_history.length - 1].game_id + " .game_result_icon").html(GetResulticon(_history[_history.length - 1].numbers));
        $("#t" + _history[_history.length - 1].game_id + " .fairness_icn").attr("data-key", _history[_history.length - 1].key || "");
        $("#t" + _history[_history.length - 1].game_id + " .fairness_icn").attr("data-salt", _history[_history.length - 1].salt || "");
        if (_history[_history.length - 1].date != "") {
            $("#t" + _history[_history.length - 1].game_id + " .fairness_icn").html(
                _history[_history.length - 1].game_id + "<br>" + 
                moment(new Date(parseInt(_history[_history.length - 1].date))).local().format("HH:mm:ss")
            );
        }
        if (_history[_history.length - 1].game_id != t.game_id) {
            _history.push({
                date: "",
                numbers: [],
                game_id: t.game_id,
                hash: t.hash || "",
                key: "-",
                salt: "-"
            });
            addItemToHistoryTable({
                game_id: t.game_id,
                numbers: [],
                date: "",
                hash: t.hash || "",
                key: "-",
                salt: "-"
            });
        }
    }
    
    $(".game_id").attr("data-hash", t.hash || "");
    $(".game_id").attr("data-id", t.game_id);
    $(".game_id_num").text(t.game_id);
    $(".global_wrapper").removeClass("stopbet");
    $(".game_table").empty();
    $(".bet_board_itm").removeClass("show");
    
    if ($(".game_history .table_row").length > 20) {
        $($(".game_history .table_row")[$(".game_history .table_row").length - 1]).remove();
    }
    
    $(".game_result_popup").removeClass("lost").removeClass("win");
    $(".game_table").removeClass("show");
    
    if (_tickets_carousel && _my_tickets.length > 0) {
        $(".bet_sele").each(function() {
            $(this).parent().remove();
        });
        _tickets_carousel.trigger("destroy.owl.carousel");
        _tickets_carousel = $("#tickets_carousel").owlCarousel({
            loop: false,
            margin: 10,
            nav: false,
            dots: false,
            items: 1,
            center: true
        });
    }
    
    _my_tickets = [];
    _my_tickets_ids = [];
    _uniqu_selected_numbers = [];
    
    if (t.statistics) {
        _statistics = t.statistics;
    }
    UpdateStatistics();
    
    $(".total_tickets_count").text("0");
    $(".my_tickets_count").text("0");
    $(".my_bets_count").text("0");
    
    if (t.leaders) {
        LeaderTableUpdate(t.leaders);
    }
    
    if (_my_tickets_nosent.length > 0) {
        $(".my_tk_load").remove();
        var queuedNewGame = _my_tickets_nosent[0];
        var queuedNewGamePayload = {
            status: "betset",
            bet: queuedNewGame.bet,
            numbers: queuedNewGame.numbers
        };
        if (queuedNewGame.freeBetId) {
            queuedNewGamePayload.freeBetId = queuedNewGame.freeBetId;
        }
        Socket_SendEvent(queuedNewGamePayload);
    } else if (_my_selected_numbers.length == 0) {
        $(".bet_set_btn").removeClass("wait");
        $(".ticket_sel_tbl_itm").removeClass("selected").text("");
    }
}





function UpdateTimer(t) {
    _game_status = 1;
    var time = parseInt(t.time, 10);
    if (!Number.isFinite(time) || time < 0) {
        time = 0;
    }
    var timeStr = time.toString();
    if (time < 10) {
        timeStr = "0" + timeStr;
    }
    $(".game_timer").removeClass("leyt").show();
    $(".game_timer_sec").text(timeStr);
    $(".global_wrapper").removeClass("stopbet");
    
    if (t.total_count) {
        $(".total_tickets_count").text(t.total_count);
    }
    $(".bet_board_itm").removeClass("show");
    
    if (t.tickets) {
        $(".other_tcket_itm").remove();
        t.tickets.map(function(ticket) {
            addOtherTicketsItemToGameTable(ticket);
        });
    }
}

function paintHeaderCredit() {
    $(".header_credit").html(formatMoney(_credit) + " " + _currency);
    if (!_demo_game) {
        parent.postMessage("credit|" + _credit, "*");
    }
}

function stashCreditDuringDraw(credit) {
    if (credit == null || !Number.isFinite(Number(credit))) return false;
    if (!_draw_reveal_pending) return false;
    _pending_credit = Number(credit);
    return true;
}

function applyStashedDrawCredit(optimisticWin) {
    if (_pending_credit != null && Number.isFinite(Number(_pending_credit))) {
        _credit = Number(_pending_credit);
    } else if (optimisticWin > 0) {
        _credit += optimisticWin;
    }
    _pending_credit = null;
    paintHeaderCredit();
}

function GamePlay(e) {
    console.log('GamePlay', e);
    if (!$(".global_wrapper").hasClass("stopbet")) {
        $(".global_wrapper").addClass("stopbet");
    }
    // Betting countdown must not stay visible during draw.
    if (_game_progress_interval) {
        clearInterval(_game_progress_interval);
        _game_progress_interval = null;
    }
    _game_progress_time = 0;
    $(".game_timer").removeClass("leyt").hide();
    $(".game_timer_sec").text("00");

    _numbers = e.numbers;
    
    if (!e.skip_stats) {
        for (var t = 0; t < 20; t++) {
            _statistics[_numbers[t] - 1]++;
        }
    }
    
    if (_history.length > 0) {
        _history[_history.length - 1].date = e.date;
        _history[_history.length - 1].numbers = _numbers;
        _history[_history.length - 1].salt = e.salt || "";
        _history[_history.length - 1].key = e.key || "";
    }
    
    _game_status = 2;
    _draw_reveal_pending = true;
    $(".bet_board_itm").removeClass("selected");
    $(".bet_set_btn").removeClass("active");
    $("#bet_selections").removeClass("selected");
    _my_selected_numbers = [];
    
    if (e.total_count) {
        $(".total_tickets_count").text(e.total_count);
    }
    
    $(".balls_counter_num").text("00");
    $("#game_animation").empty();
    $("#game_animation").append('<div class="game_animation_row1"></div><div class="game_animation_row2"></div>');
    
    for (var a = 0; a < 20; a++) {
        var row = a < 10 ? $(".game_animation_row1") : $(".game_animation_row2");
        var activeClass = _uniqu_selected_numbers.indexOf(_numbers[a]) >= 0 ? "active" : "";
        row.append(
            '<div class="anim_ball_cont anim_ball_cont' + (a + 1) + '">' +
                '<div class="anim_ball anim_ball' + (a + 1) + " " + activeClass + '">' +
                    '<i></i><span>' + _numbers[a] + '</span>' +
                '</div>' +
            '</div>'
        );
    }
    
    // Clear any existing animation interval
    if (_animation_interval) {
        clearInterval(_animation_interval);
    }

    var elapsed = parseInt(e.elapsed, 10);
    if (!Number.isFinite(elapsed) || elapsed < 0) {
        elapsed = 0;
    }
    // One ball per second; cap at full draw.
    elapsed = Math.min(20, elapsed);

    function revealBall(index1Based) {
        if (index1Based < 1 || index1Based > 20) return;
        if (!$(".anim_ball" + index1Based).hasClass("show")) {
            $(".anim_ball" + index1Based).addClass("show");
        }
        if (index1Based > 1 && !$(".anim_ball_cont" + (index1Based - 1)).hasClass("move")) {
            $(".anim_ball_cont" + (index1Based - 1)).addClass("move");
        }
        $("#ka" + _numbers[index1Based - 1]).addClass("show");
        $(".bet_nms" + _numbers[index1Based - 1]).addClass("show");
        if (index1Based >= 11) {
            if (!$(".game_animation_row1").hasClass("down")) {
                $(".game_animation_row1").addClass("down");
            }
        }
        var counterText = index1Based > 9 ? String(index1Based) : "0" + index1Based;
        if (index1Based === 0) {
            counterText = "00";
        }
        $(".balls_counter_num").text(index1Based > 9 ? String(index1Based) : (index1Based < 1 ? "00" : "0" + index1Based));
    }

    // Fast-forward balls already drawn before this join/reload.
    for (var skipped = 1; skipped <= elapsed; skipped++) {
        revealBall(skipped);
        checkmytickets(e.game_id);
    }
    if (elapsed > 0) {
        $(".balls_counter_num").text(elapsed > 9 ? String(elapsed) : "0" + elapsed);
    } else {
        $(".balls_counter_num").text("00");
    }

    _current_animated_index = elapsed + 1;
    if (_current_animated_index === 1) {
        if (!$(".anim_ball" + _current_animated_index).hasClass("show")) {
            $(".anim_ball" + _current_animated_index).addClass("show");
        }
        $("#ka" + _numbers[_current_animated_index - 1]).addClass("show");
        $(".bet_nms" + _numbers[_current_animated_index - 1]).addClass("show");
        _current_animated_index = 2;
        $(".balls_counter_num").text("01");
    }

    if (_current_animated_index <= 20) {
        _animation_interval = setInterval(function() {
            if (_current_animated_index <= 20) {
                checkmytickets(e.game_id);
                if (!$(".anim_ball" + _current_animated_index).hasClass("show")) {
                    $(".anim_ball" + _current_animated_index).addClass("show");
                }
                if (!$(".anim_ball_cont" + (_current_animated_index - 1)).hasClass("move")) {
                    $(".anim_ball_cont" + (_current_animated_index - 1)).addClass("move");
                }
                var counterText = _current_animated_index - 1 > 9 ? (_current_animated_index - 1) : "0" + (_current_animated_index - 1);
                $(".balls_counter_num").text(counterText);
                
                if (_current_animated_index == 11) {
                    if (!$(".game_animation_row1").hasClass("down")) {
                        $(".game_animation_row1").addClass("down");
                    }
                }
                
                $("#ka" + _numbers[_current_animated_index - 1]).addClass("show");
                $(".bet_nms" + _numbers[_current_animated_index - 1]).addClass("show");
                _current_animated_index++;
            } else {
                if (!$(".anim_ball_cont" + (_current_animated_index - 1)).hasClass("move")) {
                    $(".anim_ball_cont" + (_current_animated_index - 1)).addClass("move");
                }
                $(".balls_counter_num").text(_current_animated_index - 1);
                clearInterval(_animation_interval);
                _animation_interval = null;
            }
        }, 1000);
    } else {
        if (!$(".anim_ball_cont20").hasClass("move")) {
            $(".anim_ball_cont20").addClass("move");
        }
        $(".balls_counter_num").text("20");
        checkmytickets(e.game_id);
    }

    var revealDelay = Math.max(0, DRAW_REVEAL_MS - elapsed * 1000);
    setTimeout(function() {
        if (!$(".game_table").hasClass("show")) {
            $(".game_table").addClass("show");
        }
    }, revealDelay);

    var totalWin = 0;
    var winningRowMarks = [];
    $(".game_table .table_row").each(function() {
        var numsAttr = $(this).attr("data-numbers");
        if (!numsAttr) return;
        var winMultiplier = CheckTicketWin(numsAttr.split(","), _numbers);
        if (winMultiplier <= 0) return;
        var winAmount = parseFloat($(this).attr("data-bet")) * winMultiplier;
        if ($(this).hasClass("my_tk")) {
            if ($(this).attr("data-round").toString() == e.game_id.toString()) {
                if (winAmount > _max_win) {
                    winAmount = _max_win;
                }
                totalWin += winAmount;
                var ticketIndex = _my_tickets_ids.indexOf($(this).attr("id").substr(1));
                if (ticketIndex >= 0) {
                    _my_tickets[ticketIndex].w = winAmount;
                }
            } else {
                $(this).remove();
                return;
            }
        }
        winningRowMarks.push({ row: this, winAmount: winAmount });
    });

    _draw_reveal_pending = true;
    if (_draw_reveal_timer) {
        clearTimeout(_draw_reveal_timer);
        _draw_reveal_timer = null;
    }

    if (_my_tickets.length > 0) {
        _bufer_history = {
            tickets: _my_tickets,
            game_id: e.game_id,
            date: e.date,
            numbers: _numbers,
            key: e.key || "",
            salt: e.salt || "",
            hash: e.hash || ""
        };
    }

    _draw_reveal_timer = setTimeout(function() {
        _draw_reveal_timer = null;
        _draw_reveal_pending = false;
        for (var i = 0; i < winningRowMarks.length; i++) {
            var mark = winningRowMarks[i];
            $(mark.row).addClass("win");
            $(mark.row).find(".game_status_win").html(formatMoney(mark.winAmount));
        }
        if (_my_tickets.length > 0) {
            if (totalWin > 0) {
                $(".game_result_popup_win_amount").text(formatMoney(totalWin));
                if (!$(".game_result_popup").hasClass("win")) {
                    $(".game_result_popup").addClass("win");
                }
            } else if (!$(".game_result_popup").hasClass("lost")) {
                $(".game_result_popup").addClass("lost");
            }
            AddToMyHistory(_bufer_history);
        }
        applyStashedDrawCredit(totalWin);
    }, revealDelay);
}

// ============================================
// PARTITION 7: Betting Functions
// ============================================

function MyBetSet(t) {
    applyFreeBetsFromPayload(t);

    if (t.credit != null) {
        _credit = t.credit;
    }
    $(".header_credit").html(formatMoney(_credit) + " " + _currency);
    if (!_demo_game) {
        parent.postMessage("credit|" + _credit, "*");
    }
    
    _my_tickets.push(t.ticket);
    _my_tickets_ids.push(t.ticket.t.toString());
    addMyTicketsItemToGameTable(t.ticket, _my_tickets.length);
    
    var totalBet = 0;
    _my_tickets.map(function(ticket) {
        totalBet += parseFloat(ticket.b);
    });
    
    $(".total_tickets_count").text(t.total_count);
    $(".my_tickets_count").text(_my_tickets.length);
    $(".my_bets_count").text(NumberFormatterR(totalBet));
    
    if (_tickets_carousel) {
        _tickets_carousel.trigger("add.owl.carousel", [CreateNewTicketDiv(t.ticket), _my_tickets.length - 1]).trigger("refresh.owl.carousel");
        setTimeout(function() {
            _tickets_carousel.trigger("to.owl.carousel", _my_tickets.length);
            $("#bet_selections").removeClass("selected");
        }, 10);
    } else if (_my_selected_numbers.length == 0) {
        $("#bet_selections").removeClass("selected");
    }
    
    if (_my_tickets_nosent.length > 0) {
        _my_tickets_nosent.splice(0, 1);
    }
    
    if (_my_tickets_nosent.length > 0) {
        var queuedAfterBet = _my_tickets_nosent[0];
        var queuedAfterBetPayload = {
            status: "betset",
            bet: queuedAfterBet.bet,
            numbers: queuedAfterBet.numbers
        };
        if (queuedAfterBet.freeBetId) {
            queuedAfterBetPayload.freeBetId = queuedAfterBet.freeBetId;
        }
        Socket_SendEvent(queuedAfterBetPayload);
    } else if (_my_selected_numbers.length == 0) {
        $(".bet_set_btn").removeClass("wait");
        if (!$(".bet_set_btn").hasClass("accept")) {
            $(".bet_set_btn").addClass("accept");
        }
        setTimeout(function() {
            $(".bet_set_btn").removeClass("accept");
        }, 500);
    }
}

function OtherBetSet(e) {
    if (e.user && e.user != _user_id) {
        e.tickets.map(function(t) {
            addOtherTicketsItemToGameTable({
                t: t.t,
                n: t.n,
                p: e.user,
                bet: t.b
            });
        });
        $(".total_tickets_count").text(e.total_count);
    }
}

function AddToMyHistory(t) {
    _mybethistoryids.push(t.game_id.toString());
    var dateStr = t.date;
    if (dateStr != "" && dateStr != "-") {
        dateStr = moment(new Date(parseInt(dateStr))).local().format("DD/MM/YY HH:mm:ss").replace(" ", "&nbsp;");
    }
    
    var historyHtml = '<div class="tab_history_itm">' +
        '<div class="tab_history_itm_top">' +
            '<div class="tab_history_itm_top_ttl">' +
                '<div class="tab_history_itm_top_ttl_line"></div>' +
                '<div class="tab_history_itm_top_ttl_dat" data-hash="' + (t.hash || "") + '" data-key="' + (t.key || "") + '" data-salt="' + (t.salt || "") + '">' +
                    '<div data-id="' + t.game_id + '" class="tab_history_itm_top_ttl_dat_wrap">' +
                        _all_translation[_language].draw_id + ":&nbsp;" + t.game_id + '<span>' + dateStr + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tab_history_itm_top_ttl_line"></div>' +
            '</div>' +
        '</div>' +
        '<div class="table_cont">' + addHistoryRows(t.tickets, t.numbers) + '</div>' +
    '</div>';
    
    if (t.after) {
        $(".game_mybet_history").append(historyHtml);
    } else {
        $(".game_mybet_history").prepend(historyHtml);
    }
}

function addHistoryRows(t, e) {
    var html = "";
    t.map(function(ticket) {
        html += '<div class="table_row ' + (ticket.w ? "winrow" : "") + '">' +
            '<div class="table_row_bet_nums">' + HistoryBetNums(ticket.n, e) + '</div>' +
            '<div class="table_row_bet_status">' +
                '<div class="table_row_halff">' + _all_translation[_language].bet + " " + formatMoney(ticket.b) + '</div>';
        if (ticket.w) {
            html += '<div class="table_row_halff game_status_win">' + formatMoney(ticket.w) + '</div>';
        }
        html += '</div></div>';
    });
    return html;
}

function HistoryBetNums(t, e) {
    var html = "";
    for (var s = 0; s < 10; s++) {
        if (s < t.length) {
            var matchClass = e.indexOf(t[s]) >= 0 ? "sell" : "";
            html += '<div class="bet_nms ' + matchClass + '">' + t[s] + '</div>';
        } else {
            html += '<div class="bet_nms inactive"></div>';
        }
    }
    return html;
}

function scaledKayf(mult) {
    var m = Number(mult) || 0;
    if (m <= 0) return 0;
    return Math.round(m * _payout_scale * 10000) / 10000;
}

function formatKayf(mult) {
    var s = scaledKayf(mult);
    if (s === Math.floor(s)) return String(s);
    return String(Math.round(s * 100) / 100);
}

function maxScaledKayf(spotCount) {
    var row = _all_kayfs[spotCount - 1];
    if (!row || !row.length) return 0;
    return scaledKayf(row[row.length - 1]);
}

function CheckTicketWin(t, e) {
    var matches = 0;
    t.map(function(num) {
        if (e.indexOf(parseInt(num)) >= 0) {
            matches++;
        }
    });
    return scaledKayf(_all_kayfs[t.length - 1][matches]);
}

function LeaderTableUpdate(t) {
    $(".game_leaders").empty();
    t.map(function(leader, index) {
        $(".game_leaders").append(
            '<div class="table_row">' +
                '<div class="table_row_itm">' + (index + 1) + '</div>' +
                '<div class="table_row_itm">' + leader.p + '</div>' +
                '<div class="table_row_itm">' + formatMoney(leader.b) + '</div>' +
                '<div class="table_row_itm">' + formatMoney(leader.w) + " " + (leader.c || "") + '</div>' +
            '</div>'
        );
    });
}

function ShowWarning(t, e) {
    $(".warning_alert_popup").show();
    $(".warning_alert_popup_info").html(t);
    if (e) {
        $(".close_btn").show();
    } else {
        $(".close_btn").hide();
    }
}

// ============================================
// PARTITION 8: Validation and Utility Functions
// ============================================

function CheckBetInputBox() {
    var betValue = $("#bet_input_bar").val().trim();
    betValue = isNaN(betValue) ? _min_bet : parseFloat(NumberFormatterR(betValue));
    var usingFree = _selected_free_bet_id != null && _free_bets.length > 0;

    if (betValue < _min_bet || betValue > _max_bet || 
        $("#bet_input_bar").val().trim() == "" || 
        $("#bet_input_bar").val().trim() == "NaN" ||
        (_credit < _min_bet && !usingFree) ||
        (_credit < _bet && !usingFree)) {
        _bet = _min_bet;
        $("#bet_input_bar").val(_min_bet);
        syncBetStepperState();
        return false;
    }
    syncBetStepperState();
    return true;
}

function PostRec(url, data, callback) {
    $.ajax({
        type: "POST",
        url: url,
        data: data
    }).done(function(response) {
        callback(null, response);
    }).fail(function(error) {
        callback(error);
    });
}

function clampBetToLimits(amount) {
    var n = Number(amount);
    if (!Number.isFinite(n)) n = Number(_default_bet);
    var minBet = Number(_min_bet);
    var maxBet = Number(_max_bet);
    if (!Number.isFinite(n)) n = Number.isFinite(minBet) ? minBet : 5;
    if (Number.isFinite(minBet) && n < minBet) n = minBet;
    if (Number.isFinite(maxBet) && n > maxBet) n = maxBet;
    return n;
}

function applyBetLimitsFromPayload(t) {
    if (!t) return;
    var limits = t.bet_limits || null;
    var minBet = limits && limits.min_bet != null ? limits.min_bet : t.min_bet;
    var maxBet = limits && limits.max_bet != null ? limits.max_bet : t.max_bet;
    var maxWin = limits && limits.max_win != null ? limits.max_win : t.max_win;
    if (minBet != null && Number.isFinite(Number(minBet))) {
        _min_bet = Number(minBet);
    }
    if (maxBet != null && Number.isFinite(Number(maxBet))) {
        _max_bet = Number(maxBet);
    }
    if (maxWin != null && Number.isFinite(Number(maxWin))) {
        _max_win = Number(maxWin);
    }
    // Always show the raw kayf table (x10 pays 10x). RTP is held by draws, not cell scale.
    _payout_scale = 1;
    if (!Number.isFinite(Number(_bet))) {
        _bet = clampBetToLimits(_default_bet);
    } else {
        _bet = clampBetToLimits(_bet);
    }
    CheckBetMinMax({ silent: true });
    $("#bet_input_bar").val(_bet);
}

function syncBetStepperState() {
    var atMin = Number(_bet) <= Number(_min_bet);
    var atMax = Number(_bet) >= Number(_max_bet);
    $(".bet_input_btn_m[data-val='-1']").toggleClass("is-disabled", atMin);
    $(".bet_input_btn_m[data-val='1']").toggleClass("is-disabled", atMax);
}

function CheckBetMinMax(opts) {
    var silent = opts && opts.silent;
    if (_bet < _min_bet) {
        _bet = _min_bet;
        if (!silent) ShowWarning(_all_translation[_language].wrong_bet2, true);
    } else if (_bet > _max_bet) {
        _bet = _max_bet;
    }

    if (_selected_free_bet_id == null && _credit < _bet) {
        if (!silent) {
            ShowWarning(_all_translation[_language].wrong_bet1, true);
            _bet = _min_bet;
        }
    }

    if (_bet < _min_bet) {
        _bet = _min_bet;
    }
    syncBetStepperState();
}

function NumberFormatterR(t) {
    t = parseFloat(t).toFixed(2);
    if (t.substr(t.length - 1) == "0") {
        t = t.substr(0, t.length - 1);
    }
    if (t.substr(t.length - 2) == ".0") {
        t = t.substr(0, t.length - 2);
    }
    return t;
}

// ============================================
// PARTITION 9: Language and Selection Functions
// ============================================

function SetLanguage() {
    if ($(".mobile_menu_top_bar_lang.active")[0]) {
        _language = $(".mobile_menu_top_bar_lang.active").attr("data-lang");
    }
    
    if (_all_translation[_language]) {
        $("#trs_mm1").text(_all_translation[_language].rules);
        $("#rules_r0").html(_all_translation[_language].rules_r0);
        $("#rules_r1").html(_all_translation[_language].rules_r1);
        $("#rules_r2").text(_all_translation[_language].rules_r2);
        $("#rules_r3").text(_all_translation[_language].rules_r3);
        $("#rules_r4").text(_all_translation[_language].rules_r4);
        $("#rules_r5").text(_all_translation[_language].rules_r5);
        $("#rules_r6").text(_all_translation[_language].rules_r6);
        $("#rules_r7").text(_all_translation[_language].rules_r7);
        $("#rules_r8").text(_all_translation[_language].rules_r8);
        $("#rules_r9").text(_all_translation[_language].rules_r9);
        $("#rules_r10").text(_all_translation[_language].rules_r10);
        $("#rules_r11").text(_all_translation[_language].rules_r11);
        $("#rules_r12").text(_all_translation[_language].rules_r12);
        $("#rules_r13").text(_all_translation[_language].rules_r13);
        $("#tab1").text(_all_translation[_language].game);
        $("#tab2").text(_all_translation[_language].history);
        $("#tab3").text(_all_translation[_language].results);
        $("#tab4").text(_all_translation[_language].statistics);
        $("#tab5").text(_all_translation[_language].leaders);
        $("#trs_bets").text(_all_translation[_language].bets);
        $("#trs_mytiks").text(_all_translation[_language].my_tickets);
        $("#trs_mybets").text(_all_translation[_language].my_bets);
        $("#trs_bet2").text(_all_translation[_language].amount);
        $("#trs_win").text(_all_translation[_language].win);
        $("#trs_win2").text(_all_translation[_language].win);
        $("#trs_results").text(_all_translation[_language].results);
        $("#trs_you_win").text(_all_translation[_language].you_win);
        $("#trs_try").text(_all_translation[_language].try_again);
        $("#trs_golpos").text(_all_translation[_language].goalpost);
        $("#trs_top_row").text(_all_translation[_language].top_row);
        $("#trs_green").text(_all_translation[_language].green);
        $("#trs_miss").text(_all_translation[_language].miss_save);
        $("#trs_middle_row").text(_all_translation[_language].middle_row);
        $("#trs_bottom_row").text(_all_translation[_language].bottom_row);
        $("#trs_yellow").text(_all_translation[_language].yellow);
        $("#trs_place").text(_all_translation[_language].place_bet);
        $("#trs_mm3").text("FREE BET");
        syncBetControlsForFreeBetMode();
        $("#trs_wait").text(_all_translation[_language].wait + "...");
        $("#trs_accepted").text(_all_translation[_language].bet_accepted);
        $("#trs_drawid").html(_all_translation[_language].draw_id);
        $("#trs_combin2").text(_all_translation[_language].combination);
        $("#trs_date").text(_all_translation[_language].date);
        $("#trs_position").text(_all_translation[_language].position);
        $("#trs_user_id").text(_all_translation[_language].user_id);
        $("#trs_bet2").text(_all_translation[_language].bet);
        $("#trs_odd").text(_all_translation[_language].odd);
        $("#trs_win2").text(_all_translation[_language].win);
        $("#trs_bet_amount").text(_all_translation[_language].bet_amount);
        $("#trs_apply").text(_all_translation[_language].apply);
        $("#trs_connection_lose").html(_all_translation[_language].connection_lose);
        $("#feri_r1").html(_all_translation[_language].feri_r1);
        $("#feri_r2").html(_all_translation[_language].feri_r2);
        $("#feri_r3").html(_all_translation[_language].feri_r3);
        $("#feri_r4").html(_all_translation[_language].feri_r4);
        $("#feri_r5").html(_all_translation[_language].feri_r5);
        $("#feri_r6").html(_all_translation[_language].feri_r6);
        $("#feri_r7").html(_all_translation[_language].feri_r7);
        $("#feri_r8").html(_all_translation[_language].feri_r8);
        $("#feri_r9").html(_all_translation[_language].feri_r9);
        $("#trs_mm2").text(_all_translation[_language].fairness);
        $("#fairness2").text(_all_translation[_language].fairness);
        $("#fairness3").text(_all_translation[_language].fairness);
        $("#draw_id3").text(_all_translation[_language].draw_id);
        $("#trs_key").text(_all_translation[_language].key);
        $("#trs_salt").text(_all_translation[_language].salt);
        $("#trs_hash").text(_all_translation[_language].hash);
        $("#trs_hash2").text(_all_translation[_language].hash);
        $("#trs_check_hash").text(_all_translation[_language].check_hash);
        $("#trs_saltp").text(_all_translation[_language].past_salt);
        $("#trs_keyp").text(_all_translation[_language].past_key);
        $("#trs_check").text(_all_translation[_language].check);
        $("#trs_about_hash").text(_all_translation[_language].about_hash);
        $("#trs_stsh").text(_all_translation[_language].statistics1);
        $("#trs_sort").text(_all_translation[_language].sort);
        $("#waiting_text").text(_all_translation[_language].in_progress);
        $("#trs_tktttl").text(_all_translation[_language].posible_win);
        $("#trs_mtch").text(_all_translation[_language].match);
        $("#trs_pays").text(_all_translation[_language].pays);
        $("#trs_tkth1").text(_all_translation[_language].choose1);
        $("#trs_tkth2").text(_all_translation[_language].choose2);
        $("#socket_status").text(_all_translation[_language].slow_internet);
        if ($("#trs_show")[0]) {
            $("#trs_show").text(_all_translation[_language].show_results);
        }
        if ($("#trs_play")[0]) {
            $("#trs_play").text(_all_translation[_language].play);
        }
        if ($("#trs_demo")[0]) {
            $("#trs_demo").text(_all_translation[_language].demo);
        }
    }
}

// ============================================
// PARTITION 10: Selection and Statistics Functions
// ============================================

function SelectNumver(t) {
    console.log('SelectNumver', t);
    var multiplier;
    if (_bet <= _credit) {
        if (_my_selected_numbers.length < 10) {
            if (!$(".bet_set_btn").hasClass("active")) {
                $(".bet_set_btn").addClass("active");
            }
            if (!$("#ka" + t).hasClass("selected")) {
                $("#ka" + t).addClass("selected");
            }
            if (_my_selected_numbers.indexOf(t) == -1) {
                _my_selected_numbers.push(t);
            }
            if (!$("#bet_selections").hasClass("selected")) {
                $("#bet_selections").addClass("selected");
            }
            $(".ticket_sel_tbl_itm" + _my_selected_numbers.length).text(t);
            if (!$(".ticket_sel_tbl_itm" + _my_selected_numbers.length).hasClass("selected")) {
                $(".ticket_sel_tbl_itm" + _my_selected_numbers.length).addClass("selected");
            }
            
            multiplier = 1;
            $(".mtbl").removeClass("selected").removeClass("lasone").text("");
            _all_kayfs[_my_selected_numbers.length - 1].map(function(mult, index) {
                if (mult > 0) {
                    if (!$(".mtbl1_itm" + multiplier).hasClass("selected")) {
                        $(".mtbl1_itm" + multiplier).addClass("selected");
                    }
                    if (!$(".mtbl2_itm" + multiplier).hasClass("selected")) {
                        $(".mtbl2_itm" + multiplier).addClass("selected");
                    }
                    $(".mtbl1_itm" + multiplier).text(index);
                    $(".mtbl2_itm" + multiplier).text("x" + formatKayf(mult));
                    multiplier++;
                }
            });
            if (!$(".mtbl1_itm" + (multiplier - 1)).hasClass("lasone")) {
                $(".mtbl1_itm" + (multiplier - 1)).addClass("lasone");
            }
            if (!$(".mtbl2_itm" + (multiplier - 1)).hasClass("lasone")) {
                $(".mtbl2_itm" + (multiplier - 1)).addClass("lasone");
            }
            
            var possibleWin = _bet * maxScaledKayf(_my_selected_numbers.length);
            if (possibleWin > _max_win) {
                possibleWin = _max_win;
            }
            $(".ticket_sel_cont_posible_win").text(NumberFormatterR(possibleWin));
            $(".ticket_curr_number").text(_game_status == 0 ? _my_tickets_nosent.length + 1 : _my_tickets.length + 1);
        }
    } else if (_credit < _min_bet) {
        ShowWarning(_all_translation[_language].wrong_bet3, true);
    } else {
        ShowWarning(_all_translation[_language].wrong_bet1, true);
    }
}

function DeselectNumver(t) {
    var multiplier;
    if (_my_selected_numbers.indexOf(t) >= 0) {
        var index = _my_selected_numbers.indexOf(t);
        _my_selected_numbers.splice(index, 1);
        $(".ticket_sel_tbl_itm").text("");
        _my_selected_numbers.map(function(num, idx) {
            $(".ticket_sel_tbl_itm" + (idx + 1)).text(num);
        });
        $(".ticket_sel_tbl_itm" + (_my_selected_numbers.length + 1)).removeClass("selected");
        
        if (_my_selected_numbers.length > 0) {
            multiplier = 1;
            $(".mtbl").removeClass("selected").removeClass("lasone").text("");
            _all_kayfs[_my_selected_numbers.length - 1].map(function(mult, idx) {
                if (mult > 0) {
                    if (!$(".mtbl1_itm" + multiplier).hasClass("selected")) {
                        $(".mtbl1_itm" + multiplier).addClass("selected");
                    }
                    if (!$(".mtbl2_itm" + multiplier).hasClass("selected")) {
                        $(".mtbl2_itm" + multiplier).addClass("selected");
                    }
                    $(".mtbl1_itm" + multiplier).text(idx);
                    $(".mtbl2_itm" + multiplier).text("x" + formatKayf(mult));
                    multiplier++;
                }
            });
            if (!$(".mtbl1_itm" + (multiplier - 1)).hasClass("lasone")) {
                $(".mtbl1_itm" + (multiplier - 1)).addClass("lasone");
            }
            if (!$(".mtbl2_itm" + (multiplier - 1)).hasClass("lasone")) {
                $(".mtbl2_itm" + (multiplier - 1)).addClass("lasone");
            }
            
            var possibleWin = _bet * maxScaledKayf(_my_selected_numbers.length);
            if (possibleWin > _max_win) {
                possibleWin = _max_win;
            }
            $(".ticket_sel_cont_posible_win").text(NumberFormatterR(possibleWin));
            $(".ticket_curr_number").text(_game_status == 0 ? _my_tickets_nosent.length + 1 : _my_tickets.length + 1);
        }
    }
    
    if ($("#ka" + t).hasClass("selected")) {
        $("#ka" + t).removeClass("selected");
    }
    
    if (_my_selected_numbers.length <= 0) {
        $(".bet_set_btn").removeClass("active");
        $("#bet_selections").removeClass("selected");
    }
}

function UpdateStatistics() {
    var sorted = [];
    $(".statistics_table").empty();
    _statistics.map(function(val, index) {
        sorted.push({id: index + 1, val: val});
    });
    sorted.sort(function(a, b) {
        return a.val < b.val ? 1 : -1;
    });
    
    $(".bet_board_itm").removeClass("min").removeClass("max");
    if (!$("#ka" + sorted[0].id).hasClass("max")) {
        $("#ka" + sorted[0].id).addClass("max");
    }
    if (!$("#ka" + sorted[1].id).hasClass("max")) {
        $("#ka" + sorted[1].id).addClass("max");
    }
    if (!$("#ka" + sorted[2].id).hasClass("max")) {
        $("#ka" + sorted[2].id).addClass("max");
    }
    if (!$("#ka" + sorted[3].id).hasClass("max")) {
        $("#ka" + sorted[3].id).addClass("max");
    }
    if (!$("#ka" + sorted[4].id).hasClass("max")) {
        $("#ka" + sorted[4].id).addClass("max");
    }
    if (!$("#ka" + sorted[75].id).hasClass("min")) {
        $("#ka" + sorted[75].id).addClass("min");
    }
    if (!$("#ka" + sorted[76].id).hasClass("min")) {
        $("#ka" + sorted[76].id).addClass("min");
    }
    if (!$("#ka" + sorted[77].id).hasClass("min")) {
        $("#ka" + sorted[77].id).addClass("min");
    }
    if (!$("#ka" + sorted[78].id).hasClass("min")) {
        $("#ka" + sorted[78].id).addClass("min");
    }
    if (!$("#ka" + sorted[79].id).hasClass("min")) {
        $("#ka" + sorted[79].id).addClass("min");
    }
    
    if ($(".sorting").hasClass("sort1")) {
        _statistics.map(function(val, index) {
            $(".statistics_table").append(
                '<div class="table_row">' +
                    '<div class="table_row_itm statistic_num"><span class="ben_his_itm">' + (index + 1) + '</span></div>' +
                    '<div class="table_row_itm statistic_line">' +
                        '<div class="statistic_line_bg" style="width:' + (val / (sorted[0].val / 100)) + '%"></div>' +
                    '</div>' +
                    '<div class="table_row_itm statistic_val">' + val + '</div>' +
                '</div>'
            );
        });
    } else {
        sorted.map(function(item) {
            $(".statistics_table").append(
                '<div class="table_row">' +
                    '<div class="table_row_itm statistic_num"><span class="ben_his_itm">' + item.id + '</span></div>' +
                    '<div class="table_row_itm statistic_line">' +
                        '<div class="statistic_line_bg" style="width:' + (item.val / (sorted[0].val / 100)) + '%"></div>' +
                    '</div>' +
                    '<div class="table_row_itm statistic_val">' + item.val + '</div>' +
                '</div>'
            );
        });
    }
}

function CreateNewTicketDiv(a) {
    $(".bet_sele").removeClass("bet_sele_first");
    var possibleWin = a.b * maxScaledKayf(a.n.length);
    if (possibleWin > _max_win) {
        possibleWin = _max_win;
    }
    
    var ticketDiv = $('<div class="bet_sele bet_sele_first">' +
        '<div class="ticket_help">?</div>' +
        '<div class="ticket_sel_cont_ttl">' +
            '<span class="tic_curr_n">' + _my_tickets.length + '</span>' +
            '<span class="ticket_sel_cont_ttl_txt">' + _all_translation[_language].posible_win + '</span>' +
            '<span class="tic_s_win">' + NumberFormatterR(possibleWin) + '</span>' +
        '</div>' +
    '</div>');
    
    var matchTable1 = $('<div class="ticket_match_tbl1">' +
        '<div class="ticket_match_tbl_itm">' + _all_translation[_language].match + '</div>' +
    '</div>');
    
    var matchTable2 = $('<div class="ticket_match_tbl2">' +
        '<div class="ticket_match_tbl_itm">' + _all_translation[_language].pays + '</div>' +
    '</div>');
    
    var ticketSelTable = $('<div class="ticket_sel_tbl"></div>');
    var count = 0;
    
    _all_kayfs[a.n.length - 1].map(function(mult, index) {
        if (mult > 0) {
            var lasoneClass = index == a.n.length ? "lasone" : "";
            matchTable1.append('<div class="ticket_match_tbl_itm ombl selected ' + lasoneClass + '">' + index + '</div>');
            matchTable2.append('<div class="ticket_match_tbl_itm ombl selected ' + lasoneClass + '">x' + formatKayf(mult) + '</div>');
            count++;
        }
    });
    
    if (7 - count > 0) {
        for (var i = 0; i < 7 - count; i++) {
            matchTable1.append('<div class="ticket_match_tbl_itm ombl"></div>');
            matchTable2.append('<div class="ticket_match_tbl_itm ombl"></div>');
        }
    }
    
    for (var l = 0; l < 10; l++) {
        if (l < a.n.length) {
            ticketSelTable.append('<div class="tic_b selected">' + a.n[l] + '</div>');
        } else {
            ticketSelTable.append('<div class="tic_b"></div>');
        }
    }
    
    return ticketDiv.append(matchTable1).append(matchTable2).append(ticketSelTable);
}

function checkmytickets(t) {
    if ($(".my_tk")[0]) {
        $(".my_tk").each(function() {
            if ($(this).attr("data-round").toString() != t.toString()) {
                $(this).remove();
            }
        });
    }
}

// ============================================
// PARTITION 11: Device Detection
// ============================================

(function() {
    var t, e, a, s, _, n, i, l, r = window.device;
    window.device = {};
    e = window.document.documentElement;
    l = window.navigator.userAgent.toLowerCase();
    
    device.ios = function() {
        return device.iphone() || device.ipod() || device.ipad();
    };
    device.iphone = function() {
        return a("iphone");
    };
    device.ipod = function() {
        return a("ipod");
    };
    device.ipad = function() {
        return a("ipad");
    };
    device.android = function() {
        return a("android");
    };
    device.androidPhone = function() {
        return device.android() && a("mobile");
    };
    device.androidTablet = function() {
        return device.android() && !a("mobile");
    };
    device.blackberry = function() {
        return a("blackberry") || a("bb10") || a("rim");
    };
    device.blackberryPhone = function() {
        return device.blackberry() && !a("tablet");
    };
    device.blackberryTablet = function() {
        return device.blackberry() && a("tablet");
    };
    device.windows = function() {
        return a("windows");
    };
    device.windowsPhone = function() {
        return device.windows() && a("phone");
    };
    device.windowsTablet = function() {
        return device.windows() && a("touch");
    };
    device.fxos = function() {
        return (a("(mobile;") || a("(tablet;")) && a("; rv:");
    };
    device.fxosPhone = function() {
        return device.fxos() && a("mobile");
    };
    device.fxosTablet = function() {
        return device.fxos() && a("tablet");
    };
    device.meego = function() {
        return a("meego");
    };
    device.mobile = function() {
        return device.androidPhone() || device.iphone() || device.ipod() || 
               device.windowsPhone() || device.blackberryPhone() || 
               device.fxosPhone() || device.meego();
    };
    device.tablet = function() {
        return device.ipad() || device.androidTablet() || device.blackberryTablet() || 
               device.windowsTablet() || device.fxosTablet();
    };
    device.portrait = function() {
        return Math.abs(window.orientation) !== 90;
    };
    device.landscape = function() {
        return Math.abs(window.orientation) === 90;
    };
    device.noConflict = function() {
        window.device = r;
        return this;
    };
    
    a = function(t) {
        return l.indexOf(t) !== -1;
    };
    _ = function(t) {
        t = new RegExp(t, "i");
        return e.className.match(t);
    };
    t = function(t) {
        return _(t) ? void 0 : e.className += " " + t;
    };
    i = function(t) {
        return _(t) ? e.className = e.className.replace(t, "") : void 0;
    };
    
    if (device.ios()) {
        if (device.ipad()) {
            t("ios ipad tablet");
        } else if (device.iphone()) {
            t("ios iphone mobile");
        } else if (device.ipod()) {
            t("ios ipod mobile");
        }
    } else if (device.android()) {
        if (device.androidTablet()) {
            t("android tablet");
        } else {
            t("android mobile");
        }
    } else if (device.blackberry()) {
        if (device.blackberryTablet()) {
            t("blackberry tablet");
        } else {
            t("blackberry mobile");
        }
    } else if (device.windows()) {
        if (device.windowsTablet()) {
            t("windows tablet");
        } else if (device.windowsPhone()) {
            t("windows mobile");
        } else {
            t("desktop");
        }
    } else if (device.fxos()) {
        if (device.fxosTablet()) {
            t("fxos tablet");
        } else {
            t("fxos mobile");
        }
    } else if (device.meego()) {
        t("meego mobile");
    } else {
        t("desktop");
    }
    
    s = function() {
        return device.landscape() ? (i("portrait"), t("landscape")) : (i("landscape"), t("portrait"));
    };
    n = "onorientationchange" in window ? "orientationchange" : "resize";
    if (window.addEventListener) {
        window.addEventListener(n, s, false);
    } else if (window.attachEvent) {
        window.attachEvent(n, s);
    } else {
        window[n] = s;
    }
    s();
}).call(this);

// ============================================
// PARTITION 12: Document Ready and Event Handlers
// ============================================

$(document).ready(function() {
    ResizeContent();
    window.addEventListener("resize", ResizeContent);
    
    // Bet board cross selection handlers
    for (var t = document.querySelectorAll(".bet_board_itm_qross"), e = 0; e < t.length; ++e) {
        t[e].addEventListener("mouseenter", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            if (!document.getElementById("ka" + num).classList.contains("ovr") && _my_selected_numbers.length < 10) {
                document.getElementById("ka" + num).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 1)).classList.contains("ovr") && _my_selected_numbers.length < 9) {
                document.getElementById("ka" + (num - 1)).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 10)).classList.contains("ovr") && _my_selected_numbers.length < 8) {
                document.getElementById("ka" + (num - 10)).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 11)).classList.contains("ovr") && _my_selected_numbers.length < 7) {
                document.getElementById("ka" + (num - 11)).classList.add("ovr");
            }
        });
        
        t[e].addEventListener("mouseleave", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            document.getElementById("ka" + num).classList.remove("ovr");
            document.getElementById("ka" + (num - 1)).classList.remove("ovr");
            document.getElementById("ka" + (num - 10)).classList.remove("ovr");
            document.getElementById("ka" + (num - 11)).classList.remove("ovr");
        });
        
        t[e].addEventListener("click", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            if ($(".global_wrapper").hasClass("stopbet") || $(".bet_set_btn").hasClass("wait")) {
                return;
            }
            if (!document.getElementById("ka" + num).classList.contains("ovr") && _my_selected_numbers.length < 10) {
                document.getElementById("ka" + num).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 1)).classList.contains("ovr") && _my_selected_numbers.length < 9) {
                document.getElementById("ka" + (num - 1)).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 10)).classList.contains("ovr") && _my_selected_numbers.length < 8) {
                document.getElementById("ka" + (num - 10)).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 11)).classList.contains("ovr") && _my_selected_numbers.length < 7) {
                document.getElementById("ka" + (num - 11)).classList.add("ovr");
            }
            
            if (document.getElementById("ka" + num).classList.contains("selected") &&
                document.getElementById("ka" + (num - 1)).classList.contains("selected") &&
                document.getElementById("ka" + (num - 10)).classList.contains("selected") &&
                document.getElementById("ka" + (num - 11)).classList.contains("selected")) {
                DeselectNumver(num);
                DeselectNumver(num - 1);
                DeselectNumver(num - 10);
                DeselectNumver(num - 11);
            } else {
                SelectNumver(num - 11);
                SelectNumver(num - 10);
                SelectNumver(num - 1);
                SelectNumver(num);
            }
        });
    }
    
    // Bet board left selection handlers
    for (var a = document.querySelectorAll(".bet_board_itm_left"), e = 0; e < a.length; ++e) {
        a[e].addEventListener("mouseenter", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            if (!document.getElementById("ka" + num).classList.contains("ovr") && _my_selected_numbers.length < 10) {
                document.getElementById("ka" + num).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 1)).classList.contains("ovr") && _my_selected_numbers.length < 9) {
                document.getElementById("ka" + (num - 1)).classList.add("ovr");
            }
        });
        
        a[e].addEventListener("mouseleave", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            document.getElementById("ka" + num).classList.remove("ovr");
            document.getElementById("ka" + (num - 1)).classList.remove("ovr");
        });
        
        a[e].addEventListener("click", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            if ($(".global_wrapper").hasClass("stopbet") || $(".bet_set_btn").hasClass("wait")) {
                return;
            }
            if (!document.getElementById("ka" + num).classList.contains("ovr") && _my_selected_numbers.length < 10) {
                document.getElementById("ka" + num).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 1)).classList.contains("ovr") && _my_selected_numbers.length < 9) {
                document.getElementById("ka" + (num - 1)).classList.add("ovr");
            }
            
            if (document.getElementById("ka" + num).classList.contains("selected") &&
                document.getElementById("ka" + (num - 1)).classList.contains("selected")) {
                DeselectNumver(num);
                DeselectNumver(num - 1);
            } else {
                SelectNumver(num - 1);
                SelectNumver(num);
            }
        });
    }
    
    // Bet board top selection handlers
    for (var s = document.querySelectorAll(".bet_board_itm_top"), e = 0; e < s.length; ++e) {
        s[e].addEventListener("mouseenter", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            if (!document.getElementById("ka" + num).classList.contains("ovr") && _my_selected_numbers.length < 10) {
                document.getElementById("ka" + num).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 10)).classList.contains("ovr") && _my_selected_numbers.length < 9) {
                document.getElementById("ka" + (num - 10)).classList.add("ovr");
            }
        });
        
        s[e].addEventListener("mouseleave", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            document.getElementById("ka" + num).classList.remove("ovr");
            document.getElementById("ka" + (num - 10)).classList.remove("ovr");
        });
        
        s[e].addEventListener("click", function(event) {
            var num = parseInt(event.target.parentElement.getAttribute("id").substr(2));
            if ($(".global_wrapper").hasClass("stopbet") || $(".bet_set_btn").hasClass("wait")) {
                return;
            }
            if (!document.getElementById("ka" + num).classList.contains("ovr") && _my_selected_numbers.length < 10) {
                document.getElementById("ka" + num).classList.add("ovr");
            }
            if (!document.getElementById("ka" + (num - 10)).classList.contains("ovr") && _my_selected_numbers.length < 9) {
                document.getElementById("ka" + (num - 10)).classList.add("ovr");
            }
            
            if (document.getElementById("ka" + num).classList.contains("selected") &&
                document.getElementById("ka" + (num - 10)).classList.contains("selected")) {
                DeselectNumver(num);
                DeselectNumver(num - 10);
            } else {
                SelectNumver(num - 10);
                SelectNumver(num);
            }
        });
    }
    
    // Bet board item click handlers
    for (var _ = document.querySelectorAll(".bet_board_itm"), e = 0; e < _.length; ++e) {
        _[e].addEventListener("click", function(event) {
            if (event.target.classList.contains("bet_board_itm")) {
                var num = parseInt(event.target.getAttribute("id").substr(2));
                if ($(".global_wrapper").hasClass("stopbet") || $(".bet_set_btn").hasClass("wait")) {
                    return;
                }
                if (event.target.classList.contains("selected")) {
                    DeselectNumver(num);
                } else {
                    SelectNumver(num);
                }
                if (_tickets_carousel) {
                    _tickets_carousel.trigger("to.owl.carousel", _my_tickets.length);
                }
            }
        });
    }
    
    // Bet input button handlers
    $("body").on("click", ".bet_input_btn_m,.bet_input_btn", function(event) {
        event.preventDefault();
        if ($(this).hasClass("keno-freebet-gear-btn") || $(this).attr("id") === "kenoFreeBetGearBtn") {
            return false;
        }
        if ($(this).hasClass("is-disabled")) {
            return false;
        }
        if (_credit >= _min_bet && !$(".bet_set_btn").hasClass("wait") && 
            !$(".global_wrapper").hasClass("stopbet") && _my_tickets.length < 20) {
            var action = $(this).attr("data-action") || "";
            var rawVal = $(this).attr("data-val");
            if (action === "max" || rawVal === "max" || $(this).hasClass("bet_input_max")) {
                var creditCap = Number(_credit);
                if (!Number.isFinite(creditCap) || creditCap < 0) creditCap = _max_bet;
                _bet = Math.min(_max_bet, creditCap);
            } else if ($(this).hasClass("double_bet")) {
                _bet *= 2;
            } else {
                _bet += parseFloat(rawVal);
            }
            _bet = parseFloat(Number(_bet).toFixed(2));
            CheckBetMinMax();
            $(".bet_input_bar").val(_bet);
            if (_my_selected_numbers.length > 0) {
                var possibleWin = _bet * maxScaledKayf(_my_selected_numbers.length);
                if (possibleWin > _max_win) {
                    possibleWin = _max_win;
                }
                $(".ticket_sel_cont_posible_win").text(NumberFormatterR(possibleWin));
            }
        }
        return false;
    });
    
    // Language selection handler
    $("body").on("click", ".mobile_menu_top_bar_lang", function(event) {
        event.preventDefault();
        $(".mobile_menu_top_bar_lang").removeClass("active");
        $(this).addClass("active");
        _language = $(this).attr("data-lang");
        SetLanguage();
        return false;
    });
    
    // Sound toggle handler
    $("body").on("click", ".mobile_menu_top_bar_sound", function(event) {
        event.preventDefault();
        if ($(this).hasClass("active")) {
            $(this).removeClass("active");
        } else {
            $(this).addClass("active");
        }
        sound_muted = !sound_muted;
        return false;
    });
    
    // Menu open handlers
    $("body").on("click", ".menu_icon,.ticket_help,.settings_icon", function(event) {
        event.preventDefault();
        if (!$(".mobile_menu_cont").hasClass("active")) {
            $("body").addClass("stop_scroll");
            $(".mobile_menu_cont").addClass("active");
            renderKenoFreeBetPanels();
        }
        return false;
    });
    
    // Menu close handler
    $("body").on("click", ".menu_close", function(event) {
        event.preventDefault();
        $("body").removeClass("stop_scroll");
        $(".mobile_menu_cont").removeClass("active");
        return false;
    });

    // Free bet gear → modal (same picker as menu FREE BET tab)
    $("body").on("click", "#kenoFreeBetGearBtn", function(event) {
        event.preventDefault();
        event.stopPropagation();
        openKenoFreeBetModal();
        return false;
    });
    $("body").on("click", "#kenoFreeBetModalClose", function(event) {
        event.preventDefault();
        closeKenoFreeBetModal();
        return false;
    });
    $("body").on("click", "#kenoFreeBetModal", function(event) {
        if (event.target && event.target.id === "kenoFreeBetModal") {
            closeKenoFreeBetModal();
        }
    });
    $("body").on("click", ".keno-fb-option", function(event) {
        event.preventDefault();
        var id = $(this).attr("data-free-bet-id");
        selectKenoFreeBet(id);
        return false;
    });
    
    // Tab handlers — scope active state to the clicked tab strip only
    $("body").on("click", ".tab_itm", function(event) {
        event.preventDefault();
        var $tab = $(this);
        var $strip = $tab.parent();
        var $wrapper = $strip.parent();
        $strip.find(".tab_itm").removeClass("active");
        $wrapper.find(".tab_cont").removeClass("active");
        $tab.addClass("active");
        $wrapper.find(".cont_" + $tab.attr("id")).addClass("active");
        updateKenoSidebarBrand();
        return false;
    });

    // Keep Fairness/Atlas empty-state in sync when tab lists fill/clear
    var leftTabs = document.querySelector(".content_left_side .left_side_tabs_cont");
    if (leftTabs && typeof MutationObserver !== "undefined") {
        var brandSyncTimer = null;
        var brandObserver = new MutationObserver(function() {
            if (brandSyncTimer) clearTimeout(brandSyncTimer);
            brandSyncTimer = setTimeout(updateKenoSidebarBrand, 50);
        });
        brandObserver.observe(leftTabs, { childList: true, subtree: true });
    }
    updateKenoSidebarBrand();
    
    // Mobile menu tab handlers
    $("body").on("click", ".mobile_menu_tab_itm", function(event) {
        event.preventDefault();
        $(".mobile_menu_tab_itm").removeClass("active");
        $(".mobile_menu_cont_itm").removeClass("active");
        $(this).addClass("active");
        $(".cont_" + $(this).attr("id")).addClass("active");
        if ($(this).attr("id") === "mtab3") {
            renderKenoFreeBetPanels();
        }
        return false;
    });

    // Initial free-bet panels (empty until login)
    renderKenoFreeBetPanels();
    
    // Bet set button handler
    $("body").on("click", ".bet_set_btn", function(event) {
        event.preventDefault();
        if (!_loginStatus) {
            return false;
        }
        if (!CheckBetInputBox()) {
            if (_credit < _min_bet) {
                ShowWarning(_all_translation[_language].wrong_bet3, true);
            } else {
                ShowWarning(_all_translation[_language].wrong_bet2, true);
            }
            return false;
        }
        
        if ($(this).hasClass("active") && !$(".global_wrapper").hasClass("stopbet") && 
            !$(this).hasClass("wait") && _game_status == 1 && _my_tickets.length < 20 && 
            _my_selected_numbers.length > 0) {
            $(this).removeClass("active");
            var usingFree = _selected_free_bet_id != null && _global_free_spins > 0;
            if (!usingFree) {
                _credit -= _bet;
                $(".header_credit").html(formatMoney(_credit) + " " + _currency);
            }
            if (!$(this).hasClass("wait")) {
                $(this).addClass("wait");
            }
            var betPayload = {
                status: "betset",
                bet: _bet,
                numbers: _my_selected_numbers
            };
            if (usingFree) {
                betPayload.freeBetId = _selected_free_bet_id;
            }
            Socket_SendEvent(betPayload);
            $(".bet_board_itm").removeClass("selected").removeClass("ovr");
            $(".ticket_sel_tbl_itm").removeClass("selected").text("");
            _my_selected_numbers = [];
        } else if (!$(this).hasClass("wait") && _my_selected_numbers.length > 0 && 
                   _my_tickets_nosent.length < 20 && _game_status == 0) {
            var usingFreeQueued = _selected_free_bet_id != null && _global_free_spins > 0;
            if (!usingFreeQueued) {
                _credit -= _bet;
                $(".header_credit").html(formatMoney(_credit) + " " + _currency);
            }
            _my_tickets_nosent.push({
                bet: _bet,
                numbers: _my_selected_numbers,
                freeBetId: usingFreeQueued ? _selected_free_bet_id : null
            });
            $(".game_table").prepend(
                '<div class="table_row my_tk_load">' +
                    '<div class="table_row_ttl">' + _my_tickets_nosent.length + " " + _all_translation[_language].me + '</div>' +
                    '<div class="table_row_bet_nums">' + GenerateBetNums(_my_selected_numbers, true) + '</div>' +
                    '<div class="table_row_bet_status">' +
                        '<div class="table_row_halff">' + _all_translation[_language].bet + " " + _bet + '</div>' +
                        '<div class="table_row_halff game_status_wait"></div>' +
                    '</div>' +
                '</div>'
            );
            $(".bet_board_itm").removeClass("selected").removeClass("ovr");
            $("#bet_selections").removeClass("selected");
            $(".ticket_sel_tbl_itm").removeClass("selected").text("");
            _my_selected_numbers = [];
        } else if (_credit < _min_bet) {
            ShowWarning(_all_translation[_language].wrong_bet3, true);
        }
        return false;
    });
    
    // Home icon handler
    $("body").on("click", ".home_icon", function(event) {
        event.preventDefault();
        close_game();
        return false;
    });
    
    // Bet input bar change handler
    $("#bet_input_bar").change(function() {
        var betValue = $(this).val().trim();
        if (isNaN(betValue) || betValue == "") {
            betValue = _min_bet;
            $(this).val(betValue);
            ShowWarning(_all_translation[_language].wrong_bet2, true);
        } else {
            betValue = parseFloat(NumberFormatterR(betValue));
            if (betValue < _min_bet) {
                betValue = _min_bet;
                $(this).val(betValue);
            } else if (betValue > _max_bet) {
                betValue = _max_bet;
                $(this).val(betValue);
            }
        }
        _bet = betValue;
        _bet = parseFloat(_bet.toFixed(2));
        CheckBetMinMax();
        $(".bet_input_bar").val(_bet);
        if (_my_selected_numbers.length > 0) {
            var possibleWin = _bet * maxScaledKayf(_my_selected_numbers.length);
            if (possibleWin > _max_win) {
                possibleWin = _max_win;
            }
            $(".ticket_sel_cont_posible_win").text(NumberFormatterR(possibleWin));
        }
    });
    
    // Bet input bar input handler
    $("#bet_input_bar").on("input", function() {
        var betValue = $(this).val().trim();
        if (isNaN(betValue)) {
            betValue = _min_bet;
            $(this).val(betValue);
        } else {
            betValue = parseFloat(NumberFormatterR(betValue));
            if (betValue > _max_bet) {
                betValue = _max_bet;
                $(this).val(betValue);
            }
        }
    });
    
    // Bet input bar keyup handler
    $("#bet_input_bar").keyup(function() {
        var betValue = $(this).val().trim();
        if (isNaN(betValue)) {
            betValue = _min_bet;
            $(this).val(betValue);
        } else {
            betValue = parseFloat(NumberFormatterR(betValue));
            if (betValue > _max_bet) {
                betValue = _max_bet;
                $(this).val(betValue);
            }
        }
    });
    
    // Load more history handler
    $("body").on("click", ".btn_load_more_history", function(event) {
        event.preventDefault();
        if ($(this).hasClass("active")) {
            return false;
        }
        $(this).addClass("active");
        PostRec("/mygamehistory", {
            page: _mybethistorypage,
            token: _user_token,
            player_id: _user_id
        }, function(error, response) {
            $(".btn_load_more_history").removeClass("active");
            if (response.games) {
                var count = 0;
                response.games.map(function(game) {
                    if (_mybethistoryids.indexOf(game.game_id.toString()) == -1) {
                        game.after = true;
                        count += game.tickets.length;
                        AddToMyHistory(game);
                    }
                });
                if (count < 50) {
                    $(".btn_load_more_history").hide();
                }
            }
        });
        return false;
    });
    
    // Play demo handler
    $("body").on("click", ".bet_play_demo", function(event) {
        if (_credit >= _min_bet) {
            event.preventDefault();
            $(".first_screen_pop_up").hide();
            _demo_popup_timer = 0;
            return false;
        }
    });
    
    // Close button handler
    $("body").on("click", ".close_btn", function(event) {
        event.preventDefault();
        $(".warning_alert_popup").hide();
        return false;
    });
    
    // Fairness popup close handler
    $("body").on("click", ".fairness_popup_close", function(event) {
        event.preventDefault();
        $(".fairness_popup").removeClass("active");
        return false;
    });
    
    // Copy to clipboard handler
    $("body").on("click", ".copy_to_clipboard", function(event) {
        event.preventDefault();
        if (!$(this).hasClass("active")) {
            $(this).addClass("active");
            var self = this;
            setTimeout(function() {
                $(self).removeClass("active");
            }, 500);
        }
        navigator.clipboard.writeText($(this).attr("data-val"));
        _copy_buffer = $(this).attr("data-val");
        return false;
    });
    
    // Paste to value handler
    $("body").on("click", ".past_to_value", function(event) {
        event.preventDefault();
        $(this).parent().find(".fairness_popup_hash").html(_copy_buffer);
        return false;
    });
    
    // Fairness info handlers
    $("body").on("click", ".about_fairness_info,.fairness_open,.fairness_logo", function(event) {
        event.preventDefault();
        $(".fairness_popup").removeClass("active");
        $(".settings_icon").addClass("active");
        $("body").addClass("stop_scroll");
        $(".mobile_menu_cont").addClass("active");
        $(".mobile_menu_tab_itm").removeClass("active");
        $(".mobile_menu_cont_itm").removeClass("active");
        $("#mtab2").addClass("active");
        $(".cont_mtab2").addClass("active");
        return false;
    });
    
    // Check hash handler
    $("body").on("click", ".btn_check_hash", function(event) {
        event.preventDefault();
        if ($(this).hasClass("active")) {
            return false;
        }
        $(this).addClass("active");
        var key = $(".key_container").text().trim();
        var salt = $(".salt_container").text().trim();
        if (key.length > 0 && salt.length > 0) {
            PostRec("/gethash", {
                key: key,
                salt: salt,
                token: _user_token,
                player_id: _user_id
            }, function(error, response) {
                $(".btn_check_hash").removeClass("active");
                if (response.hash) {
                    $(".hash_container").html(response.hash);
                }
            });
        } else {
            $(".btn_check_hash").removeClass("active");
        }
        return false;
    });
    
    // Game ID and fairness handlers
    $("body").on("click", ".game_id,.tab_history_itm_top_ttl_dat,.fairness_icn", function(event) {
        event.preventDefault();
        if ($(".home").hasClass("fairness")) {
            $("#round_key").text($(this).attr("data-key") || "");
            $("#round_salt").text($(this).attr("data-salt") || "");
            $("#round_hash").text($(this).attr("data-hash") || "");
            $("#round_key").parent().find(".copy_to_clipboard").attr("data-val", $(this).attr("data-key") || "");
            $("#round_salt").parent().find(".copy_to_clipboard").attr("data-val", $(this).attr("data-salt") || "");
            $("#round_hash").parent().find(".copy_to_clipboard").attr("data-val", $(this).attr("data-hash") || "");
            $(".game_round_id_num").text($(this).attr("data-id"));
            $(".key_container").text("");
            $(".salt_container").text("");
            $(".hash_container").text("");
            if (!$(".fairness_popup").hasClass("active")) {
                $(".fairness_popup").addClass("active");
            }
        }
        return false;
    });
    
    // Sorting handler
    $("body").on("click", ".sorting", function(event) {
        event.preventDefault();
        if ($(".sorting").hasClass("sort2")) {
            $(".sorting").removeClass("sort2");
            if (!$(".sorting").hasClass("sort1")) {
                $(".sorting").addClass("sort1");
            }
        } else {
            $(".sorting").removeClass("sort1");
            if (!$(".sorting").hasClass("sort2")) {
                $(".sorting").addClass("sort2");
            }
        }
        UpdateStatistics();
        return false;
    });
    
    // Initialize
    SetLanguage();
    if (device.mobile() || _is_mobile) {
        $("#mobile_rotate").show();
        addCssToDocument();
    }
    _game_init = true;
    if (window.__kenoPendingStartInit && !_is_inited) {
        var pending = window.__kenoPendingStartInit;
        window.__kenoPendingStartInit = null;
        start_init(pending);
    } else {
        Socket_Login();
    }
    if (!_loginStatus) {
        setBetLockedUntilWallet(true);
    }
    // Don't hold the Atlas splash for a slow wallet / first-login snapshot.
    setTimeout(function() {
        hideInitialLoader();
    }, 2500);
});

