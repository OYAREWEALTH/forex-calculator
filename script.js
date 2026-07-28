/* ============================================
   FOREX LOT SIZE CALCULATOR — ENGINE
   Supports: Forex, Commodities, Indices, Crypto
   Account currency: USD
   ============================================ */

// ========================================
// INSTRUMENT DATABASE
// ========================================
// Calculation formula (universal):
//   pip_value_quote = pipSize × contractSize   (value of 1 pip per lot in quote currency)
//   pip_value_usd   = pip_value_quote / conversionRate   (if conversionOp === 'divide')
//                   = pip_value_quote × conversionRate   (if conversionOp === 'multiply')
//   lot_size        = risk_amount / (sl_pips × pip_value_usd)
//
// For "Price Levels" mode:  sl_pips = |entryPrice − slPrice| / pipSize

const INSTRUMENTS = {
    // ── Forex Majors (quote = USD → no conversion) ──────────────
    'EURUSD': {
        label: 'EUR/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        decimals: 5
    },
    'GBPUSD': {
        label: 'GBP/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        decimals: 5
    },
    'AUDUSD': {
        label: 'AUD/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        decimals: 5
    },
    'NZDUSD': {
        label: 'NZD/USD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'USD',
        decimals: 5
    },

    // ── Forex Majors (self-converting: entry price IS the conversion rate) ──
    'USDJPY': {
        label: 'USD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        selfConvert: true, conversionOp: 'divide', decimals: 3
    },
    'USDCHF': {
        label: 'USD/CHF', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CHF',
        selfConvert: true, conversionOp: 'divide', decimals: 5
    },

    // ── Forex Crosses (JPY quote → need USD/JPY for conversion) ─
    'CHFJPY': {
        label: 'CHF/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'CADJPY': {
        label: 'CAD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'AUDJPY': {
        label: 'AUD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },

    // ── Forex Crosses (CAD quote → need USD/CAD for conversion) ─
    'GBPCAD': {
        label: 'GBP/CAD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CAD',
        conversionPair: 'USD/CAD', conversionOp: 'divide', decimals: 5
    },
    'EURCAD': {
        label: 'EUR/CAD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CAD',
        conversionPair: 'USD/CAD', conversionOp: 'divide', decimals: 5
    },

    // ── Commodities ─────────────────────────────────────────────
    'XAUUSD': {
        label: 'XAU/USD (Gold)', category: 'Commodities',
        pipSize: 0.01, contractSize: 100, quoteCcy: 'USD',
        unit: 'oz', decimals: 2
    },
    'XAGUSD': {
        label: 'XAG/USD (Silver)', category: 'Commodities',
        pipSize: 0.001, contractSize: 5_000, quoteCcy: 'USD',
        unit: 'oz', decimals: 3
    },

    // ── Indices ─────────────────────────────────────────────────
    // Contract sizes based on standard MT5 prop firm specs.
    // US indices: $1 per 1.0 index point per lot.
    'US30': {
        label: 'US30 (Dow Jones)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'USD',
        unit: 'contracts', pipLabel: 'points', decimals: 2
    },
    'US500': {
        label: 'US500 (S&P 500)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'USD',
        unit: 'contracts', pipLabel: 'points', decimals: 2
    },
    'US100': {
        label: 'US100 (Nasdaq 100)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'USD',
        unit: 'contracts', pipLabel: 'points', decimals: 2
    },
    'GER30': {
        label: 'GER30 (DAX)', category: 'Indices',
        pipSize: 1, contractSize: 1, quoteCcy: 'EUR',
        unit: 'contracts', pipLabel: 'points', decimals: 2,
        conversionPair: 'EUR/USD', conversionOp: 'multiply'
    },
    'JP225': {
        label: 'JP225 (Nikkei 225)', category: 'Indices',
        pipSize: 1, contractSize: 100, quoteCcy: 'JPY',
        unit: 'contracts', pipLabel: 'points', decimals: 0,
        conversionPair: 'USD/JPY', conversionOp: 'divide'
    },

    // ── Crypto ──────────────────────────────────────────────────
    'BTCUSD': {
        label: 'BTC/USD (Bitcoin)', category: 'Crypto',
        pipSize: 0.01, contractSize: 1, quoteCcy: 'USD',
        unit: 'BTC', decimals: 2
    },
    'ETHUSD': {
        label: 'ETH/USD (Ethereum)', category: 'Crypto',
        pipSize: 0.01, contractSize: 1, quoteCcy: 'USD',
        unit: 'ETH', decimals: 2
    },
};


// ========================================
// DOM REFERENCES
// ========================================
const $ = (id) => document.getElementById(id);

const DOM = {
    instrument:      $('instrument'),
    balance:         $('balance'),
    riskPercent:     $('riskPercent'),
    riskDollar:      $('riskDollar'),
    riskPercentBtn:  $('riskPercentBtn'),
    riskDollarBtn:   $('riskDollarBtn'),
    riskPercentGroup:$('riskPercentGroup'),
    riskDollarGroup: $('riskDollarGroup'),
    riskSlider:      $('riskSlider'),
    riskPreview:     $('riskPreview'),
    slPriceBtn:      $('slPriceBtn'),
    slPipsBtn:       $('slPipsBtn'),
    slPriceGroup:    $('slPriceGroup'),
    slPipsGroup:     $('slPipsGroup'),
    slSlider:        $('slSlider'),
    slPips:          $('slPips'),
    slPipsLabel:     $('slPipsLabel'),
    slPipsSuffix:    $('slPipsSuffix'),
    entryPrice:      $('entryPrice'),
    slPrice:         $('slPrice'),
    tpPrice:         $('tpPrice'),
    tpPips:          $('tpPips'),
    tpPipsSuffix:    $('tpPipsSuffix'),
    tradeDirection:  $('tradeDirection'),
    directionBadge:  $('directionBadge'),
    directionPips:   $('directionPips'),
    conversionGroup: $('conversionGroup'),
    conversionLabel: $('conversionLabel'),
    conversionRate:  $('conversionRate'),
    conversionHelper:$('conversionHelper'),
    lotDisplay:      $('lotDisplay'),
    lotSize:         $('lotSize'),
    copyBtn:         $('copyBtn'),
    copyTooltip:     $('copyTooltip'),
    riskAmountResult:$('riskAmountResult'),
    rewardResult:    $('rewardResult'),
    rrResult:        $('rrResult'),
    pipValueLabel:   $('pipValueLabel'),
    pipValueResult:  $('pipValueResult'),
    slResult:        $('slResult'),
    positionValue:   $('positionValue'),
    standardLots:    $('standardLots'),
    miniLots:        $('miniLots'),
    microLots:       $('microLots'),
    formulaText:     $('formulaText'),
    instrumentBadge: $('instrumentBadge'),
    badgeText:       $('badgeText'),
    infoInstrument:  $('infoInstrument'),
    infoCategory:    $('infoCategory'),
    infoPipLabel:    $('infoPipLabel'),
    infoPipSize:     $('infoPipSize'),
    infoContract:    $('infoContract'),
    infoQuote:       $('infoQuote'),
};


// ========================================
// APPLICATION STATE
// ========================================
let state = {
    riskMode: 'percent',   // 'percent' | 'dollar'
    slMode: 'price',       // 'price' | 'pips'
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
// INSTRUMENT INFO HELPERS
// ========================================
function getInstrument() {
    return INSTRUMENTS[DOM.instrument.value];
}

function getInstrumentKey() {
    return DOM.instrument.value;
}

function needsConversionField(inst) {
    // If quote currency is USD, no conversion needed
    if (inst.quoteCcy === 'USD') return false;
    // If self-converting AND in price mode, entry price IS the conversion rate
    if (inst.selfConvert && state.slMode === 'price') return false;
    // All other non-USD quote currencies need a conversion rate
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
        return `Enter the current ${inst.label} price to convert pip value to USD`;
    }
    return `Enter the current ${inst.conversionPair} rate to convert ${inst.quoteCcy} pip value to USD`;
}

function getPipLabel(inst) {
    return inst.pipLabel || 'pips';
}


// ========================================
// CALCULATION ENGINE
// ========================================
function calculate() {
    const inst = getInstrument();
    const key = getInstrumentKey();

    // 1. Get risk amount
    const balance = parseFloat(DOM.balance.value);
    let riskAmount;
    if (state.riskMode === 'percent') {
        const riskPct = parseFloat(DOM.riskPercent.value);
        riskAmount = (balance * riskPct) / 100;
    } else {
        riskAmount = parseFloat(DOM.riskDollar.value);
    }

    if (!riskAmount || riskAmount <= 0 || isNaN(riskAmount)) {
        clearResults();
        return;
    }

    // 2. Get SL in pips
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
        DOM.tradeDirection.classList.add('hidden');
    }

    if (!slPips || slPips <= 0 || isNaN(slPips)) {
        clearResults();
        return;
    }

    // 3. Get conversion rate
    let conversionRate = 1; // Default for USD quote
    let conversionRateVal = null;

    if (inst.quoteCcy !== 'USD') {
        if (inst.selfConvert && state.slMode === 'price' && entryPriceVal) {
            // Use entry price as conversion rate
            conversionRate = entryPriceVal;
            conversionRateVal = entryPriceVal;
        } else if (inst.selfConvert && state.slMode === 'pips') {
            // Need explicit conversion rate input
            conversionRate = parseFloat(DOM.conversionRate.value);
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

    // 5. Calculate lot size
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

    // 7. Calculate position value (approximate)
    let posValue = 0;
    if (state.slMode === 'price' && entryPriceVal) {
        if (inst.quoteCcy === 'USD') {
            posValue = lotSize * inst.contractSize * entryPriceVal;
        } else if (inst.conversionOp === 'divide') {
            posValue = (lotSize * inst.contractSize * entryPriceVal) / conversionRate;
        } else {
            posValue = lotSize * inst.contractSize * entryPriceVal * conversionRate;
        }
    }

    // 8. Update UI
    updateResults(lotSize, riskAmount, pipValueUSD, slPips, posValue, inst, conversionRateVal, rewardAmount, rrRatio, tpPips);
    updateFormula(lotSize, riskAmount, pipValueUSD, slPips, inst, conversionRateVal, rewardAmount, rrRatio, tpPips);
}


// ========================================
// UI UPDATE FUNCTIONS
// ========================================
function updateResults(lotSize, riskAmount, pipValueUSD, slPips, posValue, inst, conversionRate, rewardAmount, rrRatio, tpPips) {
    const pipLabel = getPipLabel(inst);
    const prevValue = DOM.lotSize.textContent;
    const newValue = lotSize.toFixed(2);

    DOM.lotSize.textContent = newValue;
    DOM.lotDisplay.classList.add('calculated');

    // Pop animation if value changed
    if (prevValue !== newValue) {
        DOM.lotSize.classList.remove('pop');
        void DOM.lotSize.offsetWidth; // Force reflow
        DOM.lotSize.classList.add('pop');
    }

    DOM.riskAmountResult.textContent = formatUSD(riskAmount);
    DOM.pipValueLabel.textContent = `${pipLabel.charAt(0).toUpperCase() + pipLabel.slice(1)} Value / Lot`;
    DOM.pipValueResult.textContent = formatUSD(pipValueUSD);
    DOM.slResult.textContent = `${formatNumber(slPips, slPips % 1 === 0 ? 0 : 1)} ${pipLabel}`;
    DOM.positionValue.textContent = posValue > 0 ? formatUSD(posValue) : '—';

    // Reward & R:R
    if (rewardAmount !== null && rrRatio !== null) {
        DOM.rewardResult.textContent = formatUSD(rewardAmount);
        DOM.rrResult.textContent = `1 : ${rrRatio.toFixed(2)}`;
    } else {
        DOM.rewardResult.textContent = '—';
        DOM.rrResult.textContent = '—';
    }

    // Lot breakdown
    const std = Math.floor(lotSize);
    const remainAfterStd = lotSize - std;
    const mini = Math.floor(remainAfterStd * 10);
    const remainAfterMini = remainAfterStd - (mini * 0.1);
    const micro = Math.round(remainAfterMini * 100);

    DOM.standardLots.textContent = std;
    DOM.miniLots.textContent = mini;
    DOM.microLots.textContent = micro;
}

function updateFormula(lotSize, riskAmount, pipValueUSD, slPips, inst, conversionRate, rewardAmount, rrRatio, tpPips) {
    const pipLabel = getPipLabel(inst);
    let lines = [];

    lines.push(`Lot Size = Risk ÷ (SL × Pip Value/Lot)`);
    lines.push(``);

    // Show pip value calculation
    const pipValueQuote = inst.pipSize * inst.contractSize;
    if (inst.quoteCcy === 'USD') {
        lines.push(`Pip Value = ${inst.pipSize} × ${formatContractSize(inst.contractSize)} = ${formatUSD(pipValueUSD)}`);
    } else {
        const ccySymbol = inst.quoteCcy;
        if (inst.conversionOp === 'divide') {
            lines.push(`Pip Value = (${inst.pipSize} × ${formatContractSize(inst.contractSize)}) ÷ ${conversionRate}`);
            lines.push(`         = ${ccySymbol} ${formatNumber(pipValueQuote, 2)} ÷ ${conversionRate}`);
        } else {
            lines.push(`Pip Value = (${inst.pipSize} × ${formatContractSize(inst.contractSize)}) × ${conversionRate}`);
            lines.push(`         = ${ccySymbol} ${formatNumber(pipValueQuote, 2)} × ${conversionRate}`);
        }
        lines.push(`         = ${formatUSD(pipValueUSD)} per ${pipLabel === 'points' ? 'point' : 'pip'}`);
    }

    lines.push(``);
    lines.push(`Lot Size = ${formatUSD(riskAmount)} ÷ (${formatNumber(slPips, slPips % 1 === 0 ? 0 : 1)} × ${formatUSD(pipValueUSD)})`);
    lines.push(`         = ${formatUSD(riskAmount)} ÷ ${formatUSD(slPips * pipValueUSD)}`);
    lines.push(`         = ${lotSize.toFixed(2)} lots`);

    // Reward section
    if (rewardAmount !== null && rrRatio !== null) {
        lines.push(``);
        lines.push(`── Expected Reward ──`);
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
    DOM.standardLots.textContent = '0';
    DOM.miniLots.textContent = '0';
    DOM.microLots.textContent = '0';
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
        // SL below entry = BUY
        DOM.tradeDirection.classList.remove('sell');
        DOM.directionBadge.textContent = 'BUY ↑';
        DOM.directionBadge.style.background = '';
    } else {
        // SL above entry = SELL
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

        // Set placeholder based on pair
        if (inst.conversionPair === 'USD/JPY' || inst.selfConvert && inst.quoteCcy === 'JPY') {
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

    DOM.infoInstrument.textContent = inst.label;
    DOM.infoCategory.textContent = inst.category;
    DOM.infoPipLabel.textContent = pipLabel === 'points' ? 'Point Size' : 'Pip Size';
    DOM.infoPipSize.textContent = inst.pipSize;
    DOM.infoContract.textContent = formatContractSize(inst.contractSize) + (inst.unit ? ` ${inst.unit}` : '');
    DOM.infoQuote.textContent = inst.quoteCcy;
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

    // Set sensible placeholders based on instrument
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
}


// ========================================
// EVENT HANDLERS
// ========================================

// Instrument change
DOM.instrument.addEventListener('change', () => {
    updateConversionField();
    updateInfoBar();
    updateInstrumentBadge();
    updatePipLabels();
    updatePlaceholders();
    DOM.tradeDirection.classList.add('hidden');
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
    DOM.slPips, DOM.tpPips,
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

// Copy lot size to clipboard
DOM.copyBtn.addEventListener('click', () => {
    const value = DOM.lotSize.textContent;
    if (value === '—') return;

    navigator.clipboard.writeText(value).then(() => {
        DOM.copyTooltip.classList.add('show');
        setTimeout(() => DOM.copyTooltip.classList.remove('show'), 1500);
    }).catch(() => {
        // Fallback: select text
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
    // Set default SL mode to "Price Levels" (first button active)
    state.slMode = 'price';
    DOM.slPriceBtn.classList.add('active');
    DOM.slPipsBtn.classList.remove('active');
    DOM.slPriceGroup.classList.remove('hidden');
    DOM.slPipsGroup.classList.add('hidden');
    DOM.slSlider.classList.remove('right');

    // Set default risk mode
    state.riskMode = 'percent';
    DOM.riskPercentBtn.classList.add('active');
    DOM.riskSlider.classList.remove('right');

    // Initialize UI
    updateConversionField();
    updateInfoBar();
    updateInstrumentBadge();
    updatePipLabels();
    updatePlaceholders();
    updateRiskPreview();
    clearResults();
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);
