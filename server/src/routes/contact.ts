import { Router } from "express";
import { Resend } from "resend";
import { z } from "zod";

const router = Router();

// Allow missing RESEND_API_KEY in dev, but it will fail when trying to send
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

const ContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(1, "Message is required"),
});

router.post("/", async (req, res) => {
  try {
    const data = ContactSchema.parse(req.body);

    if (!process.env.RESEND_API_KEY) {
      console.warn("[Contact] RESEND_API_KEY is not set. Simulating success for contact submission.");
      return res.status(200).json({ success: true, message: "Message sent (simulated)" });
    }

    const result = await resend.emails.send({
      from: "Claritiy Voice Contact <onboarding@resend.dev>", // Or a verified domain
      to: "devr01499@gmail.com",
      subject: `New Contact Us Submission from ${data.name}`,
      text: `Name: ${data.name}\nEmail: ${data.email}\n\nMessage:\n${data.message}`,
    });

    if (result.error) {
      console.error("[Contact Error]", result.error);
      return res.status(500).json({ error: "Failed to send message via Resend." });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error("[Contact Exception]", error);
    res.status(500).json({ error: "Internal server error processing contact submission." });
  }
});

export default router;
