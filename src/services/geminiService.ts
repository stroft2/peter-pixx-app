/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

// Use Vite's env system (must start with VITE_)
const API_KEY = import.meta.env.VITE_API_KEY as string;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper: File → Part
const fileToPart = async (file: File) => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  if (!mimeMatch) throw new Error("Invalid MIME type");

  return {
    inlineData: {
      mimeType: mimeMatch[1],
      data: base64,
    },
  };
};

// Helper: handle Gemini responses
const handleApiResponse = (response: GenerateContentResponse, context: string): string => {
  const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

  if (imagePart?.inlineData) {
    const { mimeType, data } = imagePart.inlineData;
    return `data:${mimeType};base64,${data}`;
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    throw new Error(`Generation for ${context} stopped. Reason: ${finishReason}`);
  }

  throw new Error(`No image returned for ${context}.`);
};

// Core API call
const callImageGenerationAPI = async (originalImage: File, prompt: string, context: string) => {
  const originalImagePart = await fileToPart(originalImage);
  const textPart = { text: prompt };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: { parts: [originalImagePart, textPart] },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  return handleApiResponse(response, context);
};

// Public API wrappers
export const generateEditedImage = (img: File, userPrompt: string, hotspot: { x: number; y: number }) => {
  const prompt = `You are an expert photo editor AI. Perform a natural, localized edit around (x:${hotspot.x}, y:${hotspot.y}). User Request: "${userPrompt}".`;
  return callImageGenerationAPI(img, prompt, "edit");
};

export const generateFilteredImage = (img: File, filterPrompt: string) => {
  const prompt = `Apply a stylistic filter. Request: "${filterPrompt}".`;
  return callImageGenerationAPI(img, prompt, "filter");
};

export const removeBackgroundImage = (img: File) => {
  const prompt = "Isolate the subject. Make background fully transparent.";
  return callImageGenerationAPI(img, prompt, "background removal");
};

export const upscaleImage = (img: File) => {
  const prompt = "Upscale image, enhance details, preserve style.";
  return callImageGenerationAPI(img, prompt, "upscaling");
};

export const balanceImageColors = (img: File, colorPrompt: string) => {
  const prompt = `Adjust global colors. Request: "${colorPrompt}".`;
  return callImageGenerationAPI(img, prompt, "color balance");
};

// Example of image-from-text
export const generateImageFromPrompt = async (prompt: string): Promise<string[]> => {
  const response = await ai.models.generateImages({
    model: "imagen-4.0-generate-001",
    prompt,
    config: { numberOfImages: 4, outputMimeType: "image/png", aspectRatio: "1:1" },
  });

  return response.generatedImages?.map(img => img.image?.imageBytes || "") ?? [];
};
