// TODO: Add error handling, Fallbacks, DB connection, etc, 

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Multer config
const upload = multer({ dest: 'uploads/' });

// CORS
app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

// Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Wait for Mathpix PDF processing
async function waitForPdfCompletion(pdf_id) {
    const headers = {
        'app_id': process.env.MATHPIX_APP_ID,
        'app_key': process.env.MATHPIX_APP_KEY
    };
    let status = '';
    do {
        await new Promise(r => setTimeout(r, 2000));
        const res = await axios.get(`https://api.mathpix.com/v3/pdf/${pdf_id}`, { headers });
        status = res.data.status;
        console.log(`PDF status: ${status} (${res.data.num_pages_completed || 0}/${res.data.num_pages || 0})`);
    } while (status !== 'completed');
    return true;
}

// Function to structure Mathpix data via Gemini
async function structureExamData(mathpixResponse) {
    try {
        const prompt = `
You are an expert in formatting educational content, including physics and mathematics. I will provide you with a JSON containing OCR-extracted text from a question paper. The JSON includes pages, lines, text blocks, and diagrams, but the content is messy and contains raw text, LaTeX-style math formulas, and question/answer markers.

Your task is to:

1. Produce a clean, **human-readable formatted version** of the entire content.
2. Preserve **all math equations exactly as they are**, using LaTeX format if present.
3. Convert MCQs into a readable list format:
   - For example:
     (1) 5:7
     (2) 3:5
     (3) √3:√5
4. Keep headers like Subject, Topic, Subtopic, Exam, Question Number, Question Type, and Keywords.
5. Include diagrams in Markdown image format as provided in "text_display".
6. Remove any unnecessary raw markers like \####, \#*, \#, or escape characters unless they are part of the LaTeX/math syntax.
7. Produce **one continuous document per page** in a readable format.
8. check If Image link is provided then only send the exact link in image key no extra text. like I am getting the image link like ![](https://cdn.mathpix.com/cropped/2025_09_21_9b4936fa34f5f42c2072g-1.jpg?height=320&width=347&top_left_y=1993&top_left_x=1561) so need on url with its params no extra text.
9. Check if the data is in tabular form or any other format.

Format the output like this:


- Output JSON format:

{
  "subject": "...",
  "topic": "...",
  "subTopic": "...",
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "image": "...", 
      "hint": "..."
    }
  ]
}

Input JSON:
${JSON.stringify(mathpixResponse)}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        subject: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        subTopic: { type: Type.STRING },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    question: { type: Type.STRING },
                                    options: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING },
                                    },
                                    image: { type: Type.STRING, nullable: true },
                                    hint: { type: Type.STRING, nullable: true },
                                },
                                propertyOrdering: ["question", "options", "image", "hint"],
                            },
                        },
                    },
                    propertyOrdering: ["subject", "topic", "subTopic", "questions"],
                },
            },
        });

        // Gemini returns text, parse as JSON
        // console.log("response from generateContent",response);
        
        return JSON.parse(response.text);
    } catch (err) {
        console.error("Gemini structuring error:", err);
        return null;
    }
}


// Test API ( put hardcodedInput (use data from dummyjson in server folder) object in server /test API )
app.get('/test', async (req, res) => {
    const hardcodedInput =  {
    }
    const structuredData = await structureExamData(hardcodedInput);

    if (structuredData) res.json(structuredData);
    else res.status(500).json({ error: "Failed to structure data" });
});


// Upload & extract PDF
app.post('/upload', upload.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded');
    try {
        const options = {
            conversion_formats: { docx: true },
            math_inline_delimiters: ["$", "$"],
            rm_spaces: true
        };
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));
        formData.append('options_json', JSON.stringify(options));

        // Upload PDF to Mathpix
        const uploadResponse = await axios.post('https://api.mathpix.com/v3/pdf', formData, {
            headers: {
                ...formData.getHeaders(),
                'app_id': process.env.MATHPIX_APP_ID,
                'app_key': process.env.MATHPIX_APP_KEY
            }
        });

        const pdf_id = uploadResponse.data.pdf_id;
        console.log(`PDF uploaded. ID: ${pdf_id}`);

        // Wait until PDF is fully processed
        await waitForPdfCompletion(pdf_id);

        // Fetch Mathpix lines JSON
        const mmdResponse = await axios.get(`https://api.mathpix.com/v3/pdf/${pdf_id}.lines.json`, {
            headers: {
                'app_id': process.env.MATHPIX_APP_ID,
                'app_key': process.env.MATHPIX_APP_KEY
            }
        });
        // Remove uploaded file
        fs.unlinkSync(req.file.path);
        // Structure JSON with Gemini (convert LaTeX to readable format)
        const structuredData = await structureExamData(mmdResponse.data);
        res.json(structuredData);

    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).send('Error processing PDF');
    }
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});