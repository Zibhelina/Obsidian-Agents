import type { Skill } from "./types";

const IMAGE_PROMPT = `## Image generation skill (active)

The user has explicitly activated the /image skill for this turn. Treat image creation / display as the **primary goal** for this request.

Expectations:

- If the gateway exposes an image-generation tool (\`image_gen\`, \`generate_image\`, \`create_image\`, etc.), invoke it. Do not describe an image from memory when you can actually generate one.
- When an image is generated, embed it in your response using standard markdown image syntax \`![description](url)\` or the Obsidian Agents rich layout blocks (\`obsidian-agents-hero\`, \`obsidian-agents-gallery\`, etc.) when multiple images or a polished presentation is appropriate.
- If the user provided a prompt, pass it through faithfully. If the prompt is vague, ask 1-2 clarifying questions (style, aspect ratio, mood) before generating — but keep the turn moving quickly.
- If the user wants an image edited, varied, or upscaled, use the appropriate tool variant if available; otherwise explain the limitation plainly.

If **no image-generation tool is available** in this environment:

- Do **not** pretend you generated an image. Do **not** fabricate image URLs or placeholder links.
- Say plainly: "I don't have an image-generation tool available in this Hermes configuration. Here's how you could create this image externally, or enable an image-generation tool in the gateway."
- You may still describe the image in detail, suggest prompts for external services (DALL-E, Midjourney, Stable Diffusion, etc.), or help the user refine their vision.`;

export const imageSkill: Skill = {
  id: "image",
  label: "Image generation",
  description: "Generate and display images using available tools; no fabrication when tools are missing.",
  icon: "image",
  placeholder: "Generate an image",
  systemPrompt: IMAGE_PROMPT,
  kind: "custom",
};
