/**
 * OpenRouter API Client Service for BGI Content Studio
 * Used for image generation with supported models.
 * 
 * Different models on OpenRouter have different parameter schemas.
 * This service dynamically builds the correct request body per model.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Model-specific parameter presets for OpenRouter image generation.
 * Each model has its own supported parameters (queried from OpenRouter's API).
 */
const MODEL_PRESETS = {
  'sourceful/riverflow-v2.5-fast': {
    // Uses resolution (1K/2K), output_format (webp), background, n (max 1)
    // Also supports input_references (array, 0-4) for image-to-image
    resolution: '1K',
    output_format: 'webp',
    background: 'auto',
    n: 1,
  },
  'x-ai/grok-imagine-image-quality': {
    // Uses resolution (1K/2K), aspect_ratio, n (max 1)
    // Also supports input_references (array, 0-3) for image-to-image
    resolution: '1K',
    aspect_ratio: '1:1',
    n: 1,
  },
};

/**
 * Build the correct request body for a given OpenRouter model.
 * Different models require different parameters.
 * If a referenceImage is provided, it's sent as an input_references array for img2img.
 */
function buildRequestBody({ prompt, model, resolution, aspectRatio, referenceImage }) {
  const base = {
    model,
    prompt,
  };

  const preset = MODEL_PRESETS[model];

  if (!preset) {
    // Fallback for unknown models
    const body = { ...base, n: 1 };
    if (referenceImage) {
      body.input_references = [{ type: 'image_url', image_url: { url: referenceImage } }];
    }
    return body;
  }

  // Build parameters based on model preset
  const params = { ...preset };

  // Override resolution if user selected a different one
  if (resolution) {
    params.resolution = resolution;
  }

  // Override aspect_ratio for models that support it
  if (aspectRatio && MODEL_PRESETS[model]?.aspect_ratio !== undefined) {
    params.aspect_ratio = aspectRatio;
  }

  // Add reference image as input_references if provided (for img2img)
  if (referenceImage) {
    params.input_references = [{ type: 'image_url', image_url: { url: referenceImage } }];
  }

  // For sourceful/riverflow-v2.5-fast, wrap params under a "parameters" key
  if (model === 'sourceful/riverflow-v2.5-fast') {
    return {
      ...base,
      parameters: params,
    };
  }

  // For other models, spread params directly at top level
  return {
    ...base,
    ...params,
  };
}

/**
 * Generate an image using OpenRouter's image generation API.
 * Supports text-to-image (prompt only) and image-to-image (prompt + reference image).
 * @param {object} params
 * @param {string} params.prompt - The image prompt (in English)
 * @param {string} params.model - The model ID (e.g., 'sourceful/riverflow-v2.5-fast')
 * @param {string} params.resolution - Image resolution ('1K' or '2K') (default '1K')
 * @param {string} params.aspectRatio - Aspect ratio for models that support it (e.g., '1:1', '16:9') (default depends on model)
 * @param {string} params.referenceImage - Optional base64 data URL of reference image for img2img
 * @returns {Promise<{success: boolean, data: Array<{b64_json: string}>, error?: string}>}
 */
export async function generateImageWithOpenRouter({ prompt, model, resolution = '1K', aspectRatio, referenceImage }) {
  const apiKey = localStorage.getItem('bgi_openrouter_api_key');

  if (!apiKey) {
    throw new Error('API Key OpenRouter belum diatur. Silakan pergi ke menu Pengaturan untuk mengisinya.');
  }

  const url = `${OPENROUTER_BASE_URL}/images`;

  const requestBody = buildRequestBody({ prompt, model, resolution, aspectRatio, referenceImage });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || errorData?.message || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.data || [],
    };
  } catch (error) {
    console.error('OpenRouter Image Generation Error:', error);
    throw error;
  }
}

/**
 * Detect MIME type from image magic bytes.
 * @param {Uint8Array} bytes - The decoded image bytes
 * @returns {string} The MIME type string
 */
function detectMimeType(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  return 'image/png'; // fallback
}

/**
 * Convert a base64 image string to a blob URL for display.
 * Auto-detects the image MIME type from the raw bytes.
 * @param {string} b64Json - The base64 string from OpenRouter response
 * @returns {string} A blob URL that can be used as img src
 */
export function base64ToBlobUrl(b64Json) {
  const byteCharacters = atob(b64Json);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const mimeType = detectMimeType(byteArray);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}
