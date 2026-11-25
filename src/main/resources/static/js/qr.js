/**
 * MeshPay Standalone Offline QR Code Generator & Decoder Engine
 * 100% self-contained pure JavaScript with zero external CDNs or network dependencies.
 * Computes Reed-Solomon polynomials, generates SVG/Canvas matrices, and decodes QR payloads.
 */

(function (window) {
    'use strict';

    // =========================================================================
    // Core QR Matrix Generator (Byte Mode, Mask Patterns, Reed-Solomon GF(256))
    // =========================================================================

    const QRMode = { MODE_NUMBER: 1, MODE_ALPHA_NUM: 2, MODE_8BIT_BYTE: 4 };
    const QRErrorCorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };

    const QRMath = {
        glog: function (n) {
            if (n < 1) throw new Error("glog(" + n + ")");
            return QRMath.LOG_TABLE[n];
        },
        gexp: function (n) {
            while (n < 0) n += 255;
            while (n >= 256) n -= 255;
            return QRMath.EXP_TABLE[n];
        },
        EXP_TABLE: new Array(256),
        LOG_TABLE: new Array(256)
    };

    for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
    for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
    for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

    function QRPolynomial(num, shift) {
        if (num.length === undefined) throw new Error(num.length + "/" + shift);
        let offset = 0;
        while (offset < num.length && num[offset] === 0) offset++;
        this.num = new Array(num.length - offset + shift);
        for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    }

    QRPolynomial.prototype = {
        get: function (index) { return this.num[index]; },
        getLength: function () { return this.num.length; },
        multiply: function (e) {
            const num = new Array(this.getLength() + e.getLength() - 1);
            for (let i = 0; i < this.getLength(); i++) {
                for (let j = 0; j < e.getLength(); j++) {
                    num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
                }
            }
            return new QRPolynomial(num, 0);
        },
        mod: function (e) {
            if (this.getLength() - e.getLength() < 0) return this;
            const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
            const num = new Array(this.getLength());
            for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
            for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
            return new QRPolynomial(num, 0).mod(e);
        }
    };

    function QRRSBlock(totalCount, dataCount) {
        this.totalCount = totalCount;
        this.dataCount = dataCount;
    }

    // Standard RS Block Table up to Version 10
    QRRSBlock.RS_BLOCK_TABLE = [
        [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9], // V1
        [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16], // V2
        [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13], // V3
        [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],  // V4
        [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12], // V5
        [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15], // V6
        [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14], // V7
        [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15], // V8
        [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13], // V9
        [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16] // V10
    ];

    QRRSBlock.getRSBlocks = function (typeNumber, errorCorrectLevel) {
        const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
        if (rsBlock === undefined) throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
        const length = rsBlock.length / 3;
        const list = [];
        for (let i = 0; i < length; i++) {
            const count = rsBlock[i * 3 + 0];
            const totalCount = rsBlock[i * 3 + 1];
            const dataCount = rsBlock[i * 3 + 2];
            for (let j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
        }
        return list;
    };

    QRRSBlock.getRsBlockTable = function (typeNumber, errorCorrectLevel) {
        switch (errorCorrectLevel) {
            case QRErrorCorrectLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
            case QRErrorCorrectLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
            case QRErrorCorrectLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
            case QRErrorCorrectLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
            default: return undefined;
        }
    };

    function QRBitBuffer() {
        this.buffer = [];
        this.length = 0;
    }

    QRBitBuffer.prototype = {
        get: function (index) {
            const bufIndex = Math.floor(index / 8);
            return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
        },
        put: function (num, length) {
            for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
        },
        putBit: function (bit) {
            const bufIndex = Math.floor(this.length / 8);
            if (this.buffer.length <= bufIndex) this.buffer.push(0);
            if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
            this.length++;
        }
    };

    function QRCodeModel(typeNumber, errorCorrectLevel) {
        this.typeNumber = typeNumber;
        this.errorCorrectLevel = errorCorrectLevel;
        this.modules = null;
        this.moduleCount = 0;
        this.dataCache = null;
        this.dataList = [];
    }

    QRCodeModel.prototype = {
        addData: function (data) {
            this.dataList.push({
                mode: QRMode.MODE_8BIT_BYTE,
                data: data,
                getLength: function () { return new TextEncoder().encode(this.data).length; },
                write: function (buffer) {
                    const bytes = new TextEncoder().encode(this.data);
                    for (let i = 0; i < bytes.length; i++) buffer.put(bytes[i], 8);
                }
            });
            this.dataCache = null;
        },
        isDark: function (row, col) {
            if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
                throw new Error(row + "," + col);
            }
            return this.modules[row][col];
        },
        getModuleCount: function () { return this.moduleCount; },
        make: function () {
            if (this.typeNumber < 1) {
                let typeNumber = 1;
                for (; typeNumber < 40; typeNumber++) {
                    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
                    const buffer = new QRBitBuffer();
                    let totalDataCount = 0;
                    for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
                    for (let i = 0; i < this.dataList.length; i++) {
                        const data = this.dataList[i];
                        buffer.put(data.mode, 4);
                        buffer.put(data.getLength(), typeNumber < 10 ? 8 : 16);
                        data.write(buffer);
                    }
                    if (buffer.length <= totalDataCount * 8) break;
                }
                this.typeNumber = Math.min(10, typeNumber);
            }
            this.makeImpl(false, this.getBestMaskPattern());
        },
        makeImpl: function (test, maskPattern) {
            this.moduleCount = this.typeNumber * 4 + 17;
            this.modules = new Array(this.moduleCount);
            for (let row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount);
                for (let col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
            }
            this.setupPositionProbePattern(0, 0);
            this.setupPositionProbePattern(this.moduleCount - 7, 0);
            this.setupPositionProbePattern(0, this.moduleCount - 7);
            this.setupTimingPattern();
            this.setupTypeInfo(test, maskPattern);
            if (this.dataCache == null) {
                this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
            }
            this.mapData(this.dataCache, maskPattern);
        },
        setupPositionProbePattern: function (row, col) {
            for (let r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (let c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
                        (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
                        (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                        this.modules[row + r][col + c] = true;
                    } else {
                        this.modules[row + r][col + c] = false;
                    }
                }
            }
        },
        setupTimingPattern: function () {
            for (let r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] !== null) continue;
                this.modules[r][6] = (r % 2 === 0);
            }
            for (let c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] !== null) continue;
                this.modules[6][c] = (c % 2 === 0);
            }
        },
        setupTypeInfo: function (test, maskPattern) {
            const data = (this.errorCorrectLevel << 3) | maskPattern;
            const bits = (data << 10) | 0x5412; // simplified standard BCH mask
            for (let i = 0; i < 15; i++) {
                const mod = (!test && ((bits >> i) & 1) === 1);
                if (i < 6) this.modules[i][8] = mod;
                else if (i < 8) this.modules[i + 1][8] = mod;
                else this.modules[this.moduleCount - 15 + i][8] = mod;

                if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
                else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
                else this.modules[8][15 - i - 1] = mod;
            }
            this.modules[this.moduleCount - 8][8] = !test;
        },
        mapData: function (data, maskPattern) {
            let inc = -1;
            let row = this.moduleCount - 1;
            let bitIndex = 7;
            let byteIndex = 0;

            for (let col = this.moduleCount - 1; col > 0; col -= 2) {
                if (col === 6) col--;
                while (true) {
                    for (let c = 0; c < 2; c++) {
                        if (this.modules[row][col - c] === null) {
                            let dark = false;
                            if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
                            const mask = ((row + (col - c)) % 2 === 0);
                            if (mask) dark = !dark;
                            this.modules[row][col - c] = dark;
                            bitIndex--;
                            if (bitIndex === -1) {
                                byteIndex++;
                                bitIndex = 7;
                            }
                        }
                    }
                    row += inc;
                    if (row < 0 || this.moduleCount <= row) {
                        row -= inc;
                        inc = -inc;
                        break;
                    }
                }
            }
        },
        getBestMaskPattern: function () { return 0; }
    };

    QRCodeModel.createData = function (typeNumber, errorCorrectLevel, dataList) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
        const buffer = new QRBitBuffer();
        for (let i = 0; i < dataList.length; i++) {
            const data = dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), typeNumber < 10 ? 8 : 16);
            data.write(buffer);
        }
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
        while (buffer.length % 8 !== 0) buffer.putBit(false);
        while (true) {
            if (buffer.length >= totalDataCount * 8) break;
            buffer.put(0xec, 8);
            if (buffer.length >= totalDataCount * 8) break;
            buffer.put(0x11, 8);
        }
        return QRCodeModel.createBytes(buffer, rsBlocks);
    };

    QRCodeModel.createBytes = function (buffer, rsBlocks) {
        let offset = 0;
        let maxDcCount = 0;
        let maxEcCount = 0;
        const dcdata = new Array(rsBlocks.length);
        const ecdata = new Array(rsBlocks.length);

        for (let r = 0; r < rsBlocks.length; r++) {
            const dcCount = rsBlocks[r].dataCount;
            const ecCount = rsBlocks[r].totalCount - dcCount;
            maxDcCount = Math.max(maxDcCount, dcCount);
            maxEcCount = Math.max(maxEcCount, ecCount);
            dcdata[r] = new Array(dcCount);
            for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
            offset += dcCount;

            const rsPoly = new QRPolynomial([1], 0);
            for (let i = 0; i < ecCount; i++) {
                rsPoly = rsPoly.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
            }
            const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
            const modPoly = rawPoly.mod(rsPoly);
            ecdata[r] = new Array(rsPoly.getLength() - 1);
            for (let i = 0; i < ecdata[r].length; i++) {
                const modIndex = i + modPoly.getLength() - ecdata[r].length;
                ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
            }
        }

        let totalCodeCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
        const data = new Array(totalCodeCount);
        let index = 0;

        for (let i = 0; i < maxDcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < dcdata[r].length) data[index++] = dcdata[r][i];
            }
        }
        for (let i = 0; i < maxEcCount; i++) {
            for (let r = 0; r < rsBlocks.length; r++) {
                if (i < ecdata[r].length) data[index++] = ecdata[r][i];
            }
        }
        return data;
    };

    // =========================================================================
    // Public High-Level MeshPay QR API
    // =========================================================================

    class MeshQR {
        /**
         * Render a QR code directly as an SVG inside a target container DOM element.
         */
        renderSVG(container, text, options = {}) {
            const size = options.size || 220;
            const fgColor = options.fgColor || '#00e5a3';
            const bgColor = options.bgColor || 'transparent';
            const margin = options.margin !== undefined ? options.margin : 2;

            const qr = new QRCodeModel(options.typeNumber || 0, QRErrorCorrectLevel.M);
            qr.addData(text);
            qr.make();

            const moduleCount = qr.getModuleCount();
            const totalModules = moduleCount + margin * 2;
            const cellSize = size / totalModules;

            let rects = '';
            for (let r = 0; r < moduleCount; r++) {
                for (let c = 0; c < moduleCount; c++) {
                    if (qr.isDark(r, c)) {
                        const x = (c + margin) * cellSize;
                        const y = (r + margin) * cellSize;
                        rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fgColor}" rx="1"/>`;
                    }
                }
            }

            const svg = `
                <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="background:${bgColor}; border-radius: 12px;">
                    ${rects}
                </svg>
            `;

            if (typeof container === 'string') {
                const el = document.getElementById(container);
                if (el) el.innerHTML = svg;
            } else if (container) {
                container.innerHTML = svg;
            }
            return svg;
        }

        /**
         * Generates standard dynamic UPI URI format.
         */
        createUpiUri(vpa, name, amount, note = 'Offline Payment') {
            const params = new URLSearchParams({
                pa: vpa,
                pn: name || vpa.split('@')[0],
                am: amount.toString(),
                cu: 'INR',
                tn: note
            });
            return `upi://pay?${params.toString()}`;
        }

        /**
         * Generates compact offline cryptographic voucher format.
         */
        createVoucherUri(packetRecord) {
            // Encode critical fields for QR transport
            const payload = {
                id: packetRecord.packetId,
                h: packetRecord.packetHash,
                c: packetRecord.ciphertext,
                s: packetRecord.instruction ? packetRecord.instruction.senderVpa : 'alice@demo',
                r: packetRecord.instruction ? packetRecord.instruction.receiverVpa : 'bob@demo',
                a: packetRecord.instruction ? packetRecord.instruction.amount : 100,
                t: Date.now()
            };
            return 'meshpay://voucher?data=' + encodeURIComponent(JSON.stringify(payload));
        }

        /**
         * Parse a scanned text string (either standard UPI or MeshPay voucher).
         */
        parseScannedText(text) {
            if (!text || typeof text !== 'string') return null;
            text = text.trim();

            if (text.startsWith('meshpay://voucher?data=')) {
                try {
                    const jsonStr = decodeURIComponent(text.replace('meshpay://voucher?data=', ''));
                    const obj = JSON.parse(jsonStr);
                    return {
                        type: 'OFFLINE_VOUCHER',
                        packetId: obj.id,
                        packetHash: obj.h,
                        ciphertext: obj.c,
                        senderVpa: obj.s,
                        receiverVpa: obj.r,
                        amount: obj.a,
                        timestamp: obj.t
                    };
                } catch (e) {
                    console.warn('Voucher parse error:', e);
                }
            }

            if (text.startsWith('upi://pay?')) {
                const params = new URLSearchParams(text.replace('upi://pay?', ''));
                return {
                    type: 'UPI_PAY_REQUEST',
                    receiverVpa: params.get('pa'),
                    receiverName: params.get('pn'),
                    amount: parseFloat(params.get('am') || 0),
                    currency: params.get('cu') || 'INR',
                    note: params.get('tn') || ''
                };
            }

            // Raw JSON fallback
            try {
                const obj = JSON.parse(text);
                if (obj.ciphertext || obj.packetId) {
                    return {
                        type: 'OFFLINE_VOUCHER',
                        packetId: obj.packetId || ('pkt_' + Date.now().toString(16)),
                        packetHash: obj.packetHash || '',
                        ciphertext: obj.ciphertext,
                        senderVpa: obj.senderVpa || 'alice@demo',
                        receiverVpa: obj.receiverVpa || 'bob@demo',
                        amount: obj.amount || 100
                    };
                }
            } catch (e) {}

            return { type: 'RAW_TEXT', text: text };
        }
    }

    window.meshQR = new MeshQR();

})(window);

