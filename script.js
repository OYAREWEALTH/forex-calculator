/* ============================================
   FOREX LOT SIZE CALCULATOR — ENGINE
   Supports: Forex, Commodities, Indices, Crypto
   Account currency: USD
   Includes: Prop Firm Margin & MT5 Execution Checker
   ============================================ */

// ========================================
// INSTRUMENT DATABASE
// ========================================
const INSTRUMENTS = {
    // ── Forex Majors (quote = USD → no conversion) ──────────────
    'EURUSD': {
        label: 'EUR/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        baseCcy: 'EUR', defaultLeverage: 100, decimals: 5
    },
    'GBPUSD': {
        label: 'GBP/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        baseCcy: 'GBP', defaultLeverage: 100, decimals: 5
    },
    'AUDUSD': {
        label: 'AUD/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        baseCcy: 'AUD', defaultLeverage: 100, decimals: 5
    },
    'NZDUSD': {
        label: 'NZD/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        baseCcy: 'NZD', defaultLeverage: 100, decimals: 5
    },

    // ── Forex Majors (self-converting: entry price IS the conversion rate) ──
    'USDJPY': {
        label: 'USD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'USD', defaultLeverage: 100,
        selfConvert: true, conversionOp: 'divide', decimals: 3
    },
    'USDCHF': {
        label: 'USD/CHF', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CHF',
        baseCcy: 'USD', defaultLeverage: 100,
        selfConvert: true, conversionOp: 'divide', decimals: 5
    },

    // ── Forex Crosses (JPY quote → need USD/JPY for conversion) ─
    'CHFJPY': {
        label: 'CHF/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'CHF', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'CADJPY': {
        label: 'CAD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'CAD', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'AUDJPY': {
        label: 'AUD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'AUD', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },

    // ── Forex Crosses (CAD quote → need USD/CAD for conversion) ─
    'GBPCAD': {
        label: 'GBP/CAD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CAD',
        baseCcy: 'GBP', defaultLeverage: 100,
        conversionPair: 'USD/CAD', conversionOp: 'divide', decimals: 5
    },
    'EURCAD': {
        label: 'EUR/CAD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CAD',
        baseCcy: 'EUR', defaultLeverage: 100,
        conversionPair: 'USD/CAD', conversionOp: 'divide', decimals: 5
    },

    // ── Commodities ─────────────────────────────────────────────
    'XAUUSD': {
        label: 'XAU/USD (Gold)', category: 'Commodities',
        pipSize: 0.01, contractSize: 100, quoteCcy: 'USD',
        unit: 'oz', defaultLeverage: 30, decimals: 2
    },
    'XAGUSD': {
        label: 'XAG/USD (Silver)', category: 'Commodities',
        pipSize: 0.001, contractSize: 5_000, quoteCcy: 'USD',
        unit: 'oz', defaultLeverage: 30, decimals: 3
    },

    // ── Indices ─────────────────────────────────────────────────
    'US30': {
        label: 'US30 (Dow Jones)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'USD',
        unit: 'contracts', pipLabel: 'points', defaultLeverage: 20, decimals: 2
    },
    'US500': {
        label: 'US500 (S&P 500)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'USD',
        unit: 'contracts', pipLabel: 'points', defaultLeverage: 20, decimals: 2
    },
    'US100': {
        label: 'US100 (Nasdaq 100)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'USD',
        unit: 'contracts', pipLabel: 'points', defaultLeverage: 20, decimals: 2
    },
    'GER30': {
        label: 'GER30 (DAX)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'EUR',
        unit: 'contracts', pipLabel: 'points', defaultLeverage: 20, decimals: 2,
        conversionPair: 'EUR/USD', conversionOp: 'multiply'
    },
    'JP225': {
        label: 'JP225 (Nikkei 225)', category: 'Indices',
        pipSize: 1, contractSize: 100, quoteCcy: 'JPY',
        unit: 'contracts', pipLabel: 'points', defaultLeverage: 20, decimals: 0,
        conversionPair: 'USD/JPY', conversionOp: 'divide'
    },

    // ── Crypto ──────────────────────────────────────────────────
    'BTCUSD': {
        label: 'BTC/USD (Bitcoin)', category: 'Crypto',
        pipSize: 0.01, contractSize: 1, quoteCcy: 'USD',
        unit: 'BTC', defaultLeverage: 2, decimals: 2
    },
    'ETHUSD': {
        label: 'ETH/USD (Ethereum)', category: 'Crypto',
        pipSize: 0.01, contractSize: 1, quoteCcy: 'USD',
        unit: 'ETH', defaultLeverage: 2, decimals: 2
    },
};

// ========================================
// DOM REFERENCES
// ========================================
const $ = (id) => document.getElementById(id);

const DOM = {
    instrument:          $('instrument'),
    balance:             $('balance'),
    leverage:            $('leverage'),
    customLeverage:      $('customLeverage'),
    customLeverageGroup: $('customLeverageGroup'),
    leverageAutoBadge:   $('leverageAutoBadge'),
    riskPercent:         $('riskPercent'),
    riskDollar:          $('riskDollar'),
    riskPercentBtn:      $('riskPercentBtn'),
    riskDollarBtn:       $('riskDollarBtn'),
    riskPercentGroup:    $('riskPercentGroup'),
    riskDollarGroup:     $('riskDollarGroup'),
    riskSlider:          $('riskSlider'),
    riskPreview:         $('riskPreview'),
    slPriceBtn:          $('slPriceBtn'),
    slPipsBtn:           $('slPipsBtn'),
    slPriceGroup:        $('slPriceGroup'),
    slPipsGroup:         $('slPipsGroup'),
    slSlider:            $('slSlider'),
    slPips:              $('slPips'),
    tpPips:              $('tpPips'),
    slPipsLabel:         $('slPipsLabel'),
    slPipsSuffix:        $('slPipsSuffix'),
    tpPipsSuffix:        $('tpPipsSuffix'),
    entryPrice:          $('entryPrice'),
    slPrice:             $('slPrice'),
    tpPrice:             $('tpPrice'),
    pipsModePrice:       $('pipsModePrice'),
    tradeDirection:      $('tradeDirection'),
    directionBadge:      $('directionBadge'),
    directionPips:       $('directionPips'),
    conversionGroup:     $('conversionGroup'),
    conversionLabel:     $('conversionLabel'),
    conversionRate:      $('conversionRate'),
    conversionHelper:    $('conversionHelper'),
    executionCard:       $('executionCard'),
    executionIconWrapper:$('executionIconWrapper'),
    executionIcon:       $('executionIcon'),
    executionTag:        $('executionTag'),
    executionTitle:      $('executionTitle'),
    executionDesc:       $('executionDesc'),
    marginProgressBar:   $('marginProgressBar'),
    marginBarLeft:       $('marginBarLeft'),
    marginBarRight:      $('marginBarRight'),
    executionAction:     $('executionAction'),
    btnFixMargin:        $('btnFixMargin'),
    btnFixRiskText:      $('btnFixRiskText'),
    lotDisplay:          $('lotDisplay'),
    lotSize:             $('lotSize'),
    copyBtn:             $('copyBtn'),
    copyTooltip:         $('copyTooltip'),
    riskAmountResult:    $('riskAmountResult'),
    rewardResult:        $('rewardResult'),
    rrResult:            $('rrResult'),
    pipValueLabel:       $('pipValueLabel'),
    pipValueResult:      $('pipValueResult'),
    slResult:            $('slResult'),
    positionValue:       $('positionValue'),
    marginResult:        $('marginResult'),
    marginUsageResult:   $('marginUsageResult'),
    maxSafeLotsResult:   $('maxSafeLotsResult'),
    standardLots:        $('standardLots'),
    miniLots:            $('miniLots'),
    microLots:           $('microLots'),
    formulaText:         $('formulaText'),
    instrumentBadge:     $('instrumentBadge'),
    badgeText:           $('badgeText'),
    infoInstrument:      $('infoInstrument'),
    infoCategory:        $('infoCategory'),
    infoPipLabel:        $('infoPipLabel'),
    infoPipSize:         $('infoPipSize'),
    infoContract:        $('infoContract'),
    infoQuote:           $('infoQuote'),
    infoLeverage:        $('infoLeverage'),
};

// ========================================
// APPLICATION STATE
// ========================================
let state = {
    riskMode: 'percent',   // 'percent' | 'dollar'
    slMode: 'price',       // 'price' | 'pips'
    maxSafeRiskPct: null,
    maxSafeRiskUSD: null,
    maxSafeLots: null
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
function formatUSD(value) {
    if (isNaN(value) || !isFinite(value)) return '$0.00';
    return '$' + value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatNumber(value, decimals = 2) {
    if (isNaN(value) || !isFinite(value)) return '0';
    return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatContractSize(size) {
    if (size >= 1000) return (size / 1000).toLocaleString('en-US') + ',000';
    return size.toLocaleString('en-US');
}

// ========================================
// INSTRUMENT & LEVERAGE HELPERS
// ========================================
function getInstrument() {
    return INSTRUMENTS[DOM.instrument.value];
}

function getInstrumentKey() {
    return DOM.instrument.value;
}

function getActiveLeverage() {
    const val = DOM.leverage.value;
    if (val === 'custom') {
        const customVal = parseFloat(DOM.customLeverage.value);
        return (customVal && customVal > 0) ? customVal : 100;
    }
    return parseFloat(val) || 100;
}

function needsConversionField(inst) {
    if (inst.quoteCcy === 'USD') return false;
    if (inst.selfConvert && state.slMode === 'price') return false;
    return true;
}

function getConversionLabel(inst) {
    if (inst.selfConvert) {
        return `Current ${inst.label} Price`;
    }
    return `${inst.conversionPair} Rate`;
}

function getConversionHelper(inst) {
    if (inst.selfConvert) {
        return `Enter current ${inst.label} price to convert pip value to USD`;
    }
    return `Enter current ${inst.conversionPair} rate to convert ${inst.quoteCcy} to USD`;
}

function getPipLabel(inst) {
    return inst.pipLabel || 'pips';
}

// Calculate Position Notional Value in USD for 1 lot
function getNotionalValuePerLotUSD(inst, priceVal, conversionRate) {
    const price = (priceVal && priceVal > 0) ? priceVal : 1;

    if (inst.category === 'Forex') {
        if (inst.baseCcy === 'USD') {
            // USD base (USDJPY, USDCHF): 1 lot = 100,000 USD
            return inst.contractSize;
        } else if (inst.quoteCcy === 'USD') {
            // EURUSD, GBPUSD, AUDUSD, NZDUSD: 1 lot = 100,000 Base * Price USD
            return inst.contractSize * price;
        } else {
            // Cross pairs: (CHFJPY, CADJPY, AUDJPY, GBPCAD, EURCAD)
            if (inst.conversionPair === 'USD/JPY') {
                const usdjpy = (conversionRate && conversionRate > 0) ? conversionRate : 160;
                return (inst.contractSize * price) / usdjpy;
            } else if (inst.conversionPair === 'USD/CAD') {
                const usdcad = (conversionRate && conversionRate > 0) ? conversionRate : 1.38;
                return (inst.contractSize * price) / usdcad;
            }
            return inst.contractSize * price;
        }
    } else if (inst.category === 'Commodities') {
        // Gold / Silver: contractSize * price USD
        return inst.contractSize * price;
    } else if (inst.category === 'Indices') {
        if (inst.quoteCcy === 'USD') {
            return inst.contractSize * price;
        } else if (inst.quoteCcy === 'EUR') {
            const eurusd = (conversionRate && conversionRate > 0) ? conversionRate : 1.137;
            return inst.contractSize * price * eurusd;
        } else if (inst.quoteCcy === 'JPY') {
            const usdjpy = (conversionRate && conversionRate > 0) ? conversionRate : 160;
            return (inst.contractSize * price) / usdjpy;
        }
        return inst.contractSize * price;
    } else if (inst.category === 'Crypto') {
        // BTC, ETH: 1 unit * price USD
        return inst.contractSize * price;
    }

    return inst.contractSize * price;
}

// ========================================
// CALCULATION ENGINE
// ========================================
function calculate() {
    const inst = getInstrument();
    const balance = parseFloat(DOM.balance.value);

    // 1. Get risk amount
    let riskAmount;
    if (state.riskMode === 'percent') {
        const riskPct = parseFloat(DOM.riskPercent.value);
        riskAmount = (balance * riskPct) / 100;
    } else {
        riskAmount = parseFloat(DOM.riskDollar.value);
    }

    if (!riskAmount || riskAmount <= 0 || isNaN(riskAmount) || !balance || balance <= 0 || isNaN(balance)) {
        clearResults();
        return;
    }

    // 2. Get SL in pips & determine entry price
    let slPips;
    let entryPriceVal = null;

    if (state.slMode === 'price') {
        entryPriceVal = parseFloat(DOM.entryPrice.value);
        const slPriceVal = parseFloat(DOM.slPrice.value);
        if (!entryPriceVal || !slPriceVal || entryPriceVal === slPriceVal) {
            clearResults();
            updateTradeDirection(entryPriceVal, slPriceVal, inst);
            return;
        }
        const priceDist = Math.abs(entryPriceVal - slPriceVal);
        slPips = priceDist / inst.pipSize;
        updateTradeDirection(entryPriceVal, slPriceVal, inst);
    } else {
        slPips = parseFloat(DOM.slPips.value);
        // In pips mode, get estimated price from input or placeholder
        const pipsPriceInput = parseFloat(DOM.pipsModePrice.value);
        const phPrice = parseFloat(DOM.pipsModePrice.placeholder) || parseFloat(DOM.entryPrice.placeholder) || 1;
        entryPriceVal = (pipsPriceInput && pipsPriceInput > 0) ? pipsPriceInput : phPrice;
        DOM.tradeDirection.classList.add('hidden');
    }

    if (!slPips || slPips <= 0 || isNaN(slPips)) {
        clearResults();
        return;
    }

    // 3. Get conversion rate
    let conversionRate = 1;
    let conversionRateVal = null;

    if (inst.quoteCcy !== 'USD') {
        if (inst.selfConvert && state.slMode === 'price' && entryPriceVal) {
            conversionRate = entryPriceVal;
            conversionRateVal = entryPriceVal;
        } else if (inst.selfConvert && state.slMode === 'pips') {
            conversionRate = parseFloat(DOM.conversionRate.value) || entryPriceVal || 1;
            conversionRateVal = conversionRate;
        } else if (inst.conversionPair) {
            conversionRate = parseFloat(DOM.conversionRate.value);
            conversionRateVal = conversionRate;
        }

        if (!conversionRate || conversionRate <= 0 || isNaN(conversionRate)) {
            clearResults();
            return;
        }
    }

    // 4. Calculate pip value per lot in USD
    const pipValueQuote = inst.pipSize * inst.contractSize;
    let pipValueUSD;

    if (inst.quoteCcy === 'USD') {
        pipValueUSD = pipValueQuote;
    } else if (inst.conversionOp === 'divide') {
        pipValueUSD = pipValueQuote / conversionRate;
    } else if (inst.conversionOp === 'multiply') {
        pipValueUSD = pipValueQuote * conversionRate;
    }

    // 5. Calculate Desired Lot Size
    const riskPerLot = slPips * pipValueUSD;
    const lotSize = riskAmount / riskPerLot;

    // 6. Calculate Take Profit / Expected Reward
    let tpPips = null;
    let rewardAmount = null;
    let rrRatio = null;

    if (state.slMode === 'price') {
        const tpPriceVal = parseFloat(DOM.tpPrice.value);
        if (tpPriceVal && entryPriceVal && tpPriceVal !== entryPriceVal) {
            const tpDist = Math.abs(tpPriceVal - entryPriceVal);
            tpPips = tpDist / inst.pipSize;
            rewardAmount = tpPips * pipValueUSD * lotSize;
            rrRatio = tpPips / slPips;
        }
    } else {
        const tpPipsVal = parseFloat(DOM.tpPips.value);
        if (tpPipsVal && tpPipsVal > 0) {
            tpPips = tpPipsVal;
            rewardAmount = tpPips * pipValueUSD * lotSize;
            rrRatio = tpPips / slPips;
        }
    }

    // 7. Calculate Position Value & Required Margin (MT5 Check)
    const leverage = getActiveLeverage();
    const notionalPerLotUSD = getNotionalValuePerLotUSD(inst, entryPriceVal, conversionRate);
    const totalPositionValueUSD = lotSize * notionalPerLotUSD;
    const requiredMargin = totalPositionValueUSD / leverage;
    const marginUsagePct = (requiredMargin / balance) * 100;
    const freeMarginAfterTrade = balance - requiredMargin;

    // 8. Calculate Maximum Executable Lot & Risk based on Margin
    const marginPerLot = notionalPerLotUSD / leverage;
    const maxSafeLots = marginPerLot > 0 ? (balance / marginPerLot) : 0;
    const maxSafeRiskUSD = maxSafeLots * slPips * pipValueUSD;
    const maxSafeRiskPct = (maxSafeRiskUSD / balance) * 100;

    state.maxSafeRiskPct = maxSafeRiskPct;
    state.maxSafeRiskUSD = maxSafeRiskUSD;
    state.maxSafeLots = maxSafeLots;

    // 9. Update UI & Execution Status
    updateResults({
        lotSize, riskAmount, pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, freeMarginAfterTrade,
        maxSafeLots, maxSafeRiskPct, maxSafeRiskUSD,
        rewardAmount, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance
    });

    updateFormula({
        lotSize, riskAmount, pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, maxSafeLots, maxSafeRiskPct,
        rewardAmount, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance
    });
}

// ========================================
// UI UPDATE FUNCTIONS
// ========================================
function updateResults(data) {
    const {
        lotSize, riskAmount, pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, freeMarginAfterTrade,
        maxSafeLots, maxSafeRiskPct, maxSafeRiskUSD,
        rewardAmount, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance
    } = data;

    const pipLabel = getPipLabel(inst);
    const prevValue = DOM.lotSize.textContent;
    const newValue = lotSize.toFixed(2);

    DOM.lotSize.textContent = newValue;
    DOM.lotDisplay.classList.add('calculated');

    // Pop animation on change
    if (prevValue !== newValue) {
        DOM.lotSize.classList.remove('pop');
        void DOM.lotSize.offsetWidth;
        DOM.lotSize.classList.add('pop');
    }

    DOM.riskAmountResult.textContent = formatUSD(riskAmount);
    DOM.pipValueLabel.textContent = `${pipLabel.charAt(0).toUpperCase() + pipLabel.slice(1)} Value / Lot`;
    DOM.pipValueResult.textContent = formatUSD(pipValueUSD);
    DOM.slResult.textContent = `${formatNumber(slPips, slPips % 1 === 0 ? 0 : 1)} ${pipLabel}`;
    DOM.positionValue.textContent = totalPositionValueUSD > 0 ? formatUSD(totalPositionValueUSD) : '—';

    // Reward & R:R
    if (rewardAmount !== null && rrRatio !== null) {
        DOM.rewardResult.textContent = formatUSD(rewardAmount);
        DOM.rrResult.textContent = `1 : ${rrRatio.toFixed(2)}`;
    } else {
        DOM.rewardResult.textContent = '—';
        DOM.rrResult.textContent = '—';
    }

    // Margin Metrics in Grid
    DOM.marginResult.textContent = formatUSD(requiredMargin);
    DOM.marginUsageResult.textContent = `${marginUsagePct.toFixed(1)}%`;
    DOM.maxSafeLotsResult.textContent = `${maxSafeLots.toFixed(2)} lots`;

    // Margin metric text colors
    if (requiredMargin > balance) {
        DOM.marginResult.className = 'result-value margin-danger';
        DOM.marginUsageResult.className = 'result-value margin-danger';
    } else if (marginUsagePct >= 70) {
        DOM.marginResult.className = 'result-value margin-warning';
        DOM.marginUsageResult.className = 'result-value margin-warning';
    } else {
        DOM.marginResult.className = 'result-value margin-safe';
        DOM.marginUsageResult.className = 'result-value margin-safe';
    }

    // Execution Status Banner Logic
    updateExecutionBanner({
        requiredMargin, balance, marginUsagePct,
        freeMarginAfterTrade, maxSafeLots, maxSafeRiskPct,
        maxSafeRiskUSD, leverage, lotSize
    });

    // Lot Breakdown
    const std = Math.floor(lotSize);
    const remainAfterStd = lotSize - std;
    const mini = Math.floor(remainAfterStd * 10);
    const remainAfterMini = remainAfterStd - (mini * 0.1);
    const micro = Math.round(remainAfterMini * 100);

    DOM.standardLots.textContent = std;
    DOM.miniLots.textContent = mini;
    DOM.microLots.textContent = mini < 0 ? 0 : micro;
}

function updateExecutionBanner(data) {
    const {
        requiredMargin, balance, marginUsagePct,
        freeMarginAfterTrade, maxSafeLots, maxSafeRiskPct,
        maxSafeRiskUSD, leverage, lotSize
    } = data;

    const card = DOM.executionCard;
    const clampedProgress = Math.min(Math.max(marginUsagePct, 0), 100);
    DOM.marginProgressBar.style.width = `${clampedProgress}%`;
    DOM.marginBarLeft.textContent = `Req. Margin: ${formatUSD(requiredMargin)}`;
    DOM.marginBarRight.textContent = `Usage: ${marginUsagePct.toFixed(1)}% of $${formatNumber(balance, 2)}`;

    card.classList.remove('status-safe', 'status-warning', 'status-rejected');

    if (requiredMargin > balance) {
        // 🔴 REJECTED: Not Enough Money in MT5
        card.classList.add('status-rejected');
        DOM.executionIcon.textContent = '❌';
        DOM.executionTag.textContent = 'MT5 WILL REJECT TRADE';
        DOM.executionTitle.textContent = 'Insufficient Margin ("No Money")';
        DOM.executionDesc.textContent = `Trade requires ${formatUSD(requiredMargin)} in margin at 1:${leverage} leverage, but your free balance is only ${formatUSD(balance)} (${marginUsagePct.toFixed(0)}% margin usage).`;

        // Show 1-Click Fix Button
        DOM.executionAction.classList.remove('hidden');
        if (state.riskMode === 'percent') {
            DOM.btnFixRiskText.textContent = `${maxSafeRiskPct.toFixed(2)}% risk (${maxSafeLots.toFixed(2)} lots)`;
        } else {
            DOM.btnFixRiskText.textContent = `${formatUSD(maxSafeRiskUSD)} risk (${maxSafeLots.toFixed(2)} lots)`;
        }
    } else if (marginUsagePct >= 70) {
        // 🟡 WARNING: High Margin Usage (70%-100%)
        card.classList.add('status-warning');
        DOM.executionIcon.textContent = '⚠️';
        DOM.executionTag.textContent = 'HIGH MARGIN USAGE';
        DOM.executionTitle.textContent = 'Order Will Execute, Low Free Margin';
        DOM.executionDesc.textContent = `Required margin is ${formatUSD(requiredMargin)} (${marginUsagePct.toFixed(1)}% of account). Free margin remaining: ${formatUSD(freeMarginAfterTrade)}.`;
        DOM.executionAction.classList.add('hidden');
    } else {
        // 🟢 SAFE: Order Will Execute Cleanly
        card.classList.add('status-safe');
        DOM.executionIcon.textContent = '✅';
        DOM.executionTag.textContent = 'ORDER WILL EXECUTE';
        DOM.executionTitle.textContent = 'Sufficient Margin Available';
        DOM.executionDesc.textContent = `Required margin is ${formatUSD(requiredMargin)} (${marginUsagePct.toFixed(1)}% of balance). Free margin remaining: ${formatUSD(freeMarginAfterTrade)}.`;
        DOM.executionAction.classList.add('hidden');
    }
}

function updateFormula(data) {
    const {
        lotSize, riskAmount, pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, maxSafeLots, maxSafeRiskPct,
        rewardAmount, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance
    } = data;

    const pipLabel = getPipLabel(inst);
    let lines = [];

    lines.push(`── 1. LOT SIZE SIZING ──`);
    lines.push(`Lot Size = Risk ÷ (SL × Pip Value/Lot)`);
    lines.push(``);

    // Show pip value calculation
    const pipValueQuote = inst.pipSize * inst.contractSize;
    if (inst.quoteCcy === 'USD') {
        lines.push(`Pip Value = ${inst.pipSize} × ${formatContractSize(inst.contractSize)} = ${formatUSD(pipValueUSD)}`);
    } else {
        const ccySymbol = inst.quoteCcy;
        if (inst.conversionOp === 'divide') {
            lines.push(`Pip Value = (${inst.pipSize} × ${formatContractSize(inst.contractSize)}) ÷ ${conversionRateVal}`);
            lines.push(`         = ${ccySymbol} ${formatNumber(pipValueQuote, 2)} ÷ ${conversionRateVal}`);
        } else {
            lines.push(`Pip Value = (${inst.pipSize} × ${formatContractSize(inst.contractSize)}) × ${conversionRateVal}`);
            lines.push(`         = ${ccySymbol} ${formatNumber(pipValueQuote, 2)} × ${conversionRateVal}`);
        }
        lines.push(`         = ${formatUSD(pipValueUSD)} per ${pipLabel === 'points' ? 'point' : 'pip'}`);
    }

    lines.push(``);
    lines.push(`Lot Size = ${formatUSD(riskAmount)} ÷ (${formatNumber(slPips, slPips % 1 === 0 ? 0 : 1)} × ${formatUSD(pipValueUSD)})`);
    lines.push(`         = ${formatUSD(riskAmount)} ÷ ${formatUSD(slPips * pipValueUSD)}`);
    lines.push(`         = ${lotSize.toFixed(2)} lots`);

    // Margin & Execution Check Breakdown
    lines.push(``);
    lines.push(`── 2. MT5 MARGIN & EXECUTION CHECK ──`);
    lines.push(`Notional Value  = ${lotSize.toFixed(2)} lots × Contract Specs = ${formatUSD(totalPositionValueUSD)}`);
    lines.push(`Required Margin = ${formatUSD(totalPositionValueUSD)} ÷ ${leverage} (leverage) = ${formatUSD(requiredMargin)}`);
    lines.push(`Account Balance = ${formatUSD(balance)}`);
    lines.push(`Margin Usage    = (${formatUSD(requiredMargin)} ÷ ${formatUSD(balance)}) × 100 = ${marginUsagePct.toFixed(1)}%`);

    if (requiredMargin > balance) {
        lines.push(`Status          = ❌ REJECTED ("No Money")`);
        lines.push(`Max Safe Lots   = (${formatUSD(balance)} × ${leverage}) ÷ Notional/Lot = ${maxSafeLots.toFixed(2)} lots`);
        lines.push(`Max Safe Risk % = ${maxSafeRiskPct.toFixed(2)}%`);
    } else {
        lines.push(`Status          = ✅ EXECUTABLE (Free Margin: ${formatUSD(balance - requiredMargin)})`);
    }

    // Expected Reward Breakdown
    if (rewardAmount !== null && rrRatio !== null) {
        lines.push(``);
        lines.push(`── 3. EXPECTED REWARD ──`);
        lines.push(`TP Distance  = ${formatNumber(tpPips, tpPips % 1 === 0 ? 0 : 1)} ${pipLabel}`);
        lines.push(`Reward       = ${formatNumber(tpPips, tpPips % 1 === 0 ? 0 : 1)} × ${formatUSD(pipValueUSD)} × ${lotSize.toFixed(2)}`);
        lines.push(`             = ${formatUSD(rewardAmount)}`);
        lines.push(`Risk:Reward  = 1 : ${rrRatio.toFixed(2)}`);
    }

    DOM.formulaText.textContent = lines.join('\n');
}

function clearResults() {
    DOM.lotSize.textContent = '—';
    DOM.lotDisplay.classList.remove('calculated');
    DOM.riskAmountResult.textContent = '$0.00';
    DOM.rewardResult.textContent = '—';
    DOM.rrResult.textContent = '—';
    DOM.pipValueResult.textContent = '$0.00';
    DOM.slResult.textContent = '—';
    DOM.positionValue.textContent = '—';
    DOM.marginResult.textContent = '$0.00';
    DOM.marginUsageResult.textContent = '0%';
    DOM.maxSafeLotsResult.textContent = '—';
    DOM.standardLots.textContent = '0';
    DOM.miniLots.textContent = '0';
    DOM.microLots.textContent = '0';

    DOM.executionCard.className = 'execution-card status-safe';
    DOM.executionIcon.textContent = '⏳';
    DOM.executionTag.textContent = 'READY TO CALCULATE';
    DOM.executionTitle.textContent = 'Enter Trade Parameters';
    DOM.executionDesc.textContent = 'Fill in balance, risk, and price levels to check lot size and margin execution.';
    DOM.marginProgressBar.style.width = '0%';
    DOM.marginBarLeft.textContent = 'Req. Margin: $0.00';
    DOM.marginBarRight.textContent = 'Usage: 0%';
    DOM.executionAction.classList.add('hidden');

    DOM.formulaText.textContent = 'Enter your trade details to see the calculation.';
}

function updateTradeDirection(entry, sl, inst) {
    if (!entry || !sl || entry === sl || isNaN(entry) || isNaN(sl)) {
        DOM.tradeDirection.classList.add('hidden');
        return;
    }

    DOM.tradeDirection.classList.remove('hidden');
    const pipLabel = getPipLabel(inst);
    const pips = Math.abs(entry - sl) / inst.pipSize;

    if (sl < entry) {
        DOM.tradeDirection.classList.remove('sell');
        DOM.directionBadge.textContent = 'BUY ↑';
        DOM.directionBadge.style.background = '';
    } else {
        DOM.tradeDirection.classList.add('sell');
        DOM.directionBadge.textContent = 'SELL ↓';
    }

    DOM.directionPips.textContent = `${formatNumber(pips, pips % 1 === 0 ? 0 : 1)} ${pipLabel}`;
}

function updateRiskPreview() {
    const balance = parseFloat(DOM.balance.value) || 0;
    const pct = parseFloat(DOM.riskPercent.value) || 0;
    const risk = (balance * pct) / 100;
    DOM.riskPreview.textContent = formatUSD(risk);
}

function updateConversionField() {
    const inst = getInstrument();
    const needs = needsConversionField(inst);

    if (needs) {
        DOM.conversionGroup.classList.remove('hidden');
        DOM.conversionLabel.textContent = getConversionLabel(inst);
        DOM.conversionHelper.textContent = getConversionHelper(inst);

        if (inst.conversionPair === 'USD/JPY' || (inst.selfConvert && inst.quoteCcy === 'JPY')) {
            DOM.conversionRate.placeholder = '163.73';
        } else if (inst.conversionPair === 'USD/CAD') {
            DOM.conversionRate.placeholder = '1.3800';
        } else if (inst.conversionPair === 'EUR/USD') {
            DOM.conversionRate.placeholder = '1.1371';
        } else if (inst.selfConvert && inst.quoteCcy === 'CHF') {
            DOM.conversionRate.placeholder = '0.8192';
        } else {
            DOM.conversionRate.placeholder = '1.0000';
        }
    } else {
        DOM.conversionGroup.classList.add('hidden');
    }
}

function updateInfoBar() {
    const inst = getInstrument();
    const pipLabel = getPipLabel(inst);
    const leverage = getActiveLeverage();

    DOM.infoInstrument.textContent = inst.label;
    DOM.infoCategory.textContent = inst.category;
    DOM.infoPipLabel.textContent = pipLabel === 'points' ? 'Point Size' : 'Pip Size';
    DOM.infoPipSize.textContent = inst.pipSize;
    DOM.infoContract.textContent = formatContractSize(inst.contractSize) + (inst.unit ? ` ${inst.unit}` : '');
    DOM.infoQuote.textContent = inst.quoteCcy;
    DOM.infoLeverage.textContent = `1:${leverage}`;
}

function updateInstrumentBadge() {
    const inst = getInstrument();
    DOM.instrumentBadge.setAttribute('data-category', inst.category);
    DOM.badgeText.textContent = inst.category;
}

function updatePipLabels() {
    const inst = getInstrument();
    const pipLabel = getPipLabel(inst);

    DOM.slPipsLabel.textContent = pipLabel.charAt(0).toUpperCase() + pipLabel.slice(1);
    DOM.slPipsSuffix.textContent = pipLabel;
    DOM.tpPipsSuffix.textContent = `${pipLabel} TP`;
}

function updatePlaceholders() {
    const inst = getInstrument();
    const key = getInstrumentKey();

    const placeholders = {
        'EURUSD':  { entry: '1.13710', sl: '1.13210', tp: '1.14210', pips: '50', tpPips: '50' },
        'GBPUSD':  { entry: '1.32990', sl: '1.32490', tp: '1.33490', pips: '50', tpPips: '50' },
        'USDJPY':  { entry: '163.730', sl: '163.230', tp: '164.230', pips: '50', tpPips: '50' },
        'USDCHF':  { entry: '0.81920', sl: '0.82420', tp: '0.81420', pips: '50', tpPips: '50' },
        'AUDUSD':  { entry: '0.69720', sl: '0.69220', tp: '0.70220', pips: '50', tpPips: '50' },
        'NZDUSD':  { entry: '0.57710', sl: '0.57210', tp: '0.58210', pips: '50', tpPips: '50' },
        'CHFJPY':  { entry: '199.850', sl: '199.350', tp: '200.350', pips: '50', tpPips: '50' },
        'CADJPY':  { entry: '115.980', sl: '115.480', tp: '116.480', pips: '50', tpPips: '50' },
        'AUDJPY':  { entry: '114.150', sl: '113.650', tp: '114.650', pips: '50', tpPips: '50' },
        'GBPCAD':  { entry: '1.87740', sl: '1.87240', tp: '1.88240', pips: '50', tpPips: '50' },
        'EURCAD':  { entry: '1.60520', sl: '1.60020', tp: '1.61020', pips: '50', tpPips: '50' },
        'XAUUSD':  { entry: '4049.88', sl: '4039.88', tp: '4069.88', pips: '1000', tpPips: '2000' },
        'XAGUSD':  { entry: '57.370', sl: '57.270', tp: '57.570', pips: '100', tpPips: '200' },
        'US30':    { entry: '52287.00', sl: '52187.00', tp: '52487.00', pips: '100', tpPips: '200' },
        'US500':   { entry: '7402.80', sl: '7392.80', tp: '7422.80', pips: '10', tpPips: '20' },
        'US100':   { entry: '27822.20', sl: '27722.20', tp: '28022.20', pips: '100', tpPips: '200' },
        'GER30':   { entry: '25476.78', sl: '25426.78', tp: '25576.78', pips: '50', tpPips: '100' },
        'JP225':   { entry: '62501', sl: '62401', tp: '62701', pips: '100', tpPips: '200' },
        'BTCUSD':  { entry: '63488.42', sl: '63388.42', tp: '63688.42', pips: '10000', tpPips: '20000' },
        'ETHUSD':  { entry: '1884.52', sl: '1874.52', tp: '1904.52', pips: '1000', tpPips: '2000' },
    };

    const ph = placeholders[key] || { entry: '1.00000', sl: '0.99500', tp: '1.00500', pips: '50', tpPips: '50' };
    DOM.entryPrice.placeholder = ph.entry;
    DOM.slPrice.placeholder = ph.sl;
    DOM.tpPrice.placeholder = ph.tp;
    DOM.slPips.placeholder = ph.pips;
    DOM.tpPips.placeholder = ph.tpPips;
    DOM.pipsModePrice.placeholder = ph.entry;
}

function updateLeverageForInstrument() {
    const inst = getInstrument();
    const defaultLev = inst.defaultLeverage || 100;

    // Check if the default leverage exists in the dropdown options
    let found = false;
    for (let opt of DOM.leverage.options) {
        if (opt.value === String(defaultLev)) {
            DOM.leverage.value = String(defaultLev);
            found = true;
            break;
        }
    }

    if (!found) {
        DOM.leverage.value = 'custom';
        DOM.customLeverageGroup.classList.remove('hidden');
        DOM.customLeverage.value = defaultLev;
    } else {
        DOM.customLeverageGroup.classList.add('hidden');
    }

    DOM.leverageAutoBadge.textContent = `Auto: 1:${defaultLev}`;
}

// ========================================
// EVENT HANDLERS
// ========================================

// Instrument change
DOM.instrument.addEventListener('change', () => {
    updateLeverageForInstrument();
    updateConversionField();
    updateInfoBar();
    updateInstrumentBadge();
    updatePipLabels();
    updatePlaceholders();
    DOM.tradeDirection.classList.add('hidden');
    calculate();
});

// Leverage change
DOM.leverage.addEventListener('change', () => {
    if (DOM.leverage.value === 'custom') {
        DOM.customLeverageGroup.classList.remove('hidden');
    } else {
        DOM.customLeverageGroup.classList.add('hidden');
    }
    updateInfoBar();
    calculate();
});

DOM.customLeverage.addEventListener('input', () => {
    updateInfoBar();
    calculate();
});

// Risk mode toggle
DOM.riskPercentBtn.addEventListener('click', () => {
    state.riskMode = 'percent';
    DOM.riskPercentBtn.classList.add('active');
    DOM.riskDollarBtn.classList.remove('active');
    DOM.riskPercentGroup.classList.remove('hidden');
    DOM.riskDollarGroup.classList.add('hidden');
    DOM.riskSlider.classList.remove('right');
    updateRiskPreview();
    calculate();
});

DOM.riskDollarBtn.addEventListener('click', () => {
    state.riskMode = 'dollar';
    DOM.riskDollarBtn.classList.add('active');
    DOM.riskPercentBtn.classList.remove('active');
    DOM.riskDollarGroup.classList.remove('hidden');
    DOM.riskPercentGroup.classList.add('hidden');
    DOM.riskSlider.classList.add('right');
    calculate();
});

// SL mode toggle
DOM.slPriceBtn.addEventListener('click', () => {
    state.slMode = 'price';
    DOM.slPriceBtn.classList.add('active');
    DOM.slPipsBtn.classList.remove('active');
    DOM.slPriceGroup.classList.remove('hidden');
    DOM.slPipsGroup.classList.add('hidden');
    DOM.slSlider.classList.remove('right');
    updateConversionField();
    calculate();
});

DOM.slPipsBtn.addEventListener('click', () => {
    state.slMode = 'pips';
    DOM.slPipsBtn.classList.add('active');
    DOM.slPriceBtn.classList.remove('active');
    DOM.slPipsGroup.classList.remove('hidden');
    DOM.slPriceGroup.classList.add('hidden');
    DOM.slSlider.classList.add('right');
    DOM.tradeDirection.classList.add('hidden');
    updateConversionField();
    calculate();
});

// Real-time calculation on any input change
const calcInputs = [
    DOM.balance, DOM.riskPercent, DOM.riskDollar,
    DOM.entryPrice, DOM.slPrice, DOM.tpPrice,
    DOM.slPips, DOM.tpPips, DOM.pipsModePrice,
    DOM.conversionRate
];

calcInputs.forEach(input => {
    input.addEventListener('input', () => {
        if (input === DOM.balance || input === DOM.riskPercent) {
            updateRiskPreview();
        }
        calculate();
    });
});

// ⚡ Auto-Fix Button (Adjust Risk to Max Safe Executable)
DOM.btnFixMargin.addEventListener('click', () => {
    if (state.maxSafeRiskPct === null || state.maxSafeRiskPct <= 0) return;

    if (state.riskMode === 'percent') {
        // Floor to 2 decimal places to guarantee execution
        const safePct = Math.floor(state.maxSafeRiskPct * 100) / 100;
        DOM.riskPercent.value = safePct > 0 ? safePct : 0.1;
        updateRiskPreview();
    } else {
        const safeUSD = Math.floor(state.maxSafeRiskUSD * 100) / 100;
        DOM.riskDollar.value = safeUSD > 0 ? safeUSD : 10;
    }

    calculate();
});

// Copy lot size to clipboard
DOM.copyBtn.addEventListener('click', () => {
    const value = DOM.lotSize.textContent;
    if (value === '—') return;

    navigator.clipboard.writeText(value).then(() => {
        DOM.copyTooltip.classList.add('show');
        setTimeout(() => DOM.copyTooltip.classList.remove('show'), 1500);
    }).catch(() => {
        const range = document.createRange();
        range.selectNodeContents(DOM.lotSize);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    });
});

// ========================================
// INITIALIZATION
// ========================================
function init() {
    state.slMode = 'price';
    DOM.slPriceBtn.classList.add('active');
    DOM.slPipsBtn.classList.remove('active');
    DOM.slPriceGroup.classList.remove('hidden');
    DOM.slPipsGroup.classList.add('hidden');
    DOM.slSlider.classList.remove('right');

    state.riskMode = 'percent';
    DOM.riskPercentBtn.classList.add('active');
    DOM.riskSlider.classList.remove('right');

    updateLeverageForInstrument();
    updateConversionField();
    updateInfoBar();
    updateInstrumentBadge();
    updatePipLabels();
    updatePlaceholders();
    updateRiskPreview();
    clearResults();
}

document.addEventListener('DOMContentLoaded', init);
