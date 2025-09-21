// TODO: Add error handling, Fallbacks, loading states, styling, tags conditions, HTML to PDF converter.
import React, { useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import "./PdfOcrViewer.css";

const PdfOcrViewer = () => {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_URL = import.meta.env.VITE_API_URL;
  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Error extracting PDF");

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // Test API ( put hardcodedInput (use data from dummyjson in server folder) object in server /test API )
  const handleTestApi = async () => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch("http://localhost:3000/test", {
        method: "GET",
      });

      if (!res.ok) throw new Error("Test API call failed");

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError(err.message || "Test API failed");
    } finally {
      setLoading(false);
    }
  };

  const renderLatex = (content) => {
    if (!content) return null;
    let latex = content.trim();
    // Remove surrounding block delimiters \[...\] and inline $...$
    // We will split inline and block properly
    const parts = [];
    // Match block math first
    const blockRegex = /\\\[(.+?)\\\]/gs;
    let lastIndex = 0;
    let match;

    while ((match = blockRegex.exec(latex)) !== null) {
      // Text before block → may contain inline
      const before = latex.substring(lastIndex, match.index).trim();
      if (before) {
        // extract inline $...$ from before
        const inlineParts = [];
        let inlineMatch;
        const inlineRegex = /\$(.+?)\$/g;
        let inlineLast = 0;
        while ((inlineMatch = inlineRegex.exec(before)) !== null) {
          // text before inline → fallback
          if (inlineMatch.index > inlineLast) {
            const plain = before
              .substring(inlineLast, inlineMatch.index)
              .trim();
            if (plain) inlineParts.push({ type: "plain", math: plain });
          }
          inlineParts.push({ type: "inline", math: inlineMatch[1].trim() });
          inlineLast = inlineMatch.index + inlineMatch[0].length;
        }
        // remaining text after last inline
        if (inlineLast < before.length) {
          const plain = before.substring(inlineLast).trim();
          if (plain) inlineParts.push({ type: "plain", math: plain });
        }

        parts.push(...inlineParts);
      }

      // block math
      parts.push({ type: "block", math: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }

    // remaining text after last block
    if (lastIndex < latex.length) {
      const remaining = latex.substring(lastIndex).trim();
      if (remaining) {
        // extract inline
        const inlineParts = [];
        let inlineMatch;
        const inlineRegex = /\$(.+?)\$/g;
        let inlineLast = 0;
        while ((inlineMatch = inlineRegex.exec(remaining)) !== null) {
          if (inlineMatch.index > inlineLast) {
            const plain = remaining
              .substring(inlineLast, inlineMatch.index)
              .trim();
            if (plain) inlineParts.push({ type: "plain", math: plain });
          }
          inlineParts.push({ type: "inline", math: inlineMatch[1].trim() });
          inlineLast = inlineMatch.index + inlineMatch[0].length;
        }
        if (inlineLast < remaining.length) {
          const plain = remaining.substring(inlineLast).trim();
          if (plain) inlineParts.push({ type: "plain", math: plain });
        }

        parts.push(...inlineParts);
      }
    }

    // Render
    return parts.map((p, i) => {
      if (p.type === "block") return <BlockMath key={i} math={p.math} />;
      if (p.type === "inline") return <InlineMath key={i} math={p.math} />;
      return <span key={i}>{p.math}</span>; // fallback plain text
    });
  };
  console.log("data", data);

  return (
    <div className="pdf-ocr-container">
      <header className="header">
        <h1>PDF OCR</h1>
        <p>Upload a PDF or call test API to extract questions and answers.</p>
      </header>

      <div className="upload-section">
        <form onSubmit={handleSubmit} className="upload-form">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="file-input"
          />
          <button
            type="submit"
            className="upload-btn"
            disabled={loading || !file}
          >
            {loading ? "Processing..." : "Upload & Extract"}
          </button>
        </form>

        <button onClick={handleTestApi} className="test-btn" disabled={loading}>
          {loading ? "Testing..." : "Call Test API"}
        </button>

        {loading && <div className="spinner"></div>}
        {error && <p className="error-message">{error}</p>}
      </div>

      <div className="content-section">
        <h2>Extracted Questions</h2>
        {data && data.questions?.length > 0 ? (
          <div className="questions-list">
            {data.questions.map((q, idx) => (
              <div key={idx} className="question-item">
                <p className="question-text">
                  <b>Q{idx + 1}:</b> {renderLatex(q.question)}
                </p>
                <div className="opt-diagram-container">
                  <ol type="1" className="options-list">
                    {q.options?.map((opt, oIdx) => (
                      <li key={oIdx} className="option-item">
                        {renderLatex(opt)}
                      </li>
                    ))}
                  </ol>

                  {q.image && (
                    <div className="question-image-container">
                      <img
                        src={q.image}
                        alt={`Question ${idx + 1}`}
                        className="question-image"
                      />
                    </div>
                  )}
                </div>

                {q.hint && (
                  <p className="hint-text">
                    <i>Hint: {renderLatex(q.hint)}</i>
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="placeholder-text">
            No content extracted yet. Please upload a PDF or call test API.
          </p>
        )}
      </div>
    </div>
  );
};

export default PdfOcrViewer;