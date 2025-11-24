// ==UserScript==
// @name         Sunspace Projects Override (TEST ENV)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Override /projects API response for testing
// @author       Ассизи
// @match        https://app.sunspacecrm.com.br/*
// @run-at       document-start
// @grant        none

// @updateURL    https://raw.githubusercontent.com/assisjp/tamper-sun/master/sunspace-override.user.js
// @downloadURL  https://raw.githubusercontent.com/assisjp/tamper-sun/master/sunspace-override.user.js
// ==/UserScript==

(function () {
    const TARGET_URL = "https://api.sunspacecrm.com.br/project";

    function log(...args) {
        console.log("[TM Projects Override]", ...args);
    }

    // ------------ Helpers ------------
    function fakeSubscription(project) {
        const now = new Date();
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return {
            ...project,
            stripe_subscription_status: "active",
            trial_end: null,
            current_period_start: start.toISOString(),
            current_period_end: end.toISOString(),
            stripe_subscription_payment: {
                last_payment_status: "succeeded",
                last_payment_at: start.toISOString()
            }
        };
    }

    function patchProjectsJSON(original) {
        try {
            if (!Array.isArray(original)) return original;
            return original.map(fakeSubscription);
        } catch (e) {
            log("Erro ao patchar JSON:", e);
            return original;
        }
    }

    // ------------ Intercept fetch ------------
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        const url = (typeof input === "string" ? input : input.url) || "";

        const response = await originalFetch(input, init);

        if (!url.includes(TARGET_URL)) {
            return response;
        }

        log("Interceptando fetch:", url);

        try {
            const cloned = response.clone();
            const text = await cloned.text();

            let json = JSON.parse(text);
            json = patchProjectsJSON(json);
            const newText = JSON.stringify(json);

            return new Response(newText, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });

        } catch (e) {
            log("Erro alterando fetch:", e);
            return response;
        }
    };

    // ------------ Intercept XHR ------------
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this.__overrideProjects = url.includes(TARGET_URL);
        return open.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
        if (this.__overrideProjects) {
            this.addEventListener("readystatechange", function () {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        const text = this.responseText;
                        const json = patchProjectsJSON(JSON.parse(text));
                        const newText = JSON.stringify(json);

                        Object.defineProperty(this, "responseText", { value: newText });
                        Object.defineProperty(this, "response", { value: newText });

                        log("XHR /projects substituído");
                    } catch (e) {
                        log("Erro no XHR:", e);
                    }
                }
            });
        }
        return send.apply(this, arguments);
    };

    log("Userscript carregado e rodando.");
})();
