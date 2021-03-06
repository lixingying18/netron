/* jshint esversion: 6 */

var json = json || {};

json.TextReader = class {

    constructor(buffer) {
        this._buffer = buffer;
    }

    static create(buffer) {
        return new json.TextReader(buffer);
    }

    read() {
        const decoder = json.TextDecoder.create(this._buffer);
        const stack = [];
        this._decoder = decoder;
        this._escape = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
        this._position = 0;
        this._char = decoder.decode();
        this._whitespace();
        let obj = undefined;
        let first = true;
        for (;;) {
            if (Array.isArray(obj)) {
                this._whitespace();
                let c = this._char;
                if (c === ']') {
                    this._next();
                    this._whitespace();
                    if (stack.length > 0) {
                        obj = stack.pop();
                        first = false;
                        continue;
                    }
                    if (this._char !== undefined) {
                        this._unexpected();
                    }
                    return obj;
                }
                if (!first) {
                    if (this._char !== ',') {
                        this._unexpected();
                    }
                    this._next();
                    this._whitespace();
                    c = this._char;
                }
                first = false;
                switch (c) {
                    case '{': {
                        this._next();
                        stack.push(obj);
                        const item = {};
                        obj.push(item);
                        obj = item;
                        first = true;
                        break;
                    }
                    case '[': {
                        this._next();
                        stack.push(obj);
                        const item = [];
                        obj.push(item);
                        obj = item;
                        first = true;
                        break;
                    }
                    default: {
                        obj.push(c === '"' ? this._string() : this._literal());
                        break;
                    }
                }
            }
            else if (obj instanceof Object) {
                this._whitespace();
                let c = this._char;
                if (c === '}') {
                    this._next();
                    this._whitespace();
                    if (stack.length > 0) {
                        obj = stack.pop();
                        first = false;
                        continue;
                    }
                    if (this._char !== undefined) {
                        this._unexpected();
                    }
                    return obj;
                }
                if (!first) {
                    if (this._char !== ',') {
                        this._unexpected();
                    }
                    this._next();
                    this._whitespace();
                    c = this._char;
                }
                first = false;
                if (c === '"') {
                    const key = this._string();
                    this._whitespace();
                    if (this._char !== ':') {
                        this._unexpected();
                    }
                    this._next();
                    this._whitespace();
                    c = this._char;
                    switch (c) {
                        case '{': {
                            this._next();
                            stack.push(obj);
                            const value = {};
                            obj[key] = value;
                            obj = value;
                            first = true;
                            break;
                        }
                        case '[': {
                            this._next();
                            stack.push(obj);
                            const value = [];
                            obj[key] = value;
                            obj = value;
                            first = true;
                            break;
                        }
                        default: {
                            obj[key] = c === '"' ? this._string() : this._literal();
                            break;
                        }
                    }
                    this._whitespace();
                    continue;
                }
                this._unexpected();
            }
            else {
                const c = this._char;
                switch (c) {
                    case '{': {
                        this._next();
                        obj = {};
                        first = true;
                        break;
                    }
                    case '[': {
                        this._next();
                        obj = [];
                        first = true;
                        break;
                    }
                    default: {
                        const value = c === '"' ? this._string() : c >= '0' && c <= '9' ? this._number() : this._literal();
                        if (this._char !== undefined) {
                            this._unexpected();
                        }
                        return value;
                    }
                }
                this._whitespace();
            }
        }
    }

    _next() {
        if (this._char === undefined) {
            this._unexpected();
        }
        this._position = this._decoder.position;
        this._char = this._decoder.decode();
    }

    _whitespace() {
        while (this._char === ' ' || this._char === '\n' || this._char === '\r' || this._char === '\t') {
            this._next();
        }
    }

    _literal() {
        const c = this._char;
        if (c >= '0' && c <= '9') {
            return this._number();
        }
        switch (c) {
            case 't': this._expect('true'); return true;
            case 'f': this._expect('false'); return false;
            case 'n': this._expect('null'); return null;
            case 'N': this._expect('NaN'); return NaN;
            case 'I': this._expect('Infinity'); return Infinity;
            case '-': return this._number();
        }
        this._unexpected();
    }

    _number() {
        let value = '';
        if (this._char === '-') {
            value = '-';
            this._next();
        }
        if (this._char === 'I') {
            this._expect('Infinity');
            return -Infinity;
        }
        const c = this._char;
        if (c < '0' || c > '9') {
            this._unexpected();
        }
        value += c;
        this._next();
        if (c === '0') {
            const n = this._char;
            if (n >= '0' && n <= '9') {
                this._unexpected();
            }
        }
        while (this._char >= '0' && this._char <= '9') {
            value += this._char;
            this._next();
        }
        if (this._char === '.') {
            value += '.';
            this._next();
            const n = this._char;
            if (n < '0' || n > '9') {
                this._unexpected();
            }
            while (this._char >= '0' && this._char <= '9') {
                value += this._char;
                this._next();
            }
        }
        if (this._char === 'e' || this._char === 'E') {
            value += this._char;
            this._next();
            const s = this._char;
            if (s === '-' || s === '+') {
                value += this._char;
                this._next();
            }
            const c = this._char;
            if (c < '0' || c > '9') {
                this._unexpected();
            }
            value += this._char;
            this._next();
            while (this._char >= '0' && this._char <= '9') {
                value += this._char;
                this._next();
            }
        }
        return +value;
    }

    _string() {
        let value = '';
        this._next();
        while (this._char != '"') {
            if (this._char === '\\') {
                this._next();
                if (this._char === 'u') {
                    this._next();
                    let uffff = 0;
                    for (let i = 0; i < 4; i ++) {
                        const hex = parseInt(this._char, 16);
                        if (!isFinite(hex)) {
                            this._unexpected();
                        }
                        this._next();
                        uffff = uffff * 16 + hex;
                    }
                    value += String.fromCharCode(uffff);
                }
                else if (this._escape[this._char]) {
                    value += this._escape[this._char];
                    this._next();
                }
                else {
                    this._unexpected();
                }
            }
            else if (this._char < ' ') {
                this._unexpected();
            }
            else {
                value += this._char;
                this._next();
            }
        }
        this._next();
        return value;
    }

    _expect(text) {
        for (let i = 0; i < text.length; i++) {
            if (text[i] !== this._char) {
                this._unexpected();
            }
            this._next();
        }
    }

    _unexpected() {
        let c = this._char;
        if (c === undefined) {
            throw new json.Error('Unexpected end of JSON input.');
        }
        else if (c === '"') {
            c = 'string';
        }
        else if ((c >= '0' && c <= '9') || c === '-') {
            c = 'number';
        }
        else {
            if (c < ' ' || c > '\x7F') {
                const name = Object.keys(this._escape).filter((key) => this._escape[key] === c);
                c = (name.length === 1) ? '\\' + name : '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
            }
            c = "token '" + c + "'";
        }
        throw new json.Error('Unexpected ' + c + this._location());
    }

    _location() {
        let line = 1;
        let column = 1;
        this._decoder.position = 0;
        let c;
        do {
            if (this._decoder.position === this.position) {
                return ' at ' + line.toString() + ':' + column.toString() + '.';
            }
            c = this._decoder.decode();
            if (c === '\n') {
                line++;
                column = 0;
            }
            else {
                column++;
            }
        }
        while (c !== undefined);
        return ' at ' + line.toString() + ':' + column.toString() + '.';
    }
};

