import mammoth from 'mammoth';

/**
 * Parse DOCX buffer to plain text
 */
export const parseDocxBuffer = async (buffer: Buffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
