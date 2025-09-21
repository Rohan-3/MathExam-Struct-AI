# MathExam-Struct-AI

**MathExam-Struct-AI** is a Node.js + React application that transforms messy exam PDFs with equations, diagrams, and MCQs into **clean, structured digital question papers**.  
It leverages **Mathpix OCR** for accurate math/diagram extraction and **Google Gemini AI** for formatting, delivering AI-ready content for educators and institutes.

---

## 🚀 Features
- Extracts text, equations, and diagrams from exam PDFs.  
- Structures questions, options, and hints into a clean format.  
- Generates AI-ready content for digital platforms.  
- Node.js backend + React frontend for a smooth workflow.  

---

## ⚙️ Installation & Setup  

### 1️⃣ Backend (Server)
```bash
cd server
cp .env.example .env
npm install
node server.js 

```
### 2️⃣ Frontend (Server)
```bash
cd client
cp .env.example .env
npm install
npm run dev 