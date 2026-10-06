/**
 * Universal Gemini API key validator.
 * Uses window.electronAPI when running in Electron,
 * or direct Google AI Studio API call when previewing in web browser.
 */
export async function validateGeminiKey(apiKey: string, model: string = 'gemini-1.5-flash'): Promise<{ valid: boolean; error?: string; model?: string }> {
  if (typeof window !== 'undefined' && window.electronAPI?.gemini?.validateKey) {
    return window.electronAPI.gemini.validateKey(apiKey);
  }

  const key = apiKey.trim();

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    const data = await res.json() as {
      models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
      error?: { code: number; message: string };
    };

    if (data.error) {
      const errMsg = data.error.message || '';
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('not valid') || data.error.code === 400 || data.error.code === 401) {
        return { valid: false, error: 'Invalid API key. Please check your key from Google AI Studio.' };
      }
      return { valid: false, error: errMsg };
    }

    if (Array.isArray(data.models) && data.models.length > 0) {
      const contentModels = data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      const bestModel = contentModels.find(m => m.includes('1.5-flash')) ||
                        contentModels.find(m => m.includes('flash')) ||
                        contentModels.find(m => m.includes('gemini')) ||
                        contentModels[0] ||
                        model;

      return { valid: true, model: bestModel };
    }

    return { valid: false, error: 'No compatible model found for this key.' };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Network connection failed' };
  }
}
