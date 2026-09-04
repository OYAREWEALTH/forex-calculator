/* ============================================
   FOREX LOT SIZE CALCULATOR — ENGINE
   Supports: Forex, Commodities, Indices, Crypto
   Account currency: USD
   Includes: Prop Firm Margin & MT5 Execution Checker
   Spec: Maven OMO Challenge MT5 Compliant (US30 = 5 contracts / $5 per point)
   ============================================ */

// ========================================
// ========================================
// DEFAULT CONVERSION RATES (Maven Market Baseline)
// ========================================

const DEFAULT_COSTS = {
    // Forex Majors (Maven typical raw spread 0.8-1.2 pips, $6/lot round-trip)
    'EURUSD':  { spread: 0.8, comm: 6.0 },
    'GBPUSD':  { spread: 1.0, comm: 6.0 },
    'AUDUSD':  { spread: 1.0, comm: 6.0 },
    'NZDUSD':  { spread: 1.2, comm: 6.0 },
    'USDCAD':  { spread: 1.2, comm: 6.0 },
    'USDCHF':  { spread: 1.2, comm: 6.0 },
    'USDJPY':  { spread: 1.0, comm: 6.0 },

    // Forex Crosses (Maven typical raw spread 1.5-2.0 pips, $6/lot round-trip)
    'AUDCAD':  { spread: 1.5, comm: 6.0 },
    'AUDCHF':  { spread: 1.5, comm: 6.0 },
    'AUDJPY':  { spread: 1.5, comm: 6.0 },
    'AUDNZD':  { spread: 1.8, comm: 6.0 },
    'CADCHF':  { spread: 1.8, comm: 6.0 },
    'CADJPY':  { spread: 1.5, comm: 6.0 },
    'EURAUD':  { spread: 1.8, comm: 6.0 },
    'EURCAD':  { spread: 1.8, comm: 6.0 },
    'EURCHF':  { spread: 1.5, comm: 6.0 },
    'EURGBP':  { spread: 1.2, comm: 6.0 },
    'EURJPY':  { spread: 1.5, comm: 6.0 },
    'GBPJPY':  { spread: 2.0, comm: 6.0 },
    'NZDJPY':  { spread: 1.8, comm: 6.0 },

    // Indices (Maven: $0 Commission Free, tight points spread)
    'US30':    { spread: 2.0, comm: 0.0 },
    'US100':   { spread: 1.5, comm: 0.0 },
    'US500':   { spread: 0.5, comm: 0.0 },
    'US2000':  { spread: 0.5, comm: 0.0 },
    'GER30':   { spread: 1.5, comm: 0.0 },
    'UK100':   { spread: 1.5, comm: 0.0 },
    'JAP225':  { spread: 8.0, comm: 0.0 },

    // Commodities (Maven: Gold 100oz, $6 comm)
    'XAUUSD':  { spread: 2.5, comm: 6.0 },
    'XAGUSD':  { spread: 2.5, comm: 6.0 },

    // Crypto (Maven: $0 Commission Free)
    'BTCUSD':  { spread: 25.0, comm: 0.0 },
    'ETHUSD':  { spread: 2.0,  comm: 0.0 },
};

const DEFAULT_CONVERSION_RATES = {
    'USD/JPY': 156.74,
    'USD/CHF': 0.8091,
    'USD/CAD': 1.3823,
    'EUR/USD': 1.1605,
    'GBP/USD': 1.3495,
    'AUD/USD': 0.7172,
    'NZD/USD': 0.5863,
};

