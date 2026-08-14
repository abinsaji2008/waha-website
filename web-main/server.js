const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let WAHA_URL = process.env.WAHA_URL || "";
let WAHA_API_KEY = process.env.WAHA_API_KEY || "";

function baseUrl() {
    return WAHA_URL.replace(/\/+$/, "");
}

async function waha(endpoint, options = {}) {

    const response = await fetch(baseUrl() + endpoint, {
        ...options,

        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Api-Key": WAHA_API_KEY,
            ...(options.headers || {})
        }
    });

    const text = await response.text();

    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `WAHA error ${response.status}`
        );
    }

    return data;
}


/* GET CONFIG */

app.get("/api/config", (req, res) => {

    res.json({
        url: WAHA_URL,
        apiKeySet: Boolean(WAHA_API_KEY)
    });

});


/* SAVE CONFIG */

app.post("/api/config", (req, res) => {

    const { url, apiKey } = req.body;

    if (!url) {
        return res.status(400).json({
            error: "WAHA URL required"
        });
    }

    WAHA_URL = url.replace(/\/+$/, "");

    if (apiKey !== undefined && apiKey !== "") {
        WAHA_API_KEY = apiKey;
    }

    res.json({
        success: true,
        url: WAHA_URL
    });

});


/* TEST */

app.get("/api/test", async (req, res) => {

    try {

        const data = await waha("/api/sessions");

        res.json({
            success: true,
            sessions: data
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});


/* SESSIONS */

app.get("/api/sessions", async (req, res) => {

    try {

        const data = await waha("/api/sessions");

        res.json(data);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});


/* CHECK NUMBER */

app.get("/api/check", async (req, res) => {

    try {

        const phone =
            String(req.query.phone || "")
                .replace(/\D/g, "");

        const session =
            req.query.session || "default";

        if (!phone) {
            return res.status(400).json({
                error: "Phone number required"
            });
        }

        const data = await waha(
            `/api/contacts/check-exists` +
            `?phone=${encodeURIComponent(phone)}` +
            `&session=${encodeURIComponent(session)}`
        );

        res.json(data);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});


/* CONTACTS */

app.get("/api/contacts", async (req, res) => {

    try {

        const session =
            req.query.session || "default";

        const data = await waha(
            `/api/contacts/all` +
            `?session=${encodeURIComponent(session)}` +
            `&limit=100`
        );

        res.json(data);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});


/* SEND MESSAGE */

app.post("/api/send", async (req, res) => {

    try {

        const {
            session = "default",
            phone,
            text
        } = req.body;

        if (!phone) {
            return res.status(400).json({
                error: "Phone number required"
            });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({
                error: "Message required"
            });
        }


        const cleanPhone =
            String(phone).replace(/\D/g, "");


        /* Check WhatsApp */

        const check = await waha(
            `/api/contacts/check-exists` +
            `?phone=${encodeURIComponent(cleanPhone)}` +
            `&session=${encodeURIComponent(session)}`
        );


        if (check.numberExists === false) {

            return res.status(400).json({
                error: "This number is not registered on WhatsApp"
            });

        }


        const chatId =
            check.chatId ||
            `${cleanPhone}@c.us`;


        /* Send */

        const result = await waha(
            "/api/sendText",
            {
                method: "POST",

                body: JSON.stringify({
                    session,
                    chatId,
                    text
                })
            }
        );


        res.json({
            success: true,
            result
        });


    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

});


/* HEALTH */

app.get("/health", (req, res) => {

    res.json({
        status: "online"
    });

});


const PORT =
    process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log(
        `WAHA Panel running on port ${PORT}`
    );

});
