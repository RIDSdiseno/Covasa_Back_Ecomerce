"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorApi = void 0;
class ErrorApi extends Error {
    constructor(message, status = 500, details, code) {
        super(message);
        this.status = status;
        this.details = details;
        this.code = code;
    }
}
exports.ErrorApi = ErrorApi;
