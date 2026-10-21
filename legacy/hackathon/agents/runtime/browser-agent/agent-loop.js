import {query0GVision} from './og-vision-client.js';
import {resolve} from 'node:path';

const SYSTEM_PROMPT = `You are an autonomous AI browser agent.
You inspect the current web page (via visual screenshot and accessibility tree) and output exactly ONE discrete action to advance the user's task.

Available Actions:
- "click": target is a CSS selector (e.g. '[data-testid="tweetButtonInline"]', 'button:has-text("Post")') or coordinates "x,y".
- "type": target is an input/textbox selector, value is the exact string to type.
- "press": value is key name like "Enter" or "Tab".
- "navigate": value is full URL to load.
- "wait": value is wait duration in milliseconds (e.g. "2000").
- "task_complete": target and value are null. Use when you visually confirm the goal is achieved.
- "failed": target is null, value is reason. Use when blocked or impossible to continue.

Output strict JSON only, with no markdown code blocks or additional prose:
{
  "reasoning": "what you see on page and why you are taking this step",
  "action": "click" | "type" | "press" | "navigate" | "wait" | "task_complete" | "failed",
  "target": "selector or coordinates (if applicable)",
  "value": "text to type or url or key (if applicable)"
}`;

function parseActionResponse(text) {
  let cleaned = text.replace(/^```(?:json)?|```$/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to extract json block if wrapped in prose
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    throw new Error(`Could not parse action JSON from 0G Compute response: ${text.slice(0, 200)}`);
  }
}

/**
 * Execute the perception-action decision loop.
 *
 * @param {object} params
 * @param {import('./browser-controller.js').BrowserController} params.controller
 * @param {string} params.task - The user's instruction
 * @param {number} [params.maxSteps=15] - Maximum steps before terminating
 * @param {string} params.runsDir - Directory to store step screenshots
 * @returns {Promise<{stepsTaken: number, actionsLog: Array, finalScreenshotPath: string, completed: boolean}>}
 */
export async function runAgentLoop({controller, task, maxSteps = 15, runsDir, dryRun = false}) {
  const actionsLog = [];
  let step = 0;
  let finalScreenshotPath = null;
  let completed = false;

  console.log(`\n🚀 Starting Agent Loop for task: "${task}"${dryRun ? ' [DRY RUN]' : ''}`);
  console.log(`Max steps allowed: ${maxSteps}\n`);

  while (step < maxSteps) {
    step++;
    const stepScreenshotPath = resolve(runsDir, `step-${step}.png`);
    finalScreenshotPath = stepScreenshotPath;

    console.log(`--- [Step ${step}/${maxSteps}] Perceiving Page ---`);
    const {base64} = await controller.screenshot(stepScreenshotPath);
    const a11yTree = await controller.getAccessibilityTree();

    const previousActionsSummary = actionsLog
      .map((a, i) => `Step ${i + 1}: ${a.action} on ${a.target || a.value || 'none'} -> ${a.reasoning}`)
      .join('\n');

    const promptText = `User Goal / Task: "${task}"${dryRun ? ' (NOTE: This is a DRY RUN. Do NOT click submit or post.)' : ''}

History of previous actions:
${previousActionsSummary || 'No actions taken yet.'}

Based on the screenshot and accessibility tree, determine the single next best action to achieve the goal.`;

    console.log(`Consulting 0G Compute TEE model...`);
    const t0 = Date.now();
    const currentUrl = await controller.getUrl();
    let visionRes;
    try {
      visionRes = await query0GVision({
        imageBase64: base64,
        promptText,
        accessibilityTree: a11yTree,
        systemPrompt: SYSTEM_PROMPT,
        currentUrl,
        actionsLog,
        dryRun,
      });
    } catch (err) {
      console.error(`[Step ${step}] 0G Compute call failed:`, err.message);
      actionsLog.push({
        step,
        action: 'error',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    const latency = Date.now() - t0;
    const actionPlan = parseActionResponse(visionRes.responseText);

    console.log(`Decision (${latency}ms, TEE-attested: ${Boolean(visionRes.attestation?.verified)}):`);
    console.log(`  Action:    ${actionPlan.action}`);
    console.log(`  Target:    ${actionPlan.target || 'N/A'}`);
    console.log(`  Value:     ${actionPlan.value || 'N/A'}`);
    console.log(`  Reasoning: ${actionPlan.reasoning}\n`);

    actionsLog.push({
      step,
      action: actionPlan.action,
      target: actionPlan.target || null,
      value: actionPlan.value || null,
      reasoning: actionPlan.reasoning,
      attestation: visionRes.attestation,
      model: visionRes.model,
      latencyMs: visionRes.latencyMs,
      screenshot: stepScreenshotPath,
      timestamp: new Date().toISOString(),
    });

    if (actionPlan.action === 'task_complete') {
      // Guard: If not dry run and task involves posting, verify that the composer actually closed
      if (!dryRun && (task.toLowerCase().includes('post') || task.toLowerCase().includes('tweet'))) {
        const composerOpen = await controller.isComposerOpen();
        if (composerOpen) {
          console.warn(`[AgentLoop] Composer still open when model reported task_complete. Attempting native Control+Enter submission...`);
          await controller.press('Control+Enter');
          const closed = await controller.waitForComposerClosed(4000);
          if (!closed) {
            console.warn(`[AgentLoop] Warning: Composer remained open despite submission.`);
          }
        }
      }
      console.log(`🎯 Model reported task_complete at step ${step}!`);
      completed = true;
      break;
    }

    if (actionPlan.action === 'failed') {
      console.warn(`🛑 Model reported failure at step ${step}: ${actionPlan.reasoning}`);
      break;
    }

    // Execute the primitive
    try {
      if (actionPlan.action === 'click') {
        await controller.click(actionPlan.target);
        // If clicking post/tweet button, verify that composer closes
        if (!dryRun && (actionPlan.target?.includes('tweetButton') || actionPlan.reasoning?.toLowerCase().includes('post button'))) {
          const closed = await controller.waitForComposerClosed(4000);
          if (!closed) {
            console.warn(`[Step ${step}] Composer still open after click. Retrying with native Control+Enter shortcut...`);
            await controller.press('Control+Enter');
            await controller.waitForComposerClosed(4000);
          }
        }
      } else if (actionPlan.action === 'type') {
        await controller.type(actionPlan.value, actionPlan.target);
      } else if (actionPlan.action === 'press') {
        await controller.press(actionPlan.value || 'Enter');
      } else if (actionPlan.action === 'navigate') {
        await controller.navigate(actionPlan.value);
      } else if (actionPlan.action === 'wait') {
        await controller.wait(Number(actionPlan.value) || 2000);
      }
    } catch (execErr) {
      console.warn(`[Step ${step}] Action execution error: ${execErr.message}. Continuing loop...`);
      const lastAction = actionsLog[actionsLog.length - 1];
      if (lastAction) {
        lastAction.executionError = execErr.message;
      }
      // If clicking post button failed, try native Control+Enter shortcut
      if (actionPlan.action === 'click' && (actionPlan.target?.includes('tweetButton') || actionPlan.reasoning?.toLowerCase().includes('post'))) {
        console.log(`[Step ${step}] Post click failed. Attempting fallback native Control+Enter shortcut...`);
        try {
          await controller.press('Control+Enter');
          await controller.waitForComposerClosed(4000);
        } catch {}
      }
    }

    await controller.wait(1500); // Allow browser DOM to react
  }

  return {
    stepsTaken: step,
    actionsLog,
    finalScreenshotPath,
    completed,
  };
}