// ========================================
// INSTRUMENT DATABASE (Maven MT5 Specifications)
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

    // ── Forex Majors (USD base → entry price self-converts or uses rate) ──
    'USDCAD': {
        label: 'USD/CAD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CAD',
        baseCcy: 'USD', defaultLeverage: 100,
        selfConvert: true, conversionOp: 'divide', decimals: 5
    },
    'USDCHF': {
        label: 'USD/CHF', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CHF',
        baseCcy: 'USD', defaultLeverage: 100,
        selfConvert: true, conversionOp: 'divide', decimals: 5
    },
    'USDJPY': {
        label: 'USD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'USD', defaultLeverage: 100,
        selfConvert: true, conversionOp: 'divide', decimals: 3
    },

    // ── Forex Crosses (JPY Quote → divide by USD/JPY) ────────────
    'AUDJPY': {
        label: 'AUD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'AUD', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'CADJPY': {
        label: 'CAD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'CAD', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'EURJPY': {
        label: 'EUR/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'EUR', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'GBPJPY': {
        label: 'GBP/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'GBP', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },
    'NZDJPY': {
        label: 'NZD/JPY', category: 'Forex',
        pipSize: 0.01, contractSize: 100_000, quoteCcy: 'JPY',
        baseCcy: 'NZD', defaultLeverage: 100,
        conversionPair: 'USD/JPY', conversionOp: 'divide', decimals: 3
    },

    // ── Forex Crosses (CHF Quote → divide by USD/CHF) ────────────
    'AUDCHF': {
        label: 'AUD/CHF', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CHF',
        baseCcy: 'AUD', defaultLeverage: 100,
        conversionPair: 'USD/CHF', conversionOp: 'divide', decimals: 5
    },
    'CADCHF': {
        label: 'CAD/CHF', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CHF',
        baseCcy: 'CAD', defaultLeverage: 100,
        conversionPair: 'USD/CHF', conversionOp: 'divide', decimals: 5
    },
    'EURCHF': {
        label: 'EUR/CHF', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CHF',
        baseCcy: 'EUR', defaultLeverage: 100,
        conversionPair: 'USD/CHF', conversionOp: 'divide', decimals: 5
    },

    // ── Forex Crosses (CAD Quote → divide by USD/CAD) ────────────
    'AUDCAD': {
        label: 'AUD/CAD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CAD',
        baseCcy: 'AUD', defaultLeverage: 100,
        conversionPair: 'USD/CAD', conversionOp: 'divide', decimals: 5
    },
    'EURCAD': {
        label: 'EUR/CAD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'CAD',
        baseCcy: 'EUR', defaultLeverage: 100,
        conversionPair: 'USD/CAD', conversionOp: 'divide', decimals: 5
    },

    // ── Forex Crosses (AUD, NZD, GBP Quote → multiply by quote/USD) ──
    'AUDNZD': {
        label: 'AUD/NZD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'NZD',
        baseCcy: 'AUD', defaultLeverage: 100,
        conversionPair: 'NZD/USD', conversionOp: 'multiply', decimals: 5
    },
    'EURAUD': {
        label: 'EUR/AUD', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'AUD',
        baseCcy: 'EUR', defaultLeverage: 100,
        conversionPair: 'AUD/USD', conversionOp: 'multiply', decimals: 5
    },
    'EURGBP': {
        label: 'EUR/GBP', category: 'Forex',
        pipSize: 0.0001, contractSize: 100_000, quoteCcy: 'GBP',
        baseCcy: 'EUR', defaultLeverage: 100,
        conversionPair: 'GBP/USD', conversionOp: 'multiply', decimals: 5
    },

    // ── Indices (Verified Maven MT5 Specifications) ─────────────
    'US30': {
        label: 'US30 (Dow Jones)', category: 'Indices',
        pipSize: 1, contractSize: 5, quoteCcy: 'USD',
        unit: 'contracts ($5/pt)', pipLabel: 'points', defaultLeverage: 20, decimals: 0
    },
    'US100': {
        label: 'US100 (Nasdaq 100)', category: 'Indices',
        pipSize: 1, contractSize: 20, quoteCcy: 'USD',
        unit: 'contracts ($20/pt)', pipLabel: 'points', defaultLeverage: 20, decimals: 2
    },
    'US500': {
        label: 'US500 (S&P 500)', category: 'Indices',
        pipSize: 1, contractSize: 50, quoteCcy: 'USD',
        unit: 'contracts ($50/pt)', pipLabel: 'points', defaultLeverage: 20, decimals: 1
    },
    'US2000': {
        label: 'US2000 (Russell 2000)', category: 'Indices',
        pipSize: 1, contractSize: 200, quoteCcy: 'USD',
        unit: 'contracts ($200/pt)', pipLabel: 'points', defaultLeverage: 20, decimals: 1
    },
    'GER30': {
        label: 'GER30 (DAX 40)', category: 'Indices',
        pipSize: 1, contractSize: 25, quoteCcy: 'EUR',
        unit: 'contracts (€25/pt)', pipLabel: 'points', defaultLeverage: 20, decimals: 1,
        conversionPair: 'EUR/USD', conversionOp: 'multiply'
    },
    'UK100': {
        label: 'UK100 (FTSE 100)', category: 'Indices',
        pipSize: 1, contractSize: 10, quoteCcy: 'GBP',
        unit: 'contracts (£10/pt)', pipLabel: 'points', defaultLeverage: 20, decimals: 1,
        conversionPair: 'GBP/USD', conversionOp: 'multiply'
    },
    'JAP225': {
        label: 'JAP225 (Nikkei 225)', category: 'Indices',
        pipSize: 1, contractSize: 10, quoteCcy: 'JPY',
        unit: 'contracts (¥10/pt)', pipLabel: 'points', defaultLeverage: 20, decimals: 0,
        conversionPair: 'USD/JPY', conversionOp: 'divide'
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

    // ── Crypto (1:2 Leverage on Maven MT5) ──────────────────────
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
    instrument:            $('instrument'),
    contractSize:          $('contractSize'),
    contractAutoBadge:     $('contractAutoBadge'),
    contractSuffix:        $('contractSuffix'),
    contractHelper:        $('contractHelper'),
    balance:               $('balance'),
    leverage:              $('leverage'),
    customLeverage:        $('customLeverage'),
    customLeverageGroup:   $('customLeverageGroup'),
    leverageAutoBadge:     $('leverageAutoBadge'),
    riskPercent:           $('riskPercent'),
    riskDollar:            $('riskDollar'),
    riskPercentBtn:        $('riskPercentBtn'),
    riskDollarBtn:         $('riskDollarBtn'),
    riskPercentGroup:      $('riskPercentGroup'),
    riskDollarGroup:       $('riskDollarGroup'),
    riskSlider:            $('riskSlider'),
    riskPreview:           $('riskPreview'),
    sizingConservativeBtn: $('sizingConservativeBtn'),
    sizingRoundedBtn:      $('sizingRoundedBtn'),
    sizingSlider:          $('sizingSlider'),
    sizingBadge:           $('sizingBadge'),
    sizingHelper:          $('sizingHelper'),
    slPriceBtn:            $('slPriceBtn'),
    slPipsBtn:             $('slPipsBtn'),
    slPriceGroup:          $('slPriceGroup'),
    slPipsGroup:           $('slPipsGroup'),
    slSlider:              $('slSlider'),
    slPips:                $('slPips'),
    tpPips:                $('tpPips'),
    slPipsLabel:           $('slPipsLabel'),
    slPipsSuffix:          $('slPipsSuffix'),
    tpPipsSuffix:          $('tpPipsSuffix'),
    entryPrice:            $('entryPrice'),
    slPrice:               $('slPrice'),
    tpPrice:               $('tpPrice'),
    pipsModePrice:         $('pipsModePrice'),
    tradeDirection:        $('tradeDirection'),
    directionBadge:        $('directionBadge'),
    directionPips:         $('directionPips'),
    conversionGroup:       $('conversionGroup'),
    conversionLabel:       $('conversionLabel'),
    conversionRate:        $('conversionRate'),
    conversionHelper:      $('conversionHelper'),
    executionCard:         $('executionCard'),
    executionIconWrapper:  $('executionIconWrapper'),
    executionIcon:         $('executionIcon'),
    executionTag:          $('executionTag'),
    executionTitle:        $('executionTitle'),
    executionDesc:         $('executionDesc'),
    marginProgressBar:     $('marginProgressBar'),
    marginBarLeft:         $('marginBarLeft'),
    marginBarRight:        $('marginBarRight'),
    executionAction:       $('executionAction'),
    btnFixMargin:          $('btnFixMargin'),
    btnFixRiskText:        $('btnFixRiskText'),
    lotDisplay:            $('lotDisplay'),
    lotSize:               $('lotSize'),
    lotUnitLabel:          $('lotUnitLabel'),
    copyBtn:               $('copyBtn'),
    copyTooltip:           $('copyTooltip'),
    sizingComparisonCard:  $('sizingComparisonCard'),
    comparisonTargetBadge: $('comparisonTargetBadge'),
    rowConservative:       $('rowConservative'),
    rowRounded:            $('rowRounded'),
    rowExact:              $('rowExact'),
    compLotsFloor:         $('compLotsFloor'),
    compRiskFloor:         $('compRiskFloor'),
    compRewardFloor:       $('compRewardFloor'),
    compLotsRound:         $('compLotsRound'),
    compRiskRound:         $('compRiskRound'),
    compRewardRound:       $('compRewardRound'),
    compLotsExact:         $('compLotsExact'),
    compRiskExact:         $('compRiskExact'),
    compRewardExact:       $('compRewardExact'),
    riskAmountResult:      $('riskAmountResult'),
    rewardResult:          $('rewardResult'),
    rrResult:              $('rrResult'),
    pipValueLabel:         $('pipValueLabel'),
    pipValueResult:        $('pipValueResult'),
    slResult:              $('slResult'),
    positionValue:         $('positionValue'),
    marginResult:          $('marginResult'),
    marginUsageResult:     $('marginUsageResult'),
    maxSafeLotsResult:     $('maxSafeLotsResult'),
    standardLots:          $('standardLots'),
    miniLots:              $('miniLots'),
    microLots:             $('microLots'),
    formulaText:           $('formulaText'),
    instrumentBadge:       $('instrumentBadge'),
    badgeText:             $('badgeText'),
    infoInstrument:        $('infoInstrument'),
    infoCategory:          $('infoCategory'),
    infoPipLabel:          $('infoPipLabel'),
    infoPipSize:           $('infoPipSize'),
    infoContract:          $('infoContract'),
    infoQuote:             $('infoQuote'),
    infoLeverage:          $('infoLeverage'),
};

// ========================================
// APPLICATION STATE
// ========================================
let state = {
    riskMode: 'percent',        // 'percent' | 'dollar'
    slMode: 'price',            // 'price' | 'pips'
    sizingMode: 'conservative', // 'conservative' (floor) | 'rounded' (nearest)
    maxSafeRiskPct: null,
    maxSafeRiskUSD: null,
    maxSafeLots: null,
    floorLots: null,
    roundLots: null,
    exactLots: null
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

function getActiveContractSize() {
    const val = parseFloat(DOM.contractSize.value);
    if (val && val > 0 && !isNaN(val)) return val;
    const inst = getInstrument();
    return inst.contractSize;
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

// Calculate Position Notional Value in USD for 1 lot using active contract size
function getNotionalValuePerLotUSD(inst, priceVal, conversionRate, contractSize) {
    const price = (priceVal && priceVal > 0) ? priceVal : 1;
    const cSize = (contractSize && contractSize > 0) ? contractSize : inst.contractSize;

    if (inst.category === 'Forex') {
        if (inst.baseCcy === 'USD') {
            return cSize;
        } else if (inst.quoteCcy === 'USD') {
            return cSize * price;
        } else {
            // Forex crosses: Margin is based on base currency converted to USD
            if (inst.baseCcy === 'EUR') {
                const eurusd = DEFAULT_CONVERSION_RATES['EUR/USD'] || 1.1605;
                return cSize * eurusd;
            } else if (inst.baseCcy === 'GBP') {
                const gbpusd = DEFAULT_CONVERSION_RATES['GBP/USD'] || 1.3495;
                return cSize * gbpusd;
            } else if (inst.baseCcy === 'AUD') {
                const audusd = DEFAULT_CONVERSION_RATES['AUD/USD'] || 0.7172;
                return cSize * audusd;
            } else if (inst.baseCcy === 'NZD') {
                const nzdusd = DEFAULT_CONVERSION_RATES['NZD/USD'] || 0.5863;
                return cSize * nzdusd;
            } else if (inst.baseCcy === 'CAD') {
                const usdcad = DEFAULT_CONVERSION_RATES['USD/CAD'] || 1.3823;
                return cSize / usdcad;
            }
            return cSize * price;
        }
    } else if (inst.category === 'Commodities') {
        return cSize * price;
    } else if (inst.category === 'Indices') {
        if (inst.quoteCcy === 'USD') {
            return cSize * price;
        } else if (inst.quoteCcy === 'EUR') {
            const eurusd = (conversionRate && conversionRate > 0) ? conversionRate : (DEFAULT_CONVERSION_RATES['EUR/USD'] || 1.1605);
            return cSize * price * eurusd;
        } else if (inst.quoteCcy === 'GBP') {
            const gbpusd = (conversionRate && conversionRate > 0) ? conversionRate : (DEFAULT_CONVERSION_RATES['GBP/USD'] || 1.3495);
            return cSize * price * gbpusd;
        } else if (inst.quoteCcy === 'JPY') {
            const usdjpy = (conversionRate && conversionRate > 0) ? conversionRate : (DEFAULT_CONVERSION_RATES['USD/JPY'] || 156.74);
            return (cSize * price) / usdjpy;
        }
        return cSize * price;
    } else if (inst.category === 'Crypto') {
        return cSize * price;
    }

    return cSize * price;
}

// ========================================
// CALCULATION ENGINE
// ========================================
function calculate() {
    const inst = getInstrument();
    const balance = parseFloat(DOM.balance.value);
    const contractSize = getActiveContractSize();

    // 1. Get target risk amount
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
        const defaultRate = DEFAULT_CONVERSION_RATES[inst.conversionPair] || 1.0;

        if (inst.selfConvert && state.slMode === 'price' && entryPriceVal) {
            conversionRate = entryPriceVal;
            conversionRateVal = entryPriceVal;
        } else if (inst.selfConvert && state.slMode === 'pips') {
            conversionRate = parseFloat(DOM.conversionRate.value) || parseFloat(DOM.conversionRate.placeholder) || entryPriceVal || defaultRate;
            conversionRateVal = conversionRate;
        } else if (inst.conversionPair) {
            conversionRate = parseFloat(DOM.conversionRate.value) || parseFloat(DOM.conversionRate.placeholder) || defaultRate;
            conversionRateVal = conversionRate;
        }

        if (!conversionRate || conversionRate <= 0 || isNaN(conversionRate)) {
            clearResults();
            return;
        }
    }

    // 4. Calculate pip value per lot in USD using active contract size
    const pipValueQuote = inst.pipSize * contractSize;
    let pipValueUSD;

    if (inst.quoteCcy === 'USD') {
        pipValueUSD = pipValueQuote;
    } else if (inst.conversionOp === 'divide') {
        pipValueUSD = pipValueQuote / conversionRate;
    } else if (inst.conversionOp === 'multiply') {
        pipValueUSD = pipValueQuote * conversionRate;
    }

    // 5. Phantom Costs
    const spreadPips = parseFloat(document.getElementById('spreadPips').value) || 0;
    const commissionLot = parseFloat(document.getElementById('commissionLot').value) || 0;

    // 6. Calculate Exact Theoretical Lot Size (Phantom Adjusted)
    const adjustedSlPips = slPips + spreadPips;
    const riskPerLot = (adjustedSlPips * pipValueUSD) + commissionLot;
    const exactLotSize = riskAmount / riskPerLot;

    // 7. Volume Step 0.01 Calculations (Conservative Floor vs Nearest Round)
    const step = 0.01;
    let floorLotSize = Math.floor(exactLotSize / step) * step;
    floorLotSize = Math.round(floorLotSize * 100) / 100;
    if (floorLotSize <= 0 && exactLotSize > 0) {
        floorLotSize = step; // Min MT5 volume
    }

    let roundLotSize = Math.round(exactLotSize / step) * step;
    roundLotSize = Math.round(roundLotSize * 100) / 100;
    if (roundLotSize <= 0 && exactLotSize > 0) {
        roundLotSize = step;
    }

    state.floorLots = floorLotSize;
    state.roundLots = roundLotSize;
    state.exactLots = exactLotSize;

    // Chosen active lot size for main display and execution check
    const activeLotSize = (state.sizingMode === 'conservative') ? floorLotSize : roundLotSize;

    // Actual Risk for each lot size
    const floorRiskUSD = floorLotSize * riskPerLot;
    const floorRiskPct = (floorRiskUSD / balance) * 100;

    const roundRiskUSD = roundLotSize * riskPerLot;
    const roundRiskPct = (roundRiskUSD / balance) * 100;

    const exactRiskUSD = exactLotSize * riskPerLot;
    const exactRiskPct = (exactRiskUSD / balance) * 100;

    const activeRiskUSD = (state.sizingMode === 'conservative') ? floorRiskUSD : roundRiskUSD;

    // 7. Calculate Take Profit / Expected Reward
    let tpPips = null;
    let floorRewardUSD = null;
    let roundRewardUSD = null;
    let exactRewardUSD = null;
    let activeRewardUSD = null;
    let rrRatio = null;

    if (state.slMode === 'price') {
        const tpPriceVal = parseFloat(DOM.tpPrice.value);
        if (tpPriceVal && entryPriceVal && tpPriceVal !== entryPriceVal) {
            const tpDist = Math.abs(tpPriceVal - entryPriceVal);
            tpPips = tpDist / inst.pipSize;
        }
    } else {
        const tpPipsVal = parseFloat(DOM.tpPips.value);
        if (tpPipsVal && tpPipsVal > 0) {
            tpPips = tpPipsVal;
        }
    }

    if (tpPips !== null) {
        const rewardPerLot = ((tpPips - spreadPips) * pipValueUSD) - commissionLot;
        floorRewardUSD = Math.max(0, floorLotSize * rewardPerLot);
        roundRewardUSD = Math.max(0, roundLotSize * rewardPerLot);
        exactRewardUSD = Math.max(0, exactLotSize * rewardPerLot);
        activeRewardUSD = Math.max(0, activeLotSize * rewardPerLot);
        rrRatio = activeRiskUSD > 0 ? activeRewardUSD / activeRiskUSD : 0;
    }

    // 8. Calculate Position Value & Required Margin (MT5 Check)
    const leverage = getActiveLeverage();
    const notionalPerLotUSD = getNotionalValuePerLotUSD(inst, entryPriceVal, conversionRate, contractSize);
    const totalPositionValueUSD = activeLotSize * notionalPerLotUSD;
    const requiredMargin = totalPositionValueUSD / leverage;
    const marginUsagePct = (requiredMargin / balance) * 100;
    const freeMarginAfterTrade = balance - requiredMargin;

    // 9. Calculate Maximum Executable Lot & Risk based on Margin
    const marginPerLot = notionalPerLotUSD / leverage;
    const maxSafeLots = marginPerLot > 0 ? (balance / marginPerLot) : 0;
    const maxSafeRiskUSD = maxSafeLots * riskPerLot;
    const maxSafeRiskPct = (maxSafeRiskUSD / balance) * 100;

    state.maxSafeRiskPct = maxSafeRiskPct;
    state.maxSafeRiskUSD = maxSafeRiskUSD;
    state.maxSafeLots = maxSafeLots;

    // 10. Update UI, Comparison Table, and Execution Status
    updateResults({
        activeLotSize, exactLotSize, floorLotSize, roundLotSize,
        riskAmount, activeRiskUSD, floorRiskUSD, floorRiskPct, roundRiskUSD, roundRiskPct, exactRiskUSD, exactRiskPct,
        pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, freeMarginAfterTrade,
        maxSafeLots, maxSafeRiskPct, maxSafeRiskUSD,
        activeRewardUSD, floorRewardUSD, roundRewardUSD, exactRewardUSD, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance, contractSize,
        riskPerLot, spreadPips, commissionLot
    });

    updateFormula({
        activeLotSize, exactLotSize, floorLotSize, roundLotSize,
        riskAmount, activeRiskUSD, floorRiskUSD, roundRiskUSD,
        pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, maxSafeLots, maxSafeRiskPct,
        activeRewardUSD, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance, contractSize,
        riskPerLot, spreadPips, commissionLot
    });
}

// ========================================
// UI UPDATE FUNCTIONS
// ========================================
function updateResults(data) {
    const {
        activeLotSize, exactLotSize, floorLotSize, roundLotSize,
        riskAmount, activeRiskUSD, floorRiskUSD, floorRiskPct, roundRiskUSD, roundRiskPct, exactRiskUSD, exactRiskPct,
        pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, freeMarginAfterTrade,
        maxSafeLots, maxSafeRiskPct, maxSafeRiskUSD,
        activeRewardUSD, floorRewardUSD, roundRewardUSD, exactRewardUSD, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance, contractSize
    } = data;

    const pipLabel = getPipLabel(inst);
    const prevValue = DOM.lotSize.textContent;
    const newValue = activeLotSize.toFixed(2);

    DOM.lotSize.textContent = newValue;
    DOM.lotDisplay.classList.add('calculated');

    // Update lot unit label
    if (state.sizingMode === 'conservative') {
        DOM.lotUnitLabel.textContent = `LOTS (CONSERVATIVE • SAFE)`;
    } else {
        const isOver = roundRiskUSD > riskAmount + 0.01;
        DOM.lotUnitLabel.textContent = isOver ? `LOTS (ROUNDED • OVER TARGET)` : `LOTS (ROUNDED)`;
    }

    // Pop animation on change
    if (prevValue !== newValue) {
        DOM.lotSize.classList.remove('pop');
        void DOM.lotSize.offsetWidth;
        DOM.lotSize.classList.add('pop');
    }

    // Target badge in comparison card
    const targetPct = (riskAmount / balance) * 100;
    DOM.comparisonTargetBadge.textContent = `Target Risk: ${formatUSD(riskAmount)} (${targetPct.toFixed(2)}%)`;

    // Comparison Rows Update
    DOM.compLotsFloor.textContent = floorLotSize.toFixed(2);
    DOM.compRiskFloor.textContent = `${formatUSD(floorRiskUSD)} (${floorRiskPct.toFixed(2)}%)`;
    DOM.compRewardFloor.textContent = floorRewardUSD ? `Reward: ${formatUSD(floorRewardUSD)}` : 'Reward: —';

    DOM.compLotsRound.textContent = roundLotSize.toFixed(2);
    const roundDiff = roundRiskUSD - riskAmount;
    const diffSign = roundDiff > 0.01 ? `+$${roundDiff.toFixed(2)} over` : `Within target`;
    DOM.compRiskRound.textContent = `${formatUSD(roundRiskUSD)} (${roundRiskPct.toFixed(2)}%)`;
    DOM.compRewardRound.textContent = roundRewardUSD ? `Reward: ${formatUSD(roundRewardUSD)} (${diffSign})` : `(${diffSign})`;

    DOM.compLotsExact.textContent = exactLotSize.toFixed(4);
    DOM.compRiskExact.textContent = `${formatUSD(exactRiskUSD)} (${exactRiskPct.toFixed(2)}%)`;
    DOM.compRewardExact.textContent = exactRewardUSD ? `Reward: ${formatUSD(exactRewardUSD)}` : 'Reward: —';

    // Active row indicator
    DOM.rowConservative.classList.toggle('active-option', state.sizingMode === 'conservative');
    DOM.rowRounded.classList.toggle('active-option', state.sizingMode === 'rounded');

    // Risk card in grid shows active risk
    DOM.riskAmountResult.textContent = formatUSD(activeRiskUSD);
    DOM.pipValueLabel.textContent = `${pipLabel.charAt(0).toUpperCase() + pipLabel.slice(1)} Value / Lot`;
    DOM.pipValueResult.textContent = formatUSD(pipValueUSD);
    DOM.slResult.textContent = `${formatNumber(slPips, slPips % 1 === 0 ? 0 : 1)} ${pipLabel}`;
    DOM.positionValue.textContent = totalPositionValueUSD > 0 ? formatUSD(totalPositionValueUSD) : '—';

    // Reward & R:R
    if (activeRewardUSD !== null && rrRatio !== null) {
        DOM.rewardResult.textContent = formatUSD(activeRewardUSD);
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
        maxSafeRiskUSD, leverage, activeLotSize
    });

    // Lot Breakdown
    const std = Math.floor(activeLotSize);
    const remainAfterStd = activeLotSize - std;
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
        maxSafeRiskUSD, leverage, activeLotSize
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
        activeLotSize, exactLotSize, floorLotSize, roundLotSize,
        riskAmount, activeRiskUSD, floorRiskUSD, roundRiskUSD,
        pipValueUSD, slPips, totalPositionValueUSD,
        requiredMargin, marginUsagePct, maxSafeLots, maxSafeRiskPct,
        activeRewardUSD, rrRatio, tpPips,
        inst, conversionRateVal, leverage, balance, contractSize,
        riskPerLot, spreadPips, commissionLot
    } = data;

    const pipLabel = getPipLabel(inst);
    let lines = [];

    lines.push(`• 1. CONTRACT SPECIFICATIONS & PIP VALUE •`);
    lines.push(`Symbol: ${inst.label} (Contract Size = ${formatNumber(contractSize, contractSize % 1 === 0 ? 0 : 2)})`);
    lines.push(`Tick Value = ${inst.pipSize} x ${contractSize} = ${formatUSD(pipValueUSD)} per ${pipLabel === 'points' ? 'point' : 'pip'} per 1.00 lot`);
    lines.push(``);

    lines.push(`• 2. LOT SIZING (TARGET RISK: ${formatUSD(riskAmount)}) •`);
    
    if (spreadPips > 0 || commissionLot > 0) {
        lines.push(`Raw SL Risk     = ${formatNumber(slPips, slPips % 1 === 0 ? 0 : 1)} ${pipLabel} x ${formatUSD(pipValueUSD)} = ${formatUSD(slPips * pipValueUSD)}`);
        lines.push(`Phantom Costs   = Spread (${spreadPips}) + Comm (${formatUSD(commissionLot)}) = ${formatUSD((spreadPips * pipValueUSD) + commissionLot)}`);
        lines.push(`Risk Per Lot    = ${formatUSD(riskPerLot)} (Adjusted)`);
    } else {
        lines.push(`Risk Per Lot    = ${formatNumber(slPips, slPips % 1 === 0 ? 0 : 1)} ${pipLabel} x ${formatUSD(pipValueUSD)} = ${formatUSD(riskPerLot)}`);
    }
    
    lines.push(`Exact Size      = ${formatUSD(riskAmount)} ÷ ${formatUSD(riskPerLot)} = ${exactLotSize.toFixed(5)} lots`);
    lines.push(``);
    lines.push(`↓ Conservative = ${floorLotSize.toFixed(2)} lots → Actual Risk: ${formatUSD(floorRiskUSD)} (${((floorRiskUSD / balance) * 100).toFixed(2)}%) [Safe for Prop Firms]`);
    lines.push(`Nearest (Round) = ${roundLotSize.toFixed(2)} lots → Actual Risk: ${formatUSD(roundRiskUSD)} (${((roundRiskUSD / balance) * 100).toFixed(2)}%)`);
    lines.push(`Selected Volume = ${activeLotSize.toFixed(2)} lots (Active Risk: ${formatUSD(activeRiskUSD)})`);

    lines.push(``);
    lines.push(`• 3. MT5 MARGIN & EXECUTION CHECK •`);
    lines.push(`Notional Value  = ${activeLotSize.toFixed(2)} lots x Contract Specs = ${formatUSD(totalPositionValueUSD)}`);
    lines.push(`Required Margin = ${formatUSD(totalPositionValueUSD)} ÷ ${leverage} = ${formatUSD(requiredMargin)}`);
    lines.push(`Account Balance = ${formatUSD(balance)}`);
    lines.push(`Margin Usage    = (${formatUSD(requiredMargin)} ÷ ${formatUSD(balance)}) x 100 = ${marginUsagePct.toFixed(1)}%`);

    if (requiredMargin > balance) {
        lines.push(`Status          = ❌ REJECTED ("No Money")`);
        lines.push(`Max Safe Lots   = (${formatUSD(balance)} x ${leverage}) ÷ Notional/Lot = ${maxSafeLots.toFixed(2)} lots`);
        lines.push(`Max Safe Risk % = ${maxSafeRiskPct.toFixed(2)}%`);
    } else {
        lines.push(`Status          = ✅ EXECUTABLE (Free Margin Remaining: ${formatUSD(balance - requiredMargin)})`);
    }

    if (activeRewardUSD !== null && rrRatio !== null) {
        lines.push(``);
        lines.push(`── 4. EXPECTED REWARD ──`);
        lines.push(`TP Distance  = ${formatNumber(tpPips, tpPips % 1 === 0 ? 0 : 1)} ${pipLabel}`);
        lines.push(`Reward       = ${formatNumber(tpPips, tpPips % 1 === 0 ? 0 : 1)} × ${formatUSD(pipValueUSD)} × ${activeLotSize.toFixed(2)} = ${formatUSD(activeRewardUSD)}`);
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

    DOM.compLotsFloor.textContent = '0.00';
    DOM.compRiskFloor.textContent = '$0.00';
    DOM.compRewardFloor.textContent = 'Reward: —';
    DOM.compLotsRound.textContent = '0.00';
    DOM.compRiskRound.textContent = '$0.00';
    DOM.compRewardRound.textContent = 'Reward: —';
    DOM.compLotsExact.textContent = '0.0000';
    DOM.compRiskExact.textContent = '$0.00';
    DOM.compRewardExact.textContent = 'Reward: —';

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

        if (inst.selfConvert) {
            if (inst.quoteCcy === 'JPY') {
                DOM.conversionRate.placeholder = '156.74';
            } else if (inst.quoteCcy === 'CHF') {
                DOM.conversionRate.placeholder = '0.8091';
            } else if (inst.quoteCcy === 'CAD') {
                DOM.conversionRate.placeholder = '1.3823';
            } else {
                DOM.conversionRate.placeholder = '1.0000';
            }
        } else if (inst.conversionPair) {
            const defaultRate = DEFAULT_CONVERSION_RATES[inst.conversionPair];
            DOM.conversionRate.placeholder = defaultRate ? String(defaultRate) : '1.0000';
        }
    } else {
        DOM.conversionGroup.classList.add('hidden');
    }
}

