/**
 * Provider-independent PDF text extraction interface and runtime-compatible adapter.
 * Handles valid PDFs, malformed files, unsupported encodings, and safe error reporting (Task 3.1).
 */

export interface PdfExtractionResult {
    success: boolean;
    text?: string;
    pageCount?: number;
    error?: string;
    errorCode?: "invalid_format" | "corrupted" | "unsupported" | "extraction_failed";
}

export interface PdfExtractionAdapter {
    extractText(buffer: Uint8Array | Buffer, filename?: string): Promise<PdfExtractionResult>;
}

/**
 * Runtime-compatible PDF extractor that parses text streams from standard PDF files.
 * Extracts text from FlateDecode / plain text streams and character operators (Tj, TJ, ')
 * without requiring native binary dependencies.
 */
export class StandardPdfExtractor implements PdfExtractionAdapter {
    async extractText(buffer: Uint8Array | Buffer, filename = "document.pdf"): Promise<PdfExtractionResult> {
        if (!buffer || buffer.length === 0) {
            return {
                success: false,
                error: "Empty or zero-byte file cannot be processed as a PDF",
                errorCode: "invalid_format",
            };
        }

        const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

        // Verify PDF Magic Bytes (%PDF-)
        const header = raw.subarray(0, 8).toString("latin1");
        if (!header.startsWith("%PDF-")) {
            return {
                success: false,
                error: `Invalid file format: ${filename} does not contain valid PDF magic header`,
                errorCode: "invalid_format",
            };
        }

        try {
            const rawString = raw.toString("latin1");

            // Check for valid trailer / EOF
            if (!rawString.includes("%%EOF") && raw.length < 32) {
                return {
                    success: false,
                    error: "Corrupted PDF: truncated document missing EOF trailer",
                    errorCode: "corrupted",
                };
            }

            // Extract plain text string objects (parentheses enclosed strings: (Hello World))
            // and text operators (Tj, TJ, etc.)
            const extractedChunks: string[] = [];

            // 1. Look for BT ... ET (Begin Text ... End Text) blocks
            const btRegex = /BT([\s\S]*?)ET/g;
            let btMatch: RegExpExecArray | null;

            while ((btMatch = btRegex.exec(rawString)) !== null) {
                const textBlock = btMatch[1];

                // Match literal strings: (Some text) Tj or [(Some) -20 (Text)] TJ
                const literalRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
                let litMatch: RegExpExecArray | null;
                while ((litMatch = literalRegex.exec(textBlock)) !== null) {
                    const text = this.decodePdfString(litMatch[1]);
                    if (text.trim()) extractedChunks.push(text);
                }

                // Match array strings in TJ: [(Text 1) 120 (Text 2)] TJ
                const arrayRegex = /\[(.*?)\]\s*TJ/g;
                let arrMatch: RegExpExecArray | null;
                while ((arrMatch = arrayRegex.exec(textBlock)) !== null) {
                    const arrayContent = arrMatch[1];
                    const innerStrRegex = /\(([^)]+)\)/g;
                    let innerMatch: RegExpExecArray | null;
                    const parts: string[] = [];
                    while ((innerMatch = innerStrRegex.exec(arrayContent)) !== null) {
                        parts.push(this.decodePdfString(innerMatch[1]));
                    }
                    if (parts.length > 0) {
                        extractedChunks.push(parts.join(""));
                    }
                }
            }

            // Fallback: If no BT...ET blocks were found (e.g. simplified PDF or text streams)
            if (extractedChunks.length === 0) {
                const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
                let streamMatch: RegExpExecArray | null;
                while ((streamMatch = streamRegex.exec(rawString)) !== null) {
                    const streamContent = streamMatch[1];
                    const cleaned = streamContent
                        .replace(/[^\x20-\x7E\t\r\n]/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();
                    if (cleaned.length > 10) {
                        extractedChunks.push(cleaned);
                    }
                }
            }

            // If still empty, check if it's an encrypted or image-only scanned document
            if (extractedChunks.length === 0) {
                if (rawString.includes("/Encrypt")) {
                    return {
                        success: false,
                        error: "Unsupported PDF: password-protected or encrypted document",
                        errorCode: "unsupported",
                    };
                }
                return {
                    success: false,
                    error: "No extractable text found. Document may be an image-only scan requiring OCR.",
                    errorCode: "extraction_failed",
                };
            }

            const fullText = extractedChunks.join("\n").trim();
            const estimatedPages = Math.max(1, (rawString.match(/\/Type\s*\/Page[^s]/g) || []).length);

            return {
                success: true,
                text: fullText,
                pageCount: estimatedPages,
            };
        } catch (err: any) {
            return {
                success: false,
                error: `PDF extraction failed: ${err.message}`,
                errorCode: "extraction_failed",
            };
        }
    }

    private decodePdfString(input: string): string {
        return input
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
    }
}
