/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen due to safety filters or if the request is too complex. Please try rephrasing your prompt to be more direct.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

const callImageGenerationAPI = async (
    originalImage: File,
    prompt: string,
    context: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY! });
    const originalImagePart = await fileToPart(originalImage);
    const textPart = { text: prompt };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    return handleApiResponse(response, context);
}

export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    hotspot: { x: number, y: number }
): Promise<string> => {
    const prompt = `You are an expert photo editor AI. Perform a natural, localized edit on the image based on the user's request.
User Request: "${userPrompt}"
Edit Location: Focus on the area around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).
The rest of the image must remain identical. Blend the edit seamlessly.
Return ONLY the final edited image. Do not return text.`;
    return callImageGenerationAPI(originalImage, prompt, 'edit');
};

export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    const prompt = `You are an expert photo editor AI. Apply a stylistic filter to the entire image. Do not change composition.
Filter Request: "${filterPrompt}"
Return ONLY the final filtered image. Do not return text.`;
    return callImageGenerationAPI(originalImage, prompt, 'filter');
};

export const removeBackgroundImage = async (
    originalImage: File
): Promise<string> => {
    const prompt = `You are an expert photo editor AI. Your task is to accurately isolate the main subject from the background. Make the background fully transparent.
Return ONLY the final image with the transparent background. Do not return text.`;
    return callImageGenerationAPI(originalImage, prompt, 'background removal');
}

export const upscaleImage = async (
    originalImage: File
): Promise<string> => {
    const prompt = `You are an expert photo editor AI. Upscale this image to a higher resolution, enhancing details and sharpness without adding unnatural artifacts. Maintain the original art style.
Return ONLY the final upscaled image. Do not return text.`;
    return callImageGenerationAPI(originalImage, prompt, 'upscaling');
}

export const balanceImageColors = async (
    originalImage: File,
    colorPrompt: string
): Promise<string> => {
    const prompt = `You are an expert photo editor AI. Perform a natural, global color adjustment to the entire image based on the user's request.
User Request: "${colorPrompt}"
Return ONLY the final color-adjusted image. Do not return text.`;
    return callImageGenerationAPI(originalImage, prompt, 'color balance');
}

export const generateImageFromPrompt = async (
    prompt: string
): Promise<string[]> => {
    console.log(`Starting image generation for prompt: ${prompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
          numberOfImages: 4,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
    });
    console.log('Received response from Imagen model.', response);
    
    return response.generatedImages.map(img => img.image.imageBytes);
};

export const generateVideoFromPrompt = async (
    prompt: string
): Promise<any> => {
    console.log(`Starting video generation for prompt: ${prompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const operation = await ai.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt: prompt,
      config: {
        numberOfVideos: 1
      }
    });

    console.log('Started video generation operation.', operation);
    return operation;
};

export const checkVideoOperationStatus = async (
    operation: any
): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    return await ai.operations.getVideosOperation({ operation: operation });
};

export const enhancePrompt = async (
    idea: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const systemInstruction = `You are an expert AI prompt engineer for a text-to-image model. Your task is to take a user's simple idea and rewrite it into a rich, detailed, and visually descriptive prompt. 
Focus on adding details about the subject, environment, lighting, and artistic style. 
The output must be a single, concise paragraph. Respond with ONLY the new prompt and nothing else.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: idea,
        config: {
            systemInstruction,
        },
    });

    return response.text.trim();
};

export const analyzeVideoFrame = async (
    base64ImageData: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64ImageData,
        },
    };
    const textPart = {
        text: "You are a visual analysis AI. Describe the contents of this image in a concise and informative paragraph. Focus on the main subject, setting, and any notable actions or details.",
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
    });
    
    return response.text.trim();
};