function updateInfoBar() {
    const inst = getInstrument();
    const pipLabel = getPipLabel(inst);
    const leverage = getActiveLeverage();
    const contractSize = getActiveContractSize();

    DOM.infoInstrument.textContent = inst.label;
    DOM.infoCategory.textContent = inst.category;
    DOM.infoPipLabel.textContent = pipLabel === 'points' ? 'Point Size' : 'Pip Size';
    DOM.infoPipSize.textContent = inst.pipSize;
    DOM.infoContract.textContent = formatContractSize(contractSize) + (inst.unit ? ` ${inst.unit}` : '');
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
        // Forex Majors
        'EURUSD':  { entry: '1.16055', sl: '1.15755', tp: '1.16655', pips: '30', tpPips: '60' },
        'GBPUSD':  { entry: '1.34950', sl: '1.34550', tp: '1.35750', pips: '40', tpPips: '80' },
        'AUDUSD':  { entry: '0.71720', sl: '0.71420', tp: '0.72320', pips: '30', tpPips: '60' },
        'NZDUSD':  { entry: '0.58635', sl: '0.58335', tp: '0.59235', pips: '30', tpPips: '60' },
        'USDCAD':  { entry: '1.38235', sl: '1.37935', tp: '1.38835', pips: '30', tpPips: '60' },
        'USDCHF':  { entry: '0.80915', sl: '0.81215', tp: '0.80315', pips: '30', tpPips: '60' },
        'USDJPY':  { entry: '156.745', sl: '156.245', tp: '157.745', pips: '50', tpPips: '100' },

        // Forex Crosses
        'AUDCAD':  { entry: '0.99125', sl: '0.98825', tp: '0.99725', pips: '30', tpPips: '60' },
        'AUDCHF':  { entry: '0.58035', sl: '0.57735', tp: '0.58635', pips: '30', tpPips: '60' },
        'AUDJPY':  { entry: '112.410', sl: '111.910', tp: '113.410', pips: '50', tpPips: '100' },
        'AUDNZD':  { entry: '1.22315', sl: '1.22015', tp: '1.22915', pips: '30', tpPips: '60' },
        'CADCHF':  { entry: '0.58545', sl: '0.58245', tp: '0.59145', pips: '30', tpPips: '60' },
        'CADJPY':  { entry: '113.400', sl: '112.900', tp: '114.400', pips: '50', tpPips: '100' },
        'EURAUD':  { entry: '1.61820', sl: '1.61420', tp: '1.62620', pips: '40', tpPips: '80' },
        'EURCAD':  { entry: '1.60410', sl: '1.60010', tp: '1.61210', pips: '40', tpPips: '80' },
        'EURCHF':  { entry: '0.93915', sl: '0.93615', tp: '0.94515', pips: '30', tpPips: '60' },
        'EURGBP':  { entry: '0.86005', sl: '0.85755', tp: '0.86505', pips: '25', tpPips: '50' },
        'EURJPY':  { entry: '181.915', sl: '181.315', tp: '183.115', pips: '60', tpPips: '120' },
        'GBPJPY':  { entry: '211.510', sl: '210.810', tp: '212.910', pips: '70', tpPips: '140' },
        'NZDJPY':  { entry: '91.900',  sl: '91.400',  tp: '92.900',  pips: '50', tpPips: '100' },

        // Indices (Maven Specs)
        'US30':    { entry: '53110',    sl: '52930',    tp: '53500',    pips: '180', tpPips: '390' },
        'US100':   { entry: '29165.00', sl: '29065.00', tp: '29365.00', pips: '100', tpPips: '200' },
        'US500':   { entry: '7669.0',   sl: '7644.0',   tp: '7719.0',   pips: '25',  tpPips: '50' },
        'US2000':  { entry: '2952.5',   sl: '2942.5',   tp: '2972.5',   pips: '10',  tpPips: '20' },
        'GER30':   { entry: '25860.0',  sl: '25810.0',  tp: '25960.0',  pips: '50',  tpPips: '100' },
        'UK100':   { entry: '10760.0',  sl: '10720.0',  tp: '10840.0',  pips: '40',  tpPips: '80' },
        'JAP225':  { entry: '64090',    sl: '63890',    tp: '64490',    pips: '200', tpPips: '400' },

        // Commodities
        'XAUUSD':  { entry: '4427.00',  sl: '4417.00',  tp: '4447.00',  pips: '1000', tpPips: '2000' },
        'XAGUSD':  { entry: '65.880',   sl: '65.580',   tp: '66.480',   pips: '300',  tpPips: '600' },

        // Crypto
        'BTCUSD':  { entry: '77978.00', sl: '77478.00', tp: '78978.00', pips: '50000', tpPips: '100000' },
        'ETHUSD':  { entry: '2408.00',  sl: '2388.00',  tp: '2448.00',  pips: '2000',  tpPips: '4000' },
    };

    const ph = placeholders[key] || { entry: '1.00000', sl: '0.99500', tp: '1.00500', pips: '50', tpPips: '50' };
    DOM.entryPrice.placeholder = ph.entry;
    DOM.slPrice.placeholder = ph.sl;
    DOM.tpPrice.placeholder = ph.tp;
    DOM.slPips.placeholder = ph.pips;
    DOM.tpPips.placeholder = ph.tpPips;
    DOM.pipsModePrice.placeholder = ph.entry;
}


