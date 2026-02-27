import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

export async function analyzeGenesisImage(base64Data: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-flash-lite-latest",
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
      {
        text: `分析这张图片。它是新数字宠物的“基础基因”。
        1. 提取其核心材质和特征（例如：柔软、金属、有机）。
        2. 基于此定义一个“世界观”或主题（例如：“纺织荒野”）。
        3. 生成正好3个寻物任务，让用户在现实世界中寻找互补的材料来喂养胚胎。
        返回JSON。`,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING, description: "世界观主题" },
          description: { type: Type.STRING, description: "世界观的描述" },
          baseTraits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "提取的核心特征" },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                requirement: { type: Type.STRING, description: "所需材料的简短名称，例如：'坚硬的金属'" },
                description: { type: Type.STRING, description: "任务描述，例如：'它太软了，需要一点坚硬的金属。请拍一张金属物。'" },
              },
              required: ["id", "requirement", "description"],
            },
            description: "正好3个任务",
          },
        },
        required: ["theme", "description", "baseTraits", "tasks"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function verifyFeedImage(taskRequirement: string, base64Data: string, mimeType: string, isDebug: boolean = false) {
  if (isDebug) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { data: base64Data, mimeType } },
        { text: `用户上传了一张图片作为 "${taskRequirement}"。在调试模式下，我们假设它总是成功的。请根据这张图片的内容，描述宠物胚胎发生了怎样的变异（例如：“它长出了金属爪子”）。返回JSON。` },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN },
            message: { type: Type.STRING },
            mutationEffect: { type: Type.STRING },
          },
          required: ["success", "message", "mutationEffect"],
        },
      },
    });
    const result = JSON.parse(response.text || "{}");
    return { success: true, message: "【调试模式】强制通过！" + (result.message || ""), mutationEffect: result.mutationEffect || "发生了未知的变异" };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
      {
        text: `要求用户寻找："${taskRequirement}"。
        这张图片是否合理地符合要求？请宽容但合理地判断。
        如果符合，描述宠物胚胎发生了怎样的变异（例如：“它长出了金属爪子”）。
        返回JSON。`,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          success: { type: Type.BOOLEAN },
          message: { type: Type.STRING, description: "给用户的反馈" },
          mutationEffect: { type: Type.STRING, description: "如果成功，描述变异效果" },
        },
        required: ["success", "message"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateEmbryoSVG(baseTraits: string[], mutations: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `生成一个简单的、抽象的SVG剪影（纯黑色填充，无背景），代表一个具有以下特征的生物胚胎：
      基础特征：${baseTraits.join(", ")}
      变异：${mutations.join(", ")}
      
      要求：
      1. viewBox 必须是 "0 0 200 200"。
      2. 整体形状应该是一个连贯的单色轮廓（剪影）。
      3. 随着变异的增加，形状应该变得更复杂或长出相应的器官（如刺、触手、棱角等）。
      4. 必须返回有效的SVG代码字符串。
      返回JSON。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          svg: { type: Type.STRING, description: "包含完整 <svg> 标签的纯文本字符串" },
        },
        required: ["svg"],
      },
    },
  });

  return JSON.parse(response.text || "{}").svg;
}

export async function generateFinalPetStats(
  baseTraits: string[],
  mutations: string[],
  environment: { time: string; weather: string; temp: number }
) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `基于以下基因生成最终的宠物：
      基础特征：${baseTraits.join(", ")}
      变异：${mutations.join(", ")}
      环境：时间：${environment.time}，天气：${environment.weather}，温度：${environment.temp}°C

      有15%的几率发生“基因崩溃”（失败）。
      如果失败，请选择一种类型：“slime”（消化不良/史莱姆化）、“abomination”（基因错乱/缝合怪）、“minimalist”（大智若愚/极简废物）。
      返回JSON。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isFailure: { type: Type.BOOLEAN },
          failureType: { type: Type.STRING, description: "none, slime, abomination, 或 minimalist" },
          name: { type: Type.STRING, description: "宠物名称" },
          description: { type: Type.STRING, description: "有趣/酷炫的描述" },
          stats: {
            type: Type.OBJECT,
            properties: {
              hp: { type: Type.NUMBER },
              atk: { type: Type.NUMBER },
              def: { type: Type.NUMBER },
              spd: { type: Type.NUMBER },
            },
            required: ["hp", "atk", "def", "spd"],
          },
          imagePrompt: {
            type: Type.STRING,
            description: "生成此宠物图像的极其详细的英文提示词(Prompt)。如果失败，请根据失败类型使其看起来很滑稽。如果成功，请使其看起来史诗般，并在指定环境中结合基础特征和变异。",
          },
        },
        required: ["isFailure", "failureType", "name", "description", "stats", "imagePrompt"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function generateFinalPetImage(prompt: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        text: prompt,
      },
    ],
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate image");
}
