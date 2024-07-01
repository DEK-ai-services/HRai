const express = require('express');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

const app = express();
const PORT = 3000;

const OPENAI_API_KEY = 'sk-proj-9oS8noc8BP9YajI2ECy2T3BlbkFJEUZ2heKDMLvHMsvIzG06'; // Nahraďte svým API klíčem
const ASSISTANT_ID = 'asst_EdbSuGBDHiqtVCRNbZ890m3K';

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

app.use(bodyParser.json());
app.use(express.static('public'));

// Mapa pro ukládání thread ID pro každého uživatele
const userThreads = new Map();

app.post('/api/message', async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.ip; // Použijeme IP adresu jako identifikátor uživatele

    try {
        // Získáme nebo vytvoříme thread pro uživatele
        let threadId = userThreads.get(userId);
        if (!threadId) {
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            userThreads.set(userId, threadId);
        }

        // Přidáme zprávu uživatele do threadu
        await openai.beta.threads.messages.create(threadId, {
            role: 'user',
            content: userMessage
        });

        // Spustíme asistenta
        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: ASSISTANT_ID
        });

        // Počkáme na dokončení běhu
        let runStatus;
        do {
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
            if (runStatus.status === 'failed') {
                throw new Error('Assistant run failed');
            }
            if (runStatus.status !== 'completed') {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Počkáme 1 sekundu před dalším dotazem
            }
        } while (runStatus.status !== 'completed');

        // Získáme odpověď asistenta
        const messages = await openai.beta.threads.messages.list(threadId);
        const assistantMessage = messages.data[0].content[0].text.value;

        res.json({ response: assistantMessage });
    } catch (error) {
        console.error('Error communicating with OpenAI API:', error);
        res.status(500).json({ error: 'Error communicating with OpenAI API' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});