function updateCostsForInstrument() {
    const key = getInstrumentKey();
    const inst = getInstrument();
    const costs = DEFAULT_COSTS[key] || { spread: 1.0, comm: inst.category === 'Forex' ? 6.0 : 0.0 };
    
    const spreadInput = document.getElementById('spreadPips');
    const commInput = document.getElementById('commissionLot');
    const spreadSuffix = document.getElementById('spreadSuffix');

    if (spreadInput) {
        spreadInput.value = costs.spread;
        spreadInput.placeholder = costs.spread;
    }
    if (commInput) {
        commInput.value = costs.comm;
        commInput.placeholder = costs.comm.toFixed(2);
    }
    if (spreadSuffix) {
        spreadSuffix.textContent = inst.category === 'Indices' ? 'pts' : 'pips';
    }
}

function updateContractSizeForInstrument() {
    const inst = getInstrument();
    const key = getInstrumentKey();
    const cSize = inst.contractSize;

    DOM.contractSize.value = cSize;
    DOM.contractSize.placeholder = cSize;

    if (key === 'US30') {
        DOM.contractAutoBadge.textContent = 'Maven: 5 contracts ($5/pt)';
        DOM.contractSuffix.textContent = 'contracts ($5/pt)';
        DOM.contractHelper.textContent = 'Maven OMO: 1 lot = $5.00 per index point (5 contracts)';
    } else if (key === 'US100') {
        DOM.contractAutoBadge.textContent = 'Maven: 20 contracts ($20/pt)';
        DOM.contractSuffix.textContent = 'contracts ($20/pt)';
        DOM.contractHelper.textContent = 'Maven OMO: 1 lot = $20.00 per index point (20 contracts)';
    } else if (key === 'US500') {
        DOM.contractAutoBadge.textContent = 'Maven: 50 contracts ($50/pt)';
        DOM.contractSuffix.textContent = 'contracts ($50/pt)';
        DOM.contractHelper.textContent = 'Maven OMO: 1 lot = $50.00 per index point (50 contracts)';
    } else if (key === 'US2000') {
        DOM.contractAutoBadge.textContent = 'Maven: 200 contracts ($200/pt)';
        DOM.contractSuffix.textContent = 'contracts ($200/pt)';
        DOM.contractHelper.textContent = 'Maven OMO: 1 lot = $200.00 per index point (200 contracts)';
    } else if (key === 'GER30') {
        DOM.contractAutoBadge.textContent = 'Maven: 25 contracts (€25/pt)';
        DOM.contractSuffix.textContent = 'contracts (€25/pt)';
        DOM.contractHelper.textContent = 'Maven OMO: 1 lot = €25.00 per index point (25 contracts)';
    } else if (key === 'UK100') {
        DOM.contractAutoBadge.textContent = 'Maven: 10 contracts (£10/pt)';
        DOM.contractSuffix.textContent = 'contracts (£10/pt)';
        DOM.contractHelper.textContent = 'Maven OMO: 1 lot = £10.00 per index point (10 contracts)';
    } else if (key === 'JAP225') {
        DOM.contractAutoBadge.textContent = 'Maven: 10 contracts (¥10/pt)';
        DOM.contractSuffix.textContent = 'contracts (¥10/pt)';
        DOM.contractHelper.textContent = 'Maven OMO: 1 lot = ¥10 per index point (10 contracts)';
    } else if (inst.category === 'Forex') {
        DOM.contractAutoBadge.textContent = 'Standard: 100,000 units';
        DOM.contractSuffix.textContent = 'units';
        DOM.contractHelper.textContent = 'Standard Forex: 100,000 units of base currency per lot';
    } else if (key === 'XAUUSD') {
        DOM.contractAutoBadge.textContent = 'Maven: 100 oz ($1/pip)';
        DOM.contractSuffix.textContent = 'oz';
        DOM.contractHelper.textContent = 'Gold: 100 troy ounces per lot ($1.00/pip, $100 per $1 move)';
    } else if (key === 'XAGUSD') {
        DOM.contractAutoBadge.textContent = 'Maven: 5,000 oz ($5/pip)';
        DOM.contractSuffix.textContent = 'oz';
        DOM.contractHelper.textContent = 'Silver: 5,000 troy ounces per lot ($5.00/pip, $5,000 per $1 move)';
    } else if (inst.category === 'Crypto') {
        DOM.contractAutoBadge.textContent = 'Maven: 1 unit (1:2 leverage)';
        DOM.contractSuffix.textContent = inst.unit;
        DOM.contractHelper.textContent = `${inst.label}: 1 ${inst.unit} per lot ($0.01 per pip, 1:2 crypto leverage)`;
    } else {
        DOM.contractAutoBadge.textContent = `Default: ${cSize} ${inst.unit || 'contracts'}`;
        DOM.contractSuffix.textContent = inst.unit || 'contracts';
        DOM.contractHelper.textContent = `Tick value: $${(inst.pipSize * cSize).toFixed(2)} per point for 1.00 lot`;
    }
}

