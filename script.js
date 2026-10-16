"use strict";

/* =========================================================
   NAOL BROKER
   Trading Dashboard JavaScript
   Version 1.0

   IMPORTANT:
   - Demo simulator only.
   - Sample prices are not live market quotes.
   - No real broker orders are sent.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. HELPERS
       ===================================================== */

    const $ = (id) => document.getElementById(id);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const clamp = (value, min, max) =>
        Math.min(max, Math.max(min, value));

    const roundTo = (value, decimals = 2) => {
        const factor = Math.pow(10, decimals);
        return Math.round((value + Number.EPSILON) * factor) / factor;
    };

    const money = (value) => {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "$0.00";
        }

        return number.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const numberFormat = (value, decimals = 2) => {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return number.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    const escapeHTML = (value) => {
        return String(value).replace(/[&<>"']/g, (character) => {
            const map = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return map[character];
        });
    };

    const formatTime = (date = new Date()) => {
        return date.toLocaleString();
    };

    const safeNumber = (value, fallback = 0) => {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    };


    /* =====================================================
       2. APPLICATION STATE
       ===================================================== */

    const INITIAL_BALANCE = 10000;

    const state = {
        balance: INITIAL_BALANCE,

        selectedSymbol: "XAUUSD",
        timeframe: "5m",

        positions: [],
        history: [],
        activities: [],

        nextPositionId: 1,

        notificationsEnabled: true,

        chart: null,
        candleSeries: null,
        terminalChart: null,
        terminalSeries: null,

        chartReady: false,
        terminalChartReady: false,

        lastChartClose: null,

        demoPrices: {
            XAUUSD: 2650.00,
            BTCUSD: 95000.00,
            ETHUSD: 3500.00
        },

        previousPrices: {
            XAUUSD: 2650.00,
            BTCUSD: 95000.00,
            ETHUSD: 3500.00
        },

        demoChanges: {
            XAUUSD: 0,
            BTCUSD: 0,
            ETHUSD: 0
        }
    };


    /* =====================================================
       3. MARKET CONFIGURATION

       Illustrative values only.
       These are NOT current market prices.
       ===================================================== */

    const MARKET_CONFIG = {
        XAUUSD: {
            name: "Gold / US Dollar",
            decimals: 2,
            tick: 0.10,
            base: 2650.00,
            color: "#f5c76b"
        },

        BTCUSD: {
            name: "Bitcoin / US Dollar",
            decimals: 2,
            tick: 10,
            base: 95000.00,
            color: "#f7931a"
        },

        ETHUSD: {
            name: "Ethereum / US Dollar",
            decimals: 2,
            tick: 1,
            base: 3500.00,
            color: "#9ca8ff"
        }
    };


    /* =====================================================
       4. NOTIFICATIONS
       ===================================================== */

    function showToast(title, message, type = "success") {

        if (!state.notificationsEnabled) {
            return;
        }

        const container = $("toastContainer");

        if (!container) {
            return;
        }

        const toast = document.createElement("div");

        toast.className = "toast" +
            (type === "error" ? " error" : "");

        const icon = type === "error" ? "!" : "✓";

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>

            <div class="toast-content">
                <strong>${escapeHTML(title)}</strong>
                <p>${escapeHTML(message)}</p>
            </div>

            <button
                type="button"
                class="toast-close"
                aria-label="Dismiss notification">
                ×
            </button>
        `;

        container.appendChild(toast);

        const removeToast = () => {

            if (!toast.isConnected) {
                return;
            }

            toast.classList.add("toast-exit");

            window.setTimeout(() => {
                toast.remove();
            }, 160);
        };

        const closeButton = toast.querySelector(".toast-close");

        closeButton.addEventListener("click", removeToast);

        window.setTimeout(removeToast, 4200);
    }


    /* =====================================================
       5. ACTIVITY LOG
       ===================================================== */

    function addActivity(title, description, result = null) {

        state.activities.unshift({
            id: Date.now() + Math.random(),
            title,
            description,
            result,
            time: new Date()
        });

        state.activities = state.activities.slice(0, 30);

        renderActivities();
    }


    function renderActivities() {

        const container = $("activityList");

        if (!container) {
            return;
        }

        if (state.activities.length === 0) {

            container.innerHTML = `
                <div class="empty-activity">
                    Your demo activity will appear here.
                </div>
            `;

            return;
        }

        container.innerHTML = state.activities.map((activity) => {

            let resultHTML = "";

            if (activity.result !== null) {

                const result = safeNumber(activity.result);

                const resultClass = result > 0
                    ? "positive"
                    : result < 0
                        ? "negative"
                        : "";

                resultHTML = `
                    <div class="activity-result ${resultClass}">
                        ${money(result)}
                    </div>
                `;
            }

            return `
                <div class="activity-item">

                    <div class="activity-symbol">N</div>

                    <div class="activity-details">

                        <strong>
                            ${escapeHTML(activity.title)}
                        </strong>

                        <small>
                            ${escapeHTML(activity.description)}
                            · ${escapeHTML(formatTime(activity.time))}
                        </small>

                    </div>

                    ${resultHTML}

                </div>
            `;

        }).join("");
    }


    /* =====================================================
       6. NAVIGATION
       ===================================================== */

    const pageTitles = {
        dashboard: "Overview",
        markets: "Markets",
        trade: "Trading Terminal",
        positions: "Open Positions",
        history: "Trade History",
        wallet: "Wallet",
        reports: "Reports",
        settings: "Settings"
    };


    function closeSidebar() {

        const sidebar = $("sidebar");
        const overlay = $("sidebarOverlay");

        if (sidebar) {
            sidebar.classList.remove("mobile-open");
        }

        if (overlay) {
            overlay.classList.remove("visible");
        }
    }


    function openSidebar() {

        const sidebar = $("sidebar");
        const overlay = $("sidebarOverlay");

        if (sidebar) {
            sidebar.classList.add("mobile-open");
        }

        if (overlay) {
            overlay.classList.add("visible");
        }
    }


    function navigateTo(page, options = {}) {

        const target = $("page-" + page);

        if (!target) {
            return;
        }

        $$(".page-section").forEach((section) => {
            section.classList.toggle(
                "active",
                section.id === "page-" + page
            );
        });

        $$(".nav-item").forEach((button) => {

            const isActive = button.dataset.page === page;

            button.classList.toggle("active", isActive);

            if (isActive) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        });

        const title = $("pageTitle");

        if (title) {
            title.textContent = pageTitles[page] || "Overview";
        }

        closeSidebar();

        if (!options.keepScroll) {
            window.scrollTo({
                top: 0,
                behavior: "auto"
            });
        }

        if (page === "trade") {
            resizeTerminalChart();
        }

        if (page === "positions") {
            renderAllPositions();
        }

        if (page === "history") {
            renderHistory();
        }

        if (page === "markets") {
            renderMarketsTable();
        }

        if (page === "reports") {
            renderReports();
        }
    }


    $$(".nav-item").forEach((button) => {

        button.addEventListener("click", () => {

            const page = button.dataset.page;

            if (page) {
                navigateTo(page);
            }
        });
    });


    $$("[data-page]").forEach((button) => {

        if (button.classList.contains("nav-item")) {
            return;
        }

        button.addEventListener("click", () => {

            const page = button.dataset.page;

            if (page) {
                navigateTo(page);
            }
        });
    });


    if ($("menuToggle")) {
        $("menuToggle").addEventListener("click", openSidebar);
    }

    if ($("closeSidebar")) {
        $("closeSidebar").addEventListener("click", closeSidebar);
    }

    if ($("sidebarOverlay")) {
        $("sidebarOverlay").addEventListener("click", closeSidebar);
    }

    window.addEventListener("resize", () => {

        if (window.innerWidth > 950) {
            closeSidebar();
        }

        resizeMainChart();
        resizeTerminalChart();
    });


    /* =====================================================
       7. MARKET HELPERS
       ===================================================== */

    function getPrice(symbol) {

        if (!Object.prototype.hasOwnProperty.call(
            state.demoPrices,
            symbol
        )) {
            return 0;
        }

        return state.demoPrices[symbol];
    }


    function getDecimals(symbol) {

        return MARKET_CONFIG[symbol]?.decimals ?? 2;
    }


    function formatPrice(symbol, price = getPrice(symbol)) {

        if (!Number.isFinite(price) || price <= 0) {
            return "—";
        }

        return numberFormat(price, getDecimals(symbol));
    }


    function getDemoPL(position) {

        const currentPrice = getPrice(position.symbol);

        if (!currentPrice || !position.entryPrice) {
            return 0;
        }

        const difference = position.direction === "BUY"
            ? currentPrice - position.entryPrice
            : position.entryPrice - currentPrice;

        /*
         * Illustrative P/L multiplier.
         * It is NOT a broker-specific contract calculation.
         */

        const multiplier = {
            XAUUSD: 10,
            BTCUSD: 0.01,
            ETHUSD: 0.10
        }[position.symbol] || 1;

        return roundTo(
            difference * position.volume * multiplier,
            2
        );
    }


    function getFloatingPL() {

        return roundTo(
            state.positions.reduce((total, position) => {
                return total + getDemoPL(position);
            }, 0),
            2
        );
    }


    function getEquity() {

        return roundTo(
            state.balance + getFloatingPL(),
            2
        );
    }


    /* =====================================================
       8. ACCOUNT DASHBOARD
       ===================================================== */

    function updateDashboard() {

        const floating = getFloatingPL();
        const equity = getEquity();

        if ($("balanceValue")) {
            $("balanceValue").textContent = money(state.balance);
        }

        if ($("equityValue")) {
            $("equityValue").textContent = money(equity);
        }

        if ($("floatingValue")) {

            const element = $("floatingValue");

            element.textContent = money(floating);

            element.classList.toggle("positive", floating > 0);
            element.classList.toggle("negative", floating < 0);
        }

        if ($("openPositionsValue")) {
            $("openPositionsValue").textContent =
                String(state.positions.length);
        }

        if ($("positionCount")) {
            $("positionCount").textContent =
                String(state.positions.length);
        }

        if ($("walletBalance")) {
            $("walletBalance").textContent = money(state.balance);
        }

        if ($("positionsSummary")) {

            const count = state.positions.length;

            $("positionsSummary").textContent =
                `${count} demo position${count === 1 ? "" : "s"}`;
        }

        renderPositions();
        renderAllPositions();
        renderMarketsTable();
        renderReports();
        updateSelectedInstrument();
    }


    /* =====================================================
       9. DEMO MARKET DATA

       This generates simulated sample prices.
       It does NOT connect to a live exchange.
       ===================================================== */

    function generateDemoMarketMovement(symbol) {

        const config = MARKET_CONFIG[symbol];

        if (!config) {
            return;
        }

        const previous = state.demoPrices[symbol];

        const direction = Math.random() > 0.5 ? 1 : -1;

        const movement = config.tick *
            (0.2 + Math.random() * 1.3) *
            direction;

        const next = Math.max(
            config.tick,
            roundTo(previous + movement, config.decimals)
        );

        state.previousPrices[symbol] = previous;
        state.demoPrices[symbol] = next;

        const base = config.base;

        state.demoChanges[symbol] = roundTo(
            ((next - base) / base) * 100,
            2
        );
    }


    function updateMarketWatch() {

        Object.keys(MARKET_CONFIG).forEach((symbol) => {

            const price = getPrice(symbol);
            const change = state.demoChanges[symbol];

            $$(`[data-price="${symbol}"]`).forEach((element) => {
                element.textContent = formatPrice(symbol, price);
            });

            $$(`[data-change="${symbol}"]`).forEach((element) => {

                const sign = change > 0
                    ? "+"
                    : "";

                element.textContent =
                    `${sign}${change.toFixed(2)}% · Demo`;

                element.classList.toggle("positive", change > 0);
                element.classList.toggle("negative", change < 0);
            });
        });
    }


    function updateSelectedInstrument() {

        const symbol = state.selectedSymbol;
        const price = getPrice(symbol);

        if ($("chartSymbol")) {
            $("chartSymbol").textContent = symbol;
        }

        if ($("chartPrice")) {
            $("chartPrice").textContent = formatPrice(symbol, price);
        }

        if ($("infoSymbol")) {
            $("infoSymbol").textContent = symbol;
        }

        if ($("infoPrice")) {
            $("infoPrice").textContent = formatPrice(symbol, price);
        }

        if ($("estimatedPrice")) {
            $("estimatedPrice").textContent =
                `${formatPrice(symbol, price)} (sample)`;
        }

        if ($("terminalChartTitle")) {
            $("terminalChartTitle").textContent = symbol;
        }

        if ($("terminalPrice")) {
            $("terminalPrice").textContent = formatPrice(symbol, price);
        }

        const changeElement = $("chartChange");

        if (changeElement) {

            const change = state.demoChanges[symbol];

            changeElement.textContent =
                `${change > 0 ? "+" : ""}${change.toFixed(2)}% · Simulated`;

            changeElement.classList.toggle("positive", change > 0);
            changeElement.classList.toggle("negative", change < 0);
        }

        if ($("infoDirection")) {

            const change = state.demoChanges[symbol];

            let direction = "Sideways (sample)";

            if (change > 0.05) {
                direction = "Upward (sample)";
            } else if (change < -0.05) {
                direction = "Downward (sample)";
            }

            $("infoDirection").textContent = direction;
        }
    }


    /* =====================================================
       10. SELECT SYMBOL
       ===================================================== */

    function selectSymbol(symbol) {

        if (!MARKET_CONFIG[symbol]) {
            return;
        }

        state.selectedSymbol = symbol;

        if ($("symbolSelect")) {
            $("symbolSelect").value = symbol;
        }

        if ($("tradeSymbol")) {
            $("tradeSymbol").value = symbol;
        }

        if ($("terminalSymbolSelect")) {
            $("terminalSymbolSelect").value = symbol;
        }

        updateSelectedInstrument();

        renderChartForSelectedSymbol();

        resizeTerminalChart();
    }


    if ($("symbolSelect")) {

        $("symbolSelect").addEventListener("change", (event) => {

            selectSymbol(event.target.value);
        });
    }


    if ($("tradeSymbol")) {

        $("tradeSymbol").addEventListener("change", (event) => {

            selectSymbol(event.target.value);
        });
    }


    if ($("terminalSymbolSelect")) {

        $("terminalSymbolSelect").addEventListener("change", (event) => {

            selectSymbol(event.target.value);
        });
    }


    $$(".watchlist-item").forEach((button) => {

        button.addEventListener("click", () => {

            const symbol = button.dataset.symbol;

            selectSymbol(symbol);

            navigateTo("dashboard");
        });
    });


    /* =====================================================
       11. CHART LIBRARY
       ===================================================== */

    function getChartLibrary() {

        if (
            typeof window.LightweightCharts === "undefined" ||
            typeof window.LightweightCharts.createChart !== "function"
        ) {
            return null;
        }

        return window.LightweightCharts;
    }


    function generateSampleCandles(symbol, count = 100) {

        const config = MARKET_CONFIG[symbol];

        let price = state.demoPrices[symbol];

        const candles = [];

        const now = Math.floor(Date.now() / 1000);

        let interval = 300;

        if (state.timeframe === "1m") {
            interval = 60;
        } else if (state.timeframe === "15m") {
            interval = 900;
        } else if (state.timeframe === "1h") {
            interval = 3600;
        }

        const startTime = now - count * interval;

        for (let i = 0; i < count; i++) {

            const open = price;

            const magnitude = config.tick *
                (1 + Math.random() * 5);

            const movement =
                (Math.random() > 0.5 ? 1 : -1) * magnitude;

            const close = Math.max(
                config.tick,
                open + movement
            );

            const wickUp = config.tick * Math.random() * 2;
            const wickDown = config.tick * Math.random() * 2;

            const high = Math.max(open, close) + wickUp;
            const low = Math.max(
                config.tick,
                Math.min(open, close) - wickDown
            );

            candles.push({
                time: startTime + i * interval,
                open: roundTo(open, config.decimals),
                high: roundTo(high, config.decimals),
                low: roundTo(low, config.decimals),
                close: roundTo(close, config.decimals)
            });

            price = close;
        }

        /*
         * Ensure the latest displayed candle ends
         * near the current sample quote.
         */

        if (candles.length > 0) {

            const last = candles[candles.length - 1];

            const target = state.demoPrices[symbol];

            const adjustment = target - last.close;

            last.close = roundTo(target, config.decimals);

            last.high = roundTo(
                Math.max(last.high, last.open, last.close),
                config.decimals
            );

            last.low = roundTo(
                Math.min(last.low, last.open, last.close),
                config.decimals
            );

            void adjustment;
        }

        return candles;
    }


    function chartOptions(container) {

        return {
            width: Math.max(300, container.clientWidth || 300),
            height: Math.max(240, container.clientHeight || 300),

            layout: {
                background: {
                    type: "solid",
                    color: getComputedStyle(document.body)
                        .getPropertyValue("--surface")
                        .trim() || "#101922"
                },

                textColor: getComputedStyle(document.body)
                    .getPropertyValue("--text-muted")
                    .trim() || "#71818e",

                fontFamily:
                    "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial"
            },

            grid: {
                vertLines: {
                    color: getComputedStyle(document.body)
                        .getPropertyValue("--border")
                        .trim() || "#23313d"
                },

                horzLines: {
                    color: getComputedStyle(document.body)
                        .getPropertyValue("--border")
                        .trim() || "#23313d"
                }
            },

            rightPriceScale: {
                borderColor: getComputedStyle(document.body)
                    .getPropertyValue("--border")
                    .trim() || "#23313d"
            },

            timeScale: {
                borderColor: getComputedStyle(document.body)
                    .getPropertyValue("--border")
                    .trim() || "#23313d",

                timeVisible: true,
                secondsVisible: false
            },

            crosshair: {
                mode: 0
            },

            handleScroll: true,
            handleScale: true
        };
    }


    function addCandlestickSeries(chart, library) {

        /*
         * Support both older and newer Lightweight Charts APIs.
         */

        if (typeof chart.addCandlestickSeries === "function") {

            return chart.addCandlestickSeries({
                upColor: "#00d69a",
                downColor: "#ff5268",

                borderUpColor: "#00d69a",
                borderDownColor: "#ff5268",

                wickUpColor: "#00d69a",
                wickDownColor: "#ff5268"
            });
        }

        if (typeof chart.addSeries === "function" &&
            library.CandlestickSeries) {

            return chart.addSeries(library.CandlestickSeries, {
                upColor: "#00d69a",
                downColor: "#ff5268",

                borderUpColor: "#00d69a",
                borderDownColor: "#ff5268",

                wickUpColor: "#00d69a",
                wickDownColor: "#ff5268"
            });
        }

        throw new Error("Candlestick chart API unavailable.");
    }


    function removeExistingChart(chart) {

        if (chart && typeof chart.remove === "function") {

            try {
                chart.remove();
            } catch (error) {
                console.warn("Chart cleanup:", error);
            }
        }
    }


    function renderChartForSelectedSymbol() {

        const container = $("chartContainer");

        if (!container) {
            return;
        }

        const library = getChartLibrary();

        if (!library) {

            container.innerHTML = `
                <div class="chart-placeholder">
                    <div class="chart-placeholder-icon">⌁</div>

                    <strong>Chart library unavailable</strong>

                    <p>
                        Check your internet connection and reload the page.
                    </p>
                </div>
            `;

            return;
        }

        removeExistingChart(state.chart);

        state.chart = null;
        state.candleSeries = null;
        state.chartReady = false;

        container.innerHTML = "";

        try {

            state.chart = library.createChart(
                container,
                chartOptions(container)
            );

            state.candleSeries = addCandlestickSeries(
                state.chart,
                library
            );

            state.candleSeries.setData(
                generateSampleCandles(
                    state.selectedSymbol,
                    100
                )
            );

            state.chart.timeScale().fitContent();

            state.chartReady = true;

            if ($("chartLastUpdated")) {
                $("chartLastUpdated").textContent =
                    "Sample data · Not live";
            }

        } catch (error) {

            console.error("Main chart error:", error);

            removeExistingChart(state.chart);

            state.chart = null;
            state.candleSeries = null;
            state.chartReady = false;

            container.innerHTML = `
                <div class="chart-placeholder">
                    <strong>Unable to create chart</strong>
                    <p>
                        Please reload the page and try again.
                    </p>
                </div>
            `;
        }
    }


    function renderTerminalChart() {

        const container = $("terminalChartContainer");

        if (!container) {
            return;
        }

        const library = getChartLibrary();

        if (!library) {

            container.innerHTML = `
                <div class="chart-placeholder">
                    <strong>Chart unavailable</strong>
                    <p>
                        Connect to the internet and reload the page.
                    </p>
                </div>
            `;

            return;
        }

        removeExistingChart(state.terminalChart);

        state.terminalChart = null;
        state.terminalSeries = null;
        state.terminalChartReady = false;

        container.innerHTML = "";

        try {

            state.terminalChart = library.createChart(
                container,
                chartOptions(container)
            );

            state.terminalSeries = addCandlestickSeries(
                state.terminalChart,
                library
            );

            state.terminalSeries.setData(
                generateSampleCandles(
                    state.selectedSymbol,
                    100
                )
            );

            state.terminalChart.timeScale().fitContent();

            state.terminalChartReady = true;

        } catch (error) {

            console.error("Terminal chart error:", error);

            removeExistingChart(state.terminalChart);

            state.terminalChart = null;
            state.terminalSeries = null;
            state.terminalChartReady = false;

            container.innerHTML = `
                <div class="chart-placeholder">
                    <strong>Chart could not load</strong>
                    <p>
                        Reload the page to try again.
                    </p>
                </div>
            `;
        }
    }


    function resizeMainChart() {

        if (!state.chartReady || !state.chart) {
            return;
        }

        const container = $("chartContainer");

        if (!container) {
            return;
        }

        state.chart.applyOptions({
            width: Math.max(300, container.clientWidth),
            height: Math.max(220, container.clientHeight)
        });
    }


    function resizeTerminalChart() {

        if (!state.terminalChartReady || !state.terminalChart) {
            return;
        }

        const container = $("terminalChartContainer");

        if (!container) {
            return;
        }

        state.terminalChart.applyOptions({
            width: Math.max(300, container.clientWidth),
            height: Math.max(250, container.clientHeight)
        });
    }


    if ($("timeframeSelect")) {

        $("timeframeSelect").addEventListener("change", (event) => {

            state.timeframe = event.target.value;

            renderChartForSelectedSymbol();
            renderTerminalChart();
        });
    }


    function refreshCharts() {

        renderChartForSelectedSymbol();
        renderTerminalChart();

        updateSelectedInstrument();
    }


    /* =====================================================
       12. VOLUME CONTROLS
       ===================================================== */

    function getValidatedVolume(inputElement) {

        if (!inputElement) {
            return null;
        }

        const volume = Number(inputElement.value);

        if (!Number.isFinite(volume) || volume < 0.01 || volume > 10) {

            showToast(
                "Invalid volume",
                "Volume must be between 0.01 and 10 lots.",
                "error"
            );

            return null;
        }

        const rounded = roundTo(volume, 2);

        inputElement.value = rounded.toFixed(2);

        return rounded;
    }


    function adjustVolume(inputId, amount) {

        const input = $(inputId);

        if (!input) {
            return;
        }

        let volume = Number(input.value);

        if (!Number.isFinite(volume)) {
            volume = 0.01;
        }

        volume = clamp(
            roundTo(volume + amount, 2),
            0.01,
            10
        );

        input.value = volume.toFixed(2);
    }


    if ($("increaseVolume")) {

        $("increaseVolume").addEventListener("click", () => {
            adjustVolume("tradeVolume", 0.01);
        });
    }


    if ($("decreaseVolume")) {

        $("decreaseVolume").addEventListener("click", () => {
            adjustVolume("tradeVolume", -0.01);
        });
    }


    /* =====================================================
       13. CREATE SIMULATED ORDER
       ===================================================== */

    function openDemoPosition(direction, symbol, volume) {

        if (!MARKET_CONFIG[symbol]) {

            showToast(
                "Unsupported instrument",
                "Choose an available demo instrument.",
                "error"
            );

            return false;
        }

        if (!["BUY", "SELL"].includes(direction)) {
            return false;
        }

        const price = getPrice(symbol);

        if (!Number.isFinite(price) || price <= 0) {

            showToast(
                "Price unavailable",
                "No sample price is available for this instrument.",
                "error"
            );

            return false;
        }

        const position = {
            id: state.nextPositionId++,

            symbol,
            direction,

            volume: roundTo(volume, 2),

            entryPrice: price,
            openedAt: new Date()
        };

        state.positions.unshift(position);

        addActivity(
            `${direction} ${symbol}`,
            `${volume.toFixed(2)} lots · Demo order opened`
        );

        updateDashboard();

        showToast(
            "Demo order created",
            `${direction} ${symbol} at ${formatPrice(symbol, price)}. No real trade was sent.`
        );

        return true;
    }


    function submitDemoOrder(direction, terminal = false) {

        const symbol = terminal
            ? state.selectedSymbol
            : ($("tradeSymbol")?.value || state.selectedSymbol);

        const volumeInput = terminal
            ? $("terminalVolume")
            : $("tradeVolume");

        const volume = getValidatedVolume(volumeInput);

        if (volume === null) {
            return;
        }

        selectSymbol(symbol);

        openDemoPosition(direction, symbol, volume);
    }


    if ($("buyButton")) {

        $("buyButton").addEventListener("click", () => {
            submitDemoOrder("BUY", false);
        });
    }


    if ($("sellButton")) {

        $("sellButton").addEventListener("click", () => {
            submitDemoOrder("SELL", false);
        });
    }


    if ($("terminalBuyButton")) {

        $("terminalBuyButton").addEventListener("click", () => {
            submitDemoOrder("BUY", true);
        });
    }


    if ($("terminalSellButton")) {

        $("terminalSellButton").addEventListener("click", () => {
            submitDemoOrder("SELL", true);
        });
    }


    if ($("tradeForm")) {

        $("tradeForm").addEventListener("submit", (event) => {
            event.preventDefault();
        });
    }


    if ($("openTerminalButton")) {

        $("openTerminalButton").addEventListener("click", () => {

            navigateTo("trade");

            window.setTimeout(() => {
                resizeTerminalChart();
            }, 80);
        });
    }


    /* =====================================================
       14. RENDER OPEN POSITIONS
       ===================================================== */

    function renderPositionRows(containerId) {

        const tbody = $(containerId);

        if (!tbody) {
            return;
        }

        if (state.positions.length === 0) {

            tbody.innerHTML = `
                <tr class="empty-table-row">
                    <td colspan="7">
                        <div class="empty-state">

                            <div class="empty-state-icon">▤</div>

                            <strong>No open positions</strong>

                            <p>
                                Create a demo order to test the interface.
                            </p>

                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = state.positions.map((position) => {

            const pl = getDemoPL(position);

            const plClass = pl > 0
                ? "positive"
                : pl < 0
                    ? "negative"
                    : "";

            const directionClass = position.direction === "BUY"
                ? "direction-buy"
                : "direction-sell";

            return `
                <tr>

                    <td class="table-instrument">
                        ${escapeHTML(position.symbol)}
                    </td>

                    <td>
                        <span class="direction-badge ${directionClass}">
                            ${escapeHTML(position.direction)}
                        </span>
                    </td>

                    <td>
                        ${position.volume.toFixed(2)}
                    </td>

                    <td>
                        ${formatPrice(position.symbol, position.entryPrice)}
                    </td>

                    <td>
                        ${formatPrice(position.symbol)}
                    </td>

                    <td class="${plClass}">
                        ${money(pl)}
                    </td>

                    <td>
                        <button
                            type="button"
                            class="table-action"
                            data-close-position="${position.id}">
                            Close demo
                        </button>
                    </td>

                </tr>
            `;

        }).join("");
    }


    function renderPositions() {
        renderPositionRows("positionsTableBody");
    }


    function renderAllPositions() {
        renderPositionRows("allPositionsTableBody");
    }


    /* =====================================================
       15. CLOSE DEMO POSITION
       ===================================================== */

    function closeDemoPosition(positionId) {

        const index = state.positions.findIndex((position) => {
            return position.id === positionId;
        });

        if (index === -1) {
            return;
        }

        const position = state.positions[index];

        const result = getDemoPL(position);

        /*
         * Demo accounting only.
         * No broker balance is changed.
         */

        state.balance = roundTo(
            state.balance + result,
            2
        );

        state.history.unshift({
            ...position,

            exitPrice: getPrice(position.symbol),
            result,

            closedAt: new Date()
        });

        state.positions.splice(index, 1);

        addActivity(
            `Closed ${position.symbol}`,
            `${position.direction} ${position.volume.toFixed(2)} lots · Demo position closed`,
            result
        );

        updateDashboard();

        renderHistory();
        renderReports();

        showToast(
            "Demo position closed",
            `Simulated result: ${money(result)}.`
        );
    }


    document.addEventListener("click", (event) => {

        const button = event.target.closest("[data-close-position]");

        if (!button) {
            return;
        }

        const id = Number(button.dataset.closePosition);

        if (Number.isFinite(id)) {
            closeDemoPosition(id);
        }
    });


    /* =====================================================
       16. CLOSE ALL DEMO POSITIONS
       ===================================================== */

    function closeAllDemoPositions() {

        if (state.positions.length === 0) {

            showToast(
                "No positions",
                "There are no demo positions to close.",
                "error"
            );

            return;
        }

        const closedPositions = [...state.positions];

        let totalResult = 0;

        closedPositions.forEach((position) => {

            const result = getDemoPL(position);

            totalResult += result;

            state.history.unshift({
                ...position,

                exitPrice: getPrice(position.symbol),
                result,

                closedAt: new Date()
            });
        });

        state.balance = roundTo(
            state.balance + totalResult,
            2
        );

        state.positions = [];

        addActivity(
            "Closed all demo positions",
            `${closedPositions.length} simulated positions closed`,
            totalResult
        );

        updateDashboard();

        renderHistory();
        renderReports();

        showToast(
            "Demo positions closed",
            `Combined simulated result: ${money(totalResult)}.`
        );
    }


    function askConfirmation(title, message, callback) {

        const dialog = $("confirmationDialog");

        if (!dialog || typeof dialog.showModal !== "function") {

            const confirmed = window.confirm(
                title + "\n\n" + message
            );

            if (confirmed) {
                callback();
            }

            return;
        }

        $("dialogTitle").textContent = title;
        $("dialogMessage").textContent = message;

        const confirmButton = $("dialogConfirm");
        const cancelButton = $("dialogCancel");

        const cleanup = () => {

            confirmButton.removeEventListener("click", confirmAction);
            cancelButton.removeEventListener("click", cancelAction);

            if (dialog.open) {
                dialog.close();
            }
        };

        const confirmAction = () => {
            cleanup();
            callback();
        };

        const cancelAction = () => {
            cleanup();
        };

        confirmButton.addEventListener("click", confirmAction);
        cancelButton.addEventListener("click", cancelAction);

        if (!dialog.open) {
            dialog.showModal();
        }
    }


    if ($("closeAllButton")) {

        $("closeAllButton").addEventListener("click", () => {

            askConfirmation(
                "Close all demo positions?",
                "This will close all simulated positions and record their demo results.",
                closeAllDemoPositions
            );
        });
    }


    if ($("positionsCloseAllButton")) {

        $("positionsCloseAllButton").addEventListener("click", () => {

            askConfirmation(
                "Close all demo positions?",
                "This will close all simulated positions and record their demo results.",
                closeAllDemoPositions
            );
        });
    }


    /* =====================================================
       17. TRADE HISTORY
       ===================================================== */

    function renderHistory() {

        const tbody = $("historyTableBody");

        if (!tbody) {
            return;
        }

        if (state.history.length === 0) {

            tbody.innerHTML = `
                <tr class="empty-table-row">
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">◷</div>
                            <strong>No completed demo trades</strong>
                            <p>
                                Closed demo positions will appear here.
                            </p>
                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        tbody.innerHTML = state.history.map((trade) => {

            const result = safeNumber(trade.result);

            const resultClass = result > 0
                ? "positive"
                : result < 0
                    ? "negative"
                    : "";

            const directionClass = trade.direction === "BUY"
                ? "direction-buy"
                : "direction-sell";

            return `
                <tr>

                    <td class="table-instrument">
                        ${escapeHTML(trade.symbol)}
                    </td>

                    <td>
                        <span class="direction-badge ${directionClass}">
                            ${escapeHTML(trade.direction)}
                        </span>
                    </td>

                    <td>
                        ${trade.volume.toFixed(2)}
                    </td>

                    <td>
                        ${formatPrice(trade.symbol, trade.entryPrice)}
                    </td>

                    <td>
                        ${formatPrice(trade.symbol, trade.exitPrice)}
                    </td>

                    <td class="${resultClass}">
                        ${money(result)}
                    </td>

                    <td>
                        ${escapeHTML(formatTime(trade.closedAt))}
                    </td>

                </tr>
            `;

        }).join("");
    }


    if ($("clearHistoryButton")) {

        $("clearHistoryButton").addEventListener("click", () => {

            if (state.history.length === 0) {

                showToast(
                    "History is empty",
                    "There is no demo history to clear."
                );

                return;
            }

            askConfirmation(
                "Clear demo history?",
                "This removes the simulated trade history from this session.",
                () => {

                    state.history = [];

                    renderHistory();
                    renderReports();

                    addActivity(
                        "Demo history cleared",
                        "Simulated trade history was cleared."
                    );

                    showToast(
                        "History cleared",
                        "Demo history has been removed."
                    );
                }
            );
        });
    }


    /* =====================================================
       18. MARKETS TABLE
       ===================================================== */

    function renderMarketsTable() {

        const tbody = $("marketsTableBody");

        if (!tbody) {
            return;
        }

        tbody.innerHTML = Object.keys(MARKET_CONFIG).map((symbol) => {

            const config = MARKET_CONFIG[symbol];

            return `
                <tr>

                    <td class="table-instrument">
                        ${escapeHTML(symbol)}
                    </td>

                    <td>
                        ${escapeHTML(config.name)}
                    </td>

                    <td>
                        ${formatPrice(symbol)}
                    </td>

                    <td>
                        <span class="direction-badge">
                            DEMO DATA
                        </span>
                    </td>

                    <td>
                        <button
                            type="button"
                            class="table-action"
                            data-open-market="${escapeHTML(symbol)}">
                            Open chart
                        </button>
                    </td>

                </tr>
            `;

        }).join("");
    }


    document.addEventListener("click", (event) => {

        const button = event.target.closest("[data-open-market]");

        if (!button) {
            return;
        }

        const symbol = button.dataset.openMarket;

        selectSymbol(symbol);

        navigateTo("dashboard");
    });


    /* =====================================================
       19. REPORTS
       ===================================================== */

    function renderReports() {

        const totalTrades = state.history.length;

        const wins = state.history.filter((trade) => {
            return trade.result > 0;
        }).length;

        const losses = state.history.filter((trade) => {
            return trade.result < 0;
        }).length;

        const realizedPL = roundTo(
            state.history.reduce((total, trade) => {
                return total + safeNumber(trade.result);
            }, 0),
            2
        );

        if ($("reportTotalTrades")) {
            $("reportTotalTrades").textContent = String(totalTrades);
        }

        if ($("reportWins")) {
            $("reportWins").textContent = String(wins);
        }

        if ($("reportLosses")) {
            $("reportLosses").textContent = String(losses);
        }

        if ($("reportProfit")) {

            $("reportProfit").textContent = money(realizedPL);

            $("reportProfit").classList.toggle(
                "positive",
                realizedPL > 0
            );

            $("reportProfit").classList.toggle(
                "negative",
                realizedPL < 0
            );
        }

        if ($("reportSummary")) {

            const winRate = totalTrades > 0
                ? (wins / totalTrades) * 100
                : 0;

            $("reportSummary").innerHTML = `
                <p>
                    <strong>Total completed demo trades:</strong>
                    ${totalTrades}
                </p>

                <p>
                    <strong>Winning demo trades:</strong>
                    ${wins}
                </p>

                <p>
                    <strong>Losing demo trades:</strong>
                    ${losses}
                </p>

                <p>
                    <strong>Illustrative win rate:</strong>
                    ${winRate.toFixed(1)}%
                </p>

                <p>
                    <strong>Realized simulated P/L:</strong>
                    ${money(realizedPL)}
                </p>

                <p>
                    These statistics describe this demo session only.
                    They are not evidence of live trading performance.
                </p>
            `;
        }
    }


    /* =====================================================
       20. REFRESH BUTTON
       ===================================================== */

    if ($("refreshButton")) {

        $("refreshButton").addEventListener("click", () => {

            const button = $("refreshButton");

            button.classList.add("refreshing");

            Object.keys(MARKET_CONFIG).forEach((symbol) => {
                generateDemoMarketMovement(symbol);
            });

            updateMarketWatch();
            updateSelectedInstrument();
            updateDashboard();

            refreshCharts();

            window.setTimeout(() => {

                button.classList.remove("refreshing");

                showToast(
                    "Demo workspace refreshed",
                    "Sample prices and dashboard values have been updated."
                );

            }, 250);
        });
    }


    /* =====================================================
       21. NOTICE DISMISS
       ===================================================== */

    if ($("closeNotice")) {

        $("closeNotice").addEventListener("click", () => {

            const notice = document.querySelector(".demo-notice");

            if (notice) {
                notice.remove();
            }
        });
    }


    /* =====================================================
       22. NOTIFICATIONS BUTTON
       ===================================================== */

    if ($("notificationButton")) {

        $("notificationButton").addEventListener("click", () => {

            showToast(
                "Naol Broker",
                "You are using the demo trading workspace."
            );
        });
    }


    /* =====================================================
       23. PROFILE BUTTON
       ===================================================== */

    if ($("profileButton")) {

        $("profileButton").addEventListener("click", () => {

            navigateTo("settings");

            showToast(
                "Demo profile",
                "Account settings are available in this workspace."
            );
        });
    }


    /* =====================================================
       24. THEME SETTINGS
       ===================================================== */

    function applyTheme(theme) {

        const light = theme === "light";

        document.body.classList.toggle("light-theme", light);

        if ($("themeSelect")) {
            $("themeSelect").value = light ? "light" : "dark";
        }

        try {
            localStorage.setItem("naol-broker-theme", theme);
        } catch (error) {
            console.warn("Theme preference could not be saved.");
        }

        /*
         * Recreate charts so their grid and text colors
         * match the selected theme.
         */

        refreshCharts();
    }


    let savedTheme = "dark";

    try {
        savedTheme = localStorage.getItem("naol-broker-theme") || "dark";
    } catch (error) {
        savedTheme = "dark";
    }

    applyTheme(savedTheme);


    if ($("themeSelect")) {

        $("themeSelect").addEventListener("change", (event) => {

            applyTheme(event.target.value);

            showToast(
                "Appearance updated",
                `Theme changed to ${event.target.value}.`
            );
        });
    }


    /* =====================================================
       25. NOTIFICATION SETTINGS
       ===================================================== */

    if ($("notificationsToggle")) {

        state.notificationsEnabled =
            $("notificationsToggle").checked;

        $("notificationsToggle").addEventListener("change", (event) => {

            state.notificationsEnabled = event.target.checked;

            if (state.notificationsEnabled) {

                showToast(
                    "Notifications enabled",
                    "Interface notifications are now enabled."
                );
            }
        });
    }


    /* =====================================================
       26. RESET DEMO ACCOUNT
       ===================================================== */

    function resetDemoAccount() {

        state.balance = INITIAL_BALANCE;

        state.positions = [];
        state.history = [];
        state.activities = [];

        state.nextPositionId = 1;

        state.demoPrices = {
            XAUUSD: 2650.00,
            BTCUSD: 95000.00,
            ETHUSD: 3500.00
        };

        state.previousPrices = {
            XAUUSD: 2650.00,
            BTCUSD: 95000.00,
            ETHUSD: 3500.00
        };

        state.demoChanges = {
            XAUUSD: 0,
            BTCUSD: 0,
            ETHUSD: 0
        };

        updateDashboard();

        renderHistory();
        renderActivities();
        renderReports();

        refreshCharts();

        showToast(
            "Demo account reset",
            "The simulated account has returned to its initial state."
        );
    }


    if ($("resetDemoButton")) {

        $("resetDemoButton").addEventListener("click", () => {

            askConfirmation(
                "Reset demo account?",
                "This will remove open demo positions and history and restore the sample balance to $10,000.",
                resetDemoAccount
            );
        });
    }


    /* =====================================================
       27. PERIODIC DEMO PRICE MOVEMENT

       These prices are generated locally.
       They are not fetched from a broker or exchange.
       ===================================================== */

    window.setInterval(() => {

        Object.keys(MARKET_CONFIG).forEach((symbol) => {
            generateDemoMarketMovement(symbol);
        });

        updateMarketWatch();
        updateSelectedInstrument();
        updateDashboard();

    }, 3000);


    /* =====================================================
       28. INITIALIZE APPLICATION
       ===================================================== */

    function initializeApplication() {

        updateMarketWatch();

        updateSelectedInstrument();

        updateDashboard();

        renderActivities();

        renderHistory();

        renderReports();

        renderMarketsTable();

        /*
         * Wait briefly for the external chart library.
         */

        let attempts = 0;

        const chartTimer = window.setInterval(() => {

            attempts++;

            if (getChartLibrary()) {

                window.clearInterval(chartTimer);

                renderChartForSelectedSymbol();

                renderTerminalChart();

                return;
            }

            if (attempts >= 20) {

                window.clearInterval(chartTimer);

                const placeholder = $("chartPlaceholder");

                if (placeholder) {

                    placeholder.innerHTML = `
                        <div class="chart-placeholder-icon">⌁</div>

                        <strong>Chart library unavailable</strong>

                        <p>
                            Check your internet connection and reload the page.
                        </p>
                    `;
                }
            }

        }, 250);
    }


    initializeApplication();


    /* =====================================================
       29. ERROR HANDLING
       ===================================================== */

    window.addEventListener("error", (event) => {

        console.error(
            "Naol Broker application error:",
            event.message
        );
    });


    console.info(
        "Naol Broker initialized. Demo mode only; no live broker connection."
    );

});
