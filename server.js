const express = require('express');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for your frontend domain
app.use(cors({ origin: 'https://www.peaceinpoetry.com' }));
app.use(express.json());

// ⚠️ Load the service account key from the environment variable
const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Serve static frontend files (if you want to serve them from the same backend)
// app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to create a new trip spreadsheet
app.post('/create-trip', async (req, res) => {
    try {
        const { participants } = req.body;
        
        const createResponse = await sheets.spreadsheets.create({
            resource: {
                properties: { title: `SplitBills Trip - ${new Date().toLocaleString()}` },
                sheets: [{ properties: { title: 'Participants' } }, { properties: { title: 'Expenses' } }]
            },
        });
        const spreadsheetId = createResponse.data.spreadsheetId;

        const batchUpdateResponse = await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                valueInputOption: 'RAW',
                data: [
                    { range: 'Expenses!A1:E1', values: [['ID', 'Description', 'Amount', 'Payer', 'SplitBetween']] },
                    { range: 'Participants!A1', values: participants.map(name => [name]) }
                ]
            }
        });

        res.json({ spreadsheetId });
    } catch (err) {
        console.error('Error creating trip:', err);
        res.status(500).json({ error: 'Failed to create trip.' });
    }
});

// API endpoint to get participants
app.get('/get-participants', async (req, res) => {
    try {
        const { spreadsheetId } = req.query;
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Participants!A:A' });
        const participants = response.data.values ? response.data.values.flat() : [];
        res.json(participants);
    } catch (err) {
        console.error('Error getting participants:', err);
        res.status(500).json({ error: 'Failed to get participants.' });
    }
});

// API endpoint to get expenses
app.get('/get-expenses', async (req, res) => {
    try {
        const { spreadsheetId } = req.query;
        const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Expenses!A2:E' });
        if (!response.data.values) {
            return res.json([]);
        }
        const expenses = response.data.values.map(row => ({
            id: row[0],
            description: row[1],
            amount: parseFloat(row[2]),
            payer: row[3],
            splitBetween: row[4].split(','),
        }));
        res.json(expenses);
    } catch (err) {
        console.error('Error getting expenses:', err);
        res.status(500).json({ error: 'Failed to get expenses.' });
    }
});

// API endpoint to add an expense
app.post('/add-expense', async (req, res) => {
    try {
        const { spreadsheetId, description, amount, payer, splitBetween } = req.body;
        
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Expenses!A:E',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[new Date().getTime(), description, amount, payer, splitBetween.join(',')]] },
        });

        res.status(200).json({ message: 'Expense added successfully.' });
    } catch (err) {
        console.error('Error adding expense:', err);
        res.status(500).json({ error: 'Failed to add expense.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