function updateLeverageForInstrument() {
    const inst = getInstrument();
    const defaultLev = inst.defaultLeverage || 100;

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
    updateContractSizeForInstrument();
    updateCostsForInstrument();
    updateLeverageForInstrument();
    updateConversionField();
    updateInfoBar();
    updateInstrumentBadge();
    updatePipLabels();
    updatePlaceholders();
    DOM.tradeDirection.classList.add('hidden');
    calculate();
});

// Contract size manual edit
DOM.contractSize.addEventListener('input', () => {
    updateInfoBar();
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

// Sizing mode toggle (Conservative vs Rounded)
function setSizingMode(mode) {
    state.sizingMode = mode;
    if (mode === 'conservative') {
        DOM.sizingConservativeBtn.classList.add('active');
        DOM.sizingRoundedBtn.classList.remove('active');
        DOM.sizingSlider.classList.remove('right');
        DOM.sizingHelper.textContent = 'Conservative floors to 0.01 step so risk never breaches your target limit.';
    } else {
        DOM.sizingRoundedBtn.classList.add('active');
        DOM.sizingConservativeBtn.classList.remove('active');
        DOM.sizingSlider.classList.add('right');
        DOM.sizingHelper.textContent = 'Nearest rounding rounds mathematically, but may slightly exceed target risk.';
    }
    calculate();
}

DOM.sizingConservativeBtn.addEventListener('click', () => setSizingMode('conservative'));
DOM.sizingRoundedBtn.addEventListener('click', () => setSizingMode('rounded'));

// Click on comparison card rows to switch mode
DOM.rowConservative.addEventListener('click', () => setSizingMode('conservative'));
DOM.rowRounded.addEventListener('click', () => setSizingMode('rounded'));

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
    DOM.balance, DOM.contractSize, DOM.riskPercent, DOM.riskDollar,
    DOM.entryPrice, DOM.slPrice, DOM.tpPrice,
    DOM.slPips, DOM.tpPips, DOM.pipsModePrice,
    DOM.conversionRate,
    document.getElementById('spreadPips'), document.getElementById('commissionLot')
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

    state.sizingMode = 'conservative';
    DOM.sizingConservativeBtn.classList.add('active');
    DOM.sizingSlider.classList.remove('right');

    updateContractSizeForInstrument();
    updateCostsForInstrument();
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

// ========================================
// FIREBASE CLOUD SYNC & TRADE LOGGING
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyDAOHg2cYFzHiBSNEw8IWhkBZD2A2v7F-o",
  authDomain: "forex-calculator-bd2f8.firebaseapp.com",
  projectId: "forex-calculator-bd2f8",
  storageBucket: "forex-calculator-bd2f8.firebasestorage.app",
  messagingSenderId: "1036573574708",
  appId: "1:1036573574708:web:c4cff525a8dec486906c61",
  measurementId: "G-R9ZZFJERTV"
};

let db = null;
try {
  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialized successfully");
  }
} catch (e) {
  console.error("Firebase init failed:", e);
}