json.TextDecoder = class {

    static create(buffer) {
        const length = buffer.length;
        if (typeof buffer === 'string') {
            return new json.TextDecoder.String(buffer);
        }
        if (length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
            return new json.TextDecoder.Utf8(buffer, 3);
        }
        if (length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
            return new json.TextDecoder.Utf16LE(buffer, 2);
        }
        if (length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
            return new json.TextDecoder.Utf16BE(buffer, 2);
        }
        if (length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0xfe && buffer[3] === 0xff) {
            throw new json.Error("Unsupported UTF-32 big-endian encoding.");
        }
        if (length >= 4 && buffer[0] === 0xff && buffer[1] === 0xfe && buffer[2] === 0x00 && buffer[3] === 0x00) {
            throw new json.Error("Unsupported UTF-32 little-endian encoding.");
        }
        if (length >= 5 && buffer[0] === 0x2B && buffer[1] === 0x2F && buffer[2] === 0x76 && buffer[3] === 0x38 && buffer[4] === 0x2D) {
            throw new json.Error("Unsupported UTF-7 encoding.");
        }
        if (length >= 4 && buffer[0] === 0x2B && buffer[1] === 0x2F && buffer[2] === 0x76 && (buffer[3] === 0x38 || buffer[3] === 0x39 || buffer[3] === 0x2B || buffer[3] === 0x2F)) {
            throw new json.Error("Unsupported UTF-7 encoding.");
        }
        if (length >= 4 && buffer[0] === 0x84 && buffer[1] === 0x31 && buffer[2] === 0x95 && buffer[3] === 0x33) {
            throw new json.Error("Unsupported GB-18030 encoding.");
        }
        if (length > 4 && (length % 2) == 0 && (buffer[0] === 0x00 || buffer[1] === 0x00 || buffer[2] === 0x00 || buffer[3] === 0x00)) {
            const lo = new Uint32Array(256);
            const hi = new Uint32Array(256);
            for (let i = 0; i < length; i += 2) {
                lo[buffer[i]]++;
                hi[buffer[i + 1]]++;
            }
            if (lo[0x00] === 0 && (hi[0x00] / (length >> 1)) > 0.5) {
                return new json.TextDecoder.Utf16LE(buffer, 0);
            }
            if (hi[0x00] === 0 && (lo[0x00] / (length >> 1)) > 0.5) {
                return new json.TextDecoder.Utf16BE(buffer, 0);
            }
        }
        return new json.TextDecoder.Utf8(buffer, 0);
    }
};

