import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

// Optional OpenAI setup (Demo Mode if key missing)
let openai: OpenAI | null = null;

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.log("⚠ OPENAI KEY NOT FOUND — Running in AI DEMO MODE");
} else {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.grading.grade.path, async (req, res) => {
    try {
      const input = api.grading.grade.input.parse(req.body);

      let aiResult;

      // 🤖 REAL AI (only if key exists)
      if (openai) {
        const prompt = `
          You are an agricultural expert grading ${input.produceType}. 
          Analyze the attached image and provide a grading report.
          Return JSON with: grade, confidence, analysis.
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${input.image}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("AI returned empty response");
        aiResult = JSON.parse(content);

      } else {
        // 🧠 DEMO AI RESPONSE
        aiResult = {
          grade: "Grade A",
          confidence: 94,
          analysis: {
            visual_defects: ["Minor surface spots"],
            color: "Uniform and healthy",
            size_estimate: "Medium to large",
            observations:
              "Crop appears fresh, well-grown, and suitable for premium market distribution.",
          },
        };
      }

      // Save (storage may be prototype memory mode)
      const report = await storage.createGradingReport({
        imageUrl: `data:image/jpeg;base64,${input.image}`,
        produceType: input.produceType,
        grade: aiResult.grade,
        confidence: aiResult.confidence,
        analysis: aiResult.analysis,
      });

      res.status(201).json(report);

    } catch (err) {
      console.error("Grading error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      } else {
        res.status(500).json({ message: "Internal server error during grading" });
      }
    }
  });

  app.get(api.grading.list.path, async (req, res) => {
    const reports = await storage.getGradingReports();
    res.json(reports);
  });

  app.get(api.grading.get.path, async (req, res) => {
    const report = await storage.getGradingReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    res.json(report);
  });

  return httpServer;
}