let traderId = localStorage.getItem("traderId") || "OYAREWEALTH";
const displayTraderId = document.getElementById("displayTraderId");
if (displayTraderId) displayTraderId.textContent = traderId;

document.getElementById("btnEditTrader")?.addEventListener("click", () => {
  const newId = prompt("Enter your Trader ID to sync across devices:", traderId);
  if (newId && newId.trim() !== "") {
    traderId = newId.trim().toUpperCase();
    localStorage.setItem("traderId", traderId);
    if (displayTraderId) displayTraderId.textContent = traderId;
    listenToTrades();
  }
});

function showToast(message, type = "success") {
  const toast = document.getElementById("logToast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "log-toast show " + type;
  setTimeout(() => {
    toast.className = "log-toast hidden";
  }, 3000);
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  return d + "d ago";
}

document.getElementById("btnLogTrade")?.addEventListener("click", () => {
  if (!db) {
    showToast("Cloud sync unavailable", "error");
    return;
  }

  const lotSize = parseFloat(document.getElementById("lotSize").textContent);
  if (isNaN(lotSize) || lotSize <= 0) {
    showToast("Calculate a valid lot size first!", "error");
    return;
  }

  const tradeData = {
    instrument: document.getElementById("instrument").value,
    balance: parseFloat(document.getElementById("balance").value),
    riskPercent: parseFloat(document.getElementById("riskPercent").value),
    riskDollar: parseFloat(document.getElementById("riskDollar").value),
    riskMode: state.riskMode,
    slMode: state.slMode,
    entryPrice: document.getElementById("entryPrice").value,
    slPrice: document.getElementById("slPrice").value,
    tpPrice: document.getElementById("tpPrice").value,
    slPips: document.getElementById("slPips").value,
    tpPips: document.getElementById("tpPips").value,
    spreadPips: document.getElementById("spreadPips") ? document.getElementById("spreadPips").value : 0,
    commissionLot: document.getElementById("commissionLot") ? document.getElementById("commissionLot").value : 0,
    lotSize: lotSize,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection("traders").doc(traderId).collection("trades").add(tradeData)
    .then(() => {
      showToast("Trade synced to cloud! ☁️");
    })
    .catch(err => {
      console.error(err);
      showToast("Error syncing trade", "error");
    });
});

let unsubscribeTrades = null;

function listenToTrades() {
  if (!db) return;
  if (unsubscribeTrades) unsubscribeTrades();

  const listEl = document.getElementById("tradeLogList");
  if (!listEl) return;
  listEl.innerHTML = "<div style=\"padding:20px;text-align:center;color:var(--text-muted)\">Syncing with cloud...</div>";

  unsubscribeTrades = db.collection("traders").doc(traderId).collection("trades")
    .orderBy("timestamp", "desc")
    .limit(20)
    .onSnapshot(snapshot => {
      listEl.innerHTML = "";
      if (snapshot.empty) {
        listEl.innerHTML = "<div class=\"empty-log\">No trades logged yet. Click \"Log / Save This Trade\" above.</div>";
        return;
      }

      snapshot.forEach(doc => {
        const data = doc.data();
        const timeStr = data.timestamp ? formatTimeAgo(data.timestamp.toDate()) : "Just now";
        const card = document.createElement("div");
        card.className = "trade-card";

        const riskLabel = data.riskMode === "percent" ? (data.riskPercent + "%") : ("$" + data.riskDollar);
        card.innerHTML = 
          "<div class=\"trade-card-header\">" +
            "<span class=\"trade-card-inst\">" + data.instrument + "</span>" +
            "<span class=\"trade-card-time\">" + timeStr + "</span>" +
          "</div>" +
          "<div class=\"trade-card-body\">" +
            "<div class=\"trade-card-stat\">" +
              "<span class=\"stat-label\">Lots</span>" +
              "<span class=\"stat-value\">" + data.lotSize + "</span>" +
            "</div>" +
            "<div class=\"trade-card-stat\">" +
              "<span class=\"stat-label\">Risk</span>" +
              "<span class=\"stat-value\">" + riskLabel + "</span>" +
            "</div>" +
          "</div>" +
          "<button class=\"btn-load-trade\">Load Setup</button>" +
          "<button class=\"btn-del-trade\" data-id=\"" + doc.id + "\">✕</button>";

        card.querySelector(".btn-load-trade").addEventListener("click", () => {
          loadTradeIntoCalculator(data);
        });

        card.querySelector(".btn-del-trade").addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Delete this trade log?")) {
            db.collection("traders").doc(traderId).collection("trades").doc(doc.id).delete();
          }
        });

        listEl.appendChild(card);
      });

      const statusText = document.getElementById("cloudStatusText");
      const statusBadge = document.getElementById("cloudStatusBadge");
      if (statusText) statusText.textContent = "Cloud Synced";
      if (statusBadge) statusBadge.classList.replace("status-error", "status-connected");
    }, err => {
      console.error("Firestore listen error", err);
      const statusText = document.getElementById("cloudStatusText");
      const statusBadge = document.getElementById("cloudStatusBadge");
      if (statusText) statusText.textContent = "Sync Error";
      if (statusBadge) statusBadge.classList.replace("status-connected", "status-error");
    });
}