json.TextDecoder.String = class {

    constructor(buffer) {
        this.buffer = buffer;
        this.position = 0;
        this.length = buffer.length;
    }

    decode() {
        return this.position < this.length ? this.buffer[this.position++] : undefined;
    }
};

json.TextDecoder.Utf8 = class {

    constructor(buffer, position) {
        this.position = position || 0;
        this.buffer = buffer;
    }

    decode() {
        const c = this.buffer[this.position];
        if (c === undefined) {
            return c;
        }
        this.position++;
        if (c < 0x80) {
            return String.fromCodePoint(c);
        }
        if (c >= 0xC2 && c <= 0xDF) {
            if (this.buffer[this.position] !== undefined) {
                const c2 = this.buffer[this.position];
                this.position++;
                return String.fromCharCode(((c & 0x1F) << 6) | (c2 & 0x3F));
            }
        }
        if (c >= 0xE0 && c <= 0xEF) {
            if (this.buffer[this.position + 1] !== undefined) {
                const c2 = this.buffer[this.position];
                if ((c !== 0xE0 || c2 >= 0xA0) && (c !== 0xED || c2 <= 0x9f)) {
                    const c3 = this.buffer[this.position + 1];
                    if (c3 >= 0x80 && c3 < 0xFB) {
                        this.position += 2;
                        return String.fromCharCode(((c & 0x0F) << 12) | ((c2 & 0x3F) << 6) | ((c3 & 0x3F) << 0));
                    }
                }
            }
        }
        if (c >= 0xF0 && c <= 0xF4) {
            if (this.buffer[this.position + 2] !== undefined) {
                const c2 = this.buffer[this.position];
                if ((c !== 0xF0 || c2 >= 0x90) && (c !== 0xF4 || c2 <= 0x8f)) {
                    const c3 = this.buffer[this.position + 1];
                    if (c3 >= 0x80 && c3 < 0xFB) {
                        const c4 = this.buffer[this.position + 2];
                        this.position += 3;
                        return String.fromCodePoint(((c & 0x07) << 18) | ((c2 & 0x3F) << 12) | ((c3 & 0x3F) << 6) | (c4 & 0x3F));
                    }
                }
            }
        }
        return String.fromCharCode(0xfffd);
    }
};

json.TextDecoder.Utf16LE = class {

    constructor(buffer, position) {
        this.buffer = buffer;
        this.position = position || 0;
        this.length = buffer.length;
    }

    decode() {
        if (this.position + 1 < this.length) {
            const c = this.buffer[this.position++] | (this.buffer[this.position++] << 8);
            if (c < 0xD800 || c >= 0xDFFF) {
                return String.fromCharCode(c);
            }
            if (c >= 0xD800 && c < 0xDBFF) {
                if (this._position + 1 < this._length) {
                    const c2 = this._buffer[this._position++] | (this._buffer[this._position++] << 8);
                    if (c >= 0xDC00 || c < 0xDFFF) {
                        return String.fromCodePoint(0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff));
                    }
                }
            }
            return String.fromCharCode(0xfffd);
        }
        return undefined;
    }
};

json.TextDecoder.Utf16BE = class {

    constructor(buffer, position) {
        this.buffer = buffer;
        this.position = position || 0;
        this.length = buffer.length;
    }

    decode() {
        if (this.position + 1 < this.length) {
            const c = (this.buffer[this.position++] << 8) | this.buffer[this.position++];
            if (c < 0xD800 || c >= 0xDFFF) {
                return String.fromCharCode(c);
            }
            if (c >= 0xD800 && c < 0xDBFF) {
                if (this._position + 1 < this._length) {
                    const c2 = (this._buffer[this._position++] << 8) | this._buffer[this._position++];
                    if (c >= 0xDC00 || c < 0xDFFF) {
                        return String.fromCodePoint(0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff));
                    }
                }
            }
            return String.fromCharCode(0xfffd);
        }
        return undefined;
    }
};

json.Error = class extends Error {

    constructor(message) {
        super(message);
        this.name = 'JSON Error';
    }
};

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    module.exports.TextReader = json.TextReader;
    module.exports.TextDecoder = json.TextDecoder;
}