function loadTradeIntoCalculator(data) {
  document.getElementById("instrument").value = data.instrument;
  document.getElementById("balance").value = data.balance;
  if (document.getElementById("spreadPips")) document.getElementById("spreadPips").value = data.spreadPips || "";
  if (document.getElementById("commissionLot")) document.getElementById("commissionLot").value = data.commissionLot || "";

  if (data.riskMode === "percent") {
    document.getElementById("riskPercentBtn").click();
    document.getElementById("riskPercent").value = data.riskPercent;
  } else {
    document.getElementById("riskDollarBtn").click();
    document.getElementById("riskDollar").value = data.riskDollar;
  }

  if (data.slMode === "price") {
    document.getElementById("slPriceBtn").click();
    document.getElementById("entryPrice").value = data.entryPrice || "";
    document.getElementById("slPrice").value = data.slPrice || "";
    document.getElementById("tpPrice").value = data.tpPrice || "";
  } else {
    document.getElementById("slPipsBtn").click();
    document.getElementById("slPips").value = data.slPips || "";
    document.getElementById("tpPips").value = data.tpPips || "";
  }

  showToast("Trade loaded into calculator");
  updateContractSizeForInstrument();
  updateLeverageForInstrument();
  updateConversionField();
  updateInfoBar();
  updateInstrumentBadge();
  calculate();
}

document.getElementById("btnClearLogs")?.addEventListener("click", async () => {
  if (!db) return;
  if (confirm("Clear ALL trade logs? This cannot be undone.")) {
    const snapshot = await db.collection("traders").doc(traderId).collection("trades").get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    showToast("All logs cleared");
  }
});

setTimeout(listenToTrades, 